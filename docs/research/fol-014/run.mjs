#!/usr/bin/env node
// FOL-014 default-UI acceptance harness.
//
// Proves, on one exact commit, that a fresh Vite + React consumer which only
// installs the real `@uichat-mira/folio` tarball can build and run Folio's
// **default** documentation UI, and records what TypeScript says about the
// public entrypoints (root, `/vite`, `virtual:folio/content`).
//
// Shape: build package -> npm pack -> install the .tgz into a temporary
// consumer outside the repository -> run four strict `tsc` projects (app,
// root, /vite and virtual module with no local declaration) -> `vite build`
// -> serve the SPA -> drive
// headless Chrome over the DevTools protocol at 1440x900 and 375x812 in light
// and dark mode, clicking the real sidebar / TOC / pager / mobile drawer.
//
// The fixture uses no workspace alias, no repository source path, and no
// official-site stylesheet. `staticRoutes` is off on purpose: FOL-009 covers
// the generated static HTML, and a served SPA shell makes sure every click is
// answered by the React runtime rather than a pre-rendered page.
//
// Usage: node docs/research/fol-014/run.mjs [--keep]
// Requires Chrome/Edge; set FOLIO014_CHROME to override the search.
// Exits non-zero on infrastructure failure or missing package-owned types.
// Browser observations remain recorded in results/acceptance.json.
//
// Scenario wrapper support (FOL-019). With no flags the behaviour and artifact
// paths are exactly the FOL-014 defaults:
//   --out <dir>        results directory (default: <this dir>/results)
//   --fixture <dir>    consumer fixture (default: <this dir>/consumer)
//   --scenario <file>  JSON scenario that overrides expected titles, the start
//                      route, interaction selectors and opts into the no-JS
//                      static phase (see docs/research/fol-019/README.md).
// Relative paths resolve against the current working directory.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const argv = process.argv.slice(2);
const argValue = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const scenarioPath = argValue("--scenario");
const scenario = scenarioPath
  ? JSON.parse(readFileSync(resolve(scenarioPath), "utf8"))
  : {};
const fixtureDir = argValue("--fixture")
  ? resolve(argValue("--fixture"))
  : join(scriptDir, "consumer");
const resultsDir = argValue("--out")
  ? resolve(argValue("--out"))
  : join(scriptDir, "results");
const shotsDir = join(resultsDir, "screenshots");
const keepTemp = argv.includes("--keep");
const isWindows = process.platform === "win32";

const CHROME_CANDIDATES = [
  process.env.FOLIO014_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

// Scenario defaults reproduce the FOL-014 run exactly; a scenario file may
// override the start route, expected titles and the interaction targets, and
// may opt into the static no-JS phase. Selector values stay strings so the
// default document contains no behaviour branch.
const START_PATH = scenario.startPath ?? "/docs/second";
const EXPECTED_TITLES = scenario.expectedTitles ?? [
  "安装真实 tarball",
  "默认文档界面",
  "定制与边界",
];
const INTERACTIONS = {
  desktopToc: {
    selector: '.folio-toc a[href="#页面结构"]',
    label: "desktop: TOC link to 页面结构",
  },
  desktopSidebar: {
    selector: '.folio-docnav a[href="/docs/intro"]',
    label: "desktop: sidebar link to /docs/intro",
  },
  drawerDoc: {
    selector: '.folio-docs-drawer a[href="/docs/third"]',
    label: "mobile: select doc from drawer",
    expectedPath: "/docs/third",
  },
  mobileTocLink: {
    selector: ".folio-mobile-toc .folio-toc a",
    label: "mobile: select heading from 页面导航",
  },
  ...(scenario.interactions ?? {}),
};
const SEARCH = scenario.search ?? null;
const STATIC = scenario.static?.enabled ? scenario.static : null;
const scenarioLabel = scenario.label ?? null;

function log(line = "") {
  console.log(line);
}

function fail(stage, message) {
  throw new Error(`[${stage}] ${message}`);
}

const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const hasNpmCli = existsSync(npmCli);

function runNpm(args, cwd, { allowFailure = false } = {}) {
  const command = hasNpmCli ? process.execPath : isWindows ? "npm.cmd" : "npm";
  const commandArgs = hasNpmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: !hasNpmCli && isWindows,
    timeout: 900_000,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
  });
  if (!allowFailure && result.status !== 0) {
    fail(
      "setup",
      `${commandArgs.join(" ")} failed with exit code ${result.status}\n` +
        `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
        `--- stderr ---\n${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function runNode(args, cwd, { allowFailure = false, env } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    timeout: 600_000,
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  if (!allowFailure && result.status !== 0) {
    fail(
      "command",
      `node ${args.join(" ")} failed with exit code ${result.status}\n` +
        `${(result.stdout ?? "").trim()}\n${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", timeout: 60_000 });
  return result.status === 0 ? (result.stdout ?? "").trim() : undefined;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) fail("browser", `no Chrome/Edge found; tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
  return found;
}

// ---------------------------------------------------------------------------
// Minimal Chrome DevTools Protocol client. Node 22+ ships a WebSocket client,
// so the acceptance run needs no browser automation dependency. Compared to the
// FOL-007 helper this one keeps a listener list so console errors and
// exceptions can be collected for the whole run.
// ---------------------------------------------------------------------------
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.onmessage = (event) => this.#dispatch(JSON.parse(event.data));
  }

  #dispatch(message) {
    if (message.id !== undefined) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
      return;
    }
    for (const handler of this.listeners.get(message.method) ?? []) {
      handler(message.params, message.sessionId);
    }
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(
        method,
        current.filter((item) => item !== handler),
      );
    };
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      this.socket.send(
        JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
      );
    });
  }

  once(method) {
    return new Promise((resolvePromise) => {
      const off = this.on(method, (params) => {
        off();
        resolvePromise(params);
      });
    });
  }
}

async function waitForEndpoint(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  fail("browser", `DevTools endpoint ${url} did not become ready`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// Single-page host: unknown paths fall back to index.html so the client router
// (BrowserRouter) handles deep links, exactly like a deployed Folio consumer.
function serve(directory) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    let file = join(directory, pathname);
    if (!file.startsWith(directory) || !existsSync(file) || !statSync(file).isFile()) {
      file = join(directory, "index.html");
    }
    response.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(readFileSync(file));
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// ---------------------------------------------------------------------------
// In-page measurements. Everything here is data (rects, computed styles,
// contrast, interaction outcomes); no visual claim is derived from it.
// ---------------------------------------------------------------------------
const MEASURE = String.raw`(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      width: Math.round(r.width), height: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
    };
  };
  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const style = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  const parseColor = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!m) return null;
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = (c) => {
    const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const background = (el) => {
    let node = el;
    while (node) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.9) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const contrast = (el) => {
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) return null;
    const bg = background(el);
    const a = luminance(fg);
    const b = luminance(bg);
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };

  const header = document.querySelector('.folio-header');
  const sidebar = document.querySelector('.folio-docnav');
  const toc = document.querySelector('.folio-toc');
  const main = document.querySelector('.folio-doc-main');
  const h1 = document.querySelector('.folio-doc-main h1') || document.querySelector('h1');
  const paragraph = document.querySelector('.folio-markdown p') || document.querySelector('p');
  const pager = document.querySelector('.folio-page-nav');
  const mobileBar = document.querySelector('.folio-docs-mobile-bar');
  const article = document.querySelector('.folio-markdown');

  const sidebarLinks = sidebar
    ? Array.from(sidebar.querySelectorAll('a')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href'),
        current: a.getAttribute('aria-current'),
        rect: rect(a),
      }))
    : [];
  const tocItems = toc
    ? Array.from(toc.querySelectorAll('a')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: a.getAttribute('href'),
        current: a.getAttribute('aria-current'),
      }))
    : [];
  const pagerLinks = pager
    ? Array.from(pager.querySelectorAll('a')).map((a) => ({
        text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
        href: a.getAttribute('href'),
      }))
    : [];
  const mobileButtons = mobileBar
    ? Array.from(mobileBar.querySelectorAll('button')).map((b) => ({
        text: (b.textContent || '').trim(),
        disabled: b.disabled,
        expanded: b.getAttribute('aria-expanded'),
        rect: rect(b),
      }))
    : [];

  // Horizontal-overflow triage. Only elements that escape the viewport *and*
  // have no scrollable ancestor are page-level overflow; wide code lines inside
  // a pre element with overflow-x: auto are contained by design and reported
  // separately.
  const scrollAncestor = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return node;
      node = node.parentElement;
    }
    return null;
  };
  const offenders = [];
  const contained = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const ancestor = scrollAncestor(el);
    const entry = {
      tag: el.tagName.toLowerCase(),
      className: String(el.className || '').slice(0, 60),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
    };
    if (ancestor) {
      if (contained.length === 0) {
        entry.container = ancestor.tagName.toLowerCase() + '.' + String(ancestor.className || '').split(' ')[0];
        entry.containerScrollWidth = ancestor.scrollWidth;
        entry.containerClientWidth = ancestor.clientWidth;
        entry.containerOverflowX = getComputedStyle(ancestor).overflowX;
      }
      contained.push(entry);
    } else {
      offenders.push(entry);
    }
    if (offenders.length >= 12 && contained.length >= 12) break;
  }
  const clipped = [];
  for (const el of Array.from(document.querySelectorAll('h1, h2, h3, p, li, td, th, pre, code'))) {
    if (el.scrollWidth > el.clientWidth + 1 && scrollAncestor(el) === null && getComputedStyle(el).overflowX === 'visible') {
      clipped.push({
        tag: el.tagName.toLowerCase(),
        className: String(el.className || '').slice(0, 60),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
      if (clipped.length >= 8) break;
    }
  }

  const mainRect = rect(main);
  const sidebarRect = rect(sidebar);
  const tocRect = rect(toc);
  const intersects = (a, b) => Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);

  return {
    viewport: { width: vw, height: vh, devicePixelRatio: window.devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    url: { pathname: location.pathname, hash: location.hash, href: location.href },
    document: { title: document.title, lang: document.documentElement.lang },
    theme: {
      attribute: document.documentElement.getAttribute('data-folio-theme'),
      colorScheme: document.documentElement.style.colorScheme || null,
      stored: (() => { try { return localStorage.getItem('folio-theme'); } catch { return null; } })(),
      prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    },
    consumer: {
      roots: document.documentElement.getAttribute('data-folio-consumer-roots'),
      rootChildren: document.getElementById('root') ? document.getElementById('root').childElementCount : -1,
      shellPresent: Boolean(document.querySelector('.folio-shell')),
    },
    heading: { text: h1 ? (h1.textContent || '').trim() : null, rect: rect(h1), style: style(h1, ['font-size', 'line-height', 'font-weight', 'color', 'font-family', 'margin-bottom']) },
    paragraph: paragraph ? { textLength: (paragraph.textContent || '').length, style: style(paragraph, ['font-size', 'line-height', 'color', 'font-family', 'margin-top']), contrast: contrast(paragraph) } : null,
    readability: {
      h1Contrast: h1 ? contrast(h1) : null,
      bodyBackground: style(document.body, ['background-color', 'color', 'margin-top', 'min-width']),
    },
    header: { visible: isVisible(header), rect: rect(header), position: header ? getComputedStyle(header).position : null },
    layout: {
      sidebar: { visible: isVisible(sidebar), rect: sidebarRect, collection: sidebar ? (sidebar.querySelector('.folio-docnav__collection')?.textContent || '').trim() : null, sections: sidebar ? Array.from(sidebar.querySelectorAll('section > h2')).map((el) => (el.textContent || '').trim()) : [], links: sidebarLinks },
      toc: { visible: isVisible(toc), rect: tocRect, items: tocItems, activeHref: toc ? (toc.querySelector('a[aria-current]')?.getAttribute('href') || null) : null },
      pager: { visible: isVisible(pager), rect: rect(pager), links: pagerLinks },
      mobileBar: { visible: isVisible(mobileBar), rect: rect(mobileBar), buttons: mobileButtons },
      main: { rect: mainRect },
      overflow: {
        horizontal: document.documentElement.scrollWidth > vw || document.body.scrollWidth > vw,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offenders,
        contained,
        clipped,
      },
      overlap: {
        headerOverlapsH1: intersects(rect(header), rect(h1)),
        sidebarOverlapsMain: intersects(sidebarRect, mainRect),
        tocOverlapsMain: intersects(tocRect, mainRect),
        h1BelowHeader: h1 && header ? Math.round(rect(h1).y - rect(header).bottom) : null,
      },
    },
    content: {
      articlePresent: Boolean(article),
      headingCount: article ? article.querySelectorAll('h2, h3').length : 0,
      paragraphCount: article ? article.querySelectorAll('p').length : 0,
      listItemCount: article ? article.querySelectorAll('li').length : 0,
      tableCount: article ? article.querySelectorAll('table').length : 0,
      codeBlockCount: article ? article.querySelectorAll('pre').length : 0,
      blockquoteCount: article ? article.querySelectorAll('blockquote').length : 0,
      firstHeadingId: article ? (article.querySelector('h2')?.id || null) : null,
      markdownExcerpt: article ? (article.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : null,
    },
    mobileMenu: {
      panelPresent: Boolean(document.querySelector('.folio-mobile-panel')),
      drawer: document.querySelector('.folio-docs-drawer') ? { rect: rect(document.querySelector('.folio-docs-drawer')), links: Array.from(document.querySelectorAll('.folio-docs-drawer a')).map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') })), closeButton: rect(document.querySelector('.folio-docs-drawer__head button')) } : null,
      mobileToc: document.querySelector('.folio-mobile-toc') ? { rect: rect(document.querySelector('.folio-mobile-toc')), links: Array.from(document.querySelectorAll('.folio-mobile-toc a')).map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') })), closeButton: rect(document.querySelector('.folio-mobile-toc__head button')) } : null,
      overlay: document.querySelector('.folio-docs-overlay') ? { rect: rect(document.querySelector('.folio-docs-overlay')), background: getComputedStyle(document.querySelector('.folio-docs-overlay')).backgroundColor } : null,
    },
  };
})()`;

const NAV_STATE = String.raw`(() => ({
  pathname: location.pathname,
  hash: location.hash,
  dataTheme: document.documentElement.getAttribute('data-folio-theme'),
  h1: (document.querySelector('.folio-doc-main h1') || document.querySelector('h1'))?.textContent?.trim() || null,
  scrollY: Math.round(window.scrollY),
  sidebarActiveHref: document.querySelector('.folio-docnav a[aria-current="page"]')?.getAttribute('href') || null,
  tocActiveHref: document.querySelector('.folio-toc a[aria-current="location"]')?.getAttribute('href') || null,
  drawerPresent: Boolean(document.querySelector('.folio-docs-drawer')),
  mobileTocPresent: Boolean(document.querySelector('.folio-mobile-toc')),
  drawerLinkCount: document.querySelectorAll('.folio-docs-drawer .folio-docnav a').length,
  mobileTocLinkCount: document.querySelectorAll('.folio-mobile-toc .folio-toc a').length,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}))()`;

// No-JS static reading measurement. The page is loaded with script execution
// disabled, so every value here comes from the pre-rendered HTML plus the
// installed default stylesheet. `consumerRoots` is set only by the consumer's
// main.tsx, and `jsResourcesLoaded` must stay empty, which is how the harness
// proves React never ran on this page.
const STATIC_MEASURE = String.raw`(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      width: Math.round(r.width), height: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
    };
  };
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null);
  const style = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  const parseColor = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!m) return null;
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = (c) => {
    const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const background = (el) => {
    let node = el;
    while (node) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.9) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const contrast = (el) => {
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) return null;
    const bg = background(el);
    const a = luminance(fg);
    const b = luminance(bg);
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };
  const root = document.getElementById('root');
  // The static shell contains the docs nav/toc twice: once in the closed mobile
  // <details> menu and once as direct children of .folio-docs-shell. Measure the
  // shell copy so the desktop geometry reflects what is actually visible.
  const nav = document.querySelector('.folio-docs-shell > .folio-docnav') || document.querySelector('.folio-docnav');
  const toc = document.querySelector('.folio-docs-shell > .folio-toc') || document.querySelector('.folio-toc');
  const pager = document.querySelector('.folio-page-nav');
  const article = document.querySelector('.folio-markdown');
  const h1 = document.querySelector('.folio-doc-main h1') || document.querySelector('h1');
  const paragraph = document.querySelector('.folio-markdown p') || document.querySelector('p');
  const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
  return {
    url: { href: location.href, pathname: location.pathname },
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    js: {
      consumerRoots: document.documentElement.dataset.folioConsumerRoots ?? null,
      scriptTags: Array.from(document.scripts).map((script) => ({ type: script.type, src: script.getAttribute('src') })),
      jsResourcesLoaded: resources.filter((name) => /\.js(\?|$)/.test(name)),
      cssResourcesLoaded: resources.filter((name) => /\.css(\?|$)/.test(name)),
    },
    root: { present: Boolean(root), childElementCount: root ? root.childElementCount : -1, emptyShell: root ? root.innerHTML.trim() === '' : null },
    classes: {
      runtimeStatic: Boolean(document.querySelector('.folio-docs-runtime--static')),
      docsShell: Boolean(document.querySelector('.folio-docs-shell')),
      reactShell: Boolean(document.querySelector('.folio-shell')),
      docnav: Boolean(nav),
      toc: Boolean(toc),
      pager: Boolean(pager),
      markdown: Boolean(article),
      mobileBarStatic: Boolean(document.querySelector('.folio-docs-mobile-bar--static')),
      staticMenus: document.querySelectorAll('.folio-static-doc-menu').length,
    },
    nav: nav ? {
      rect: rect(nav),
      display: getComputedStyle(nav).display,
      collection: text(nav.querySelector('.folio-docnav__collection')),
      sections: Array.from(nav.querySelectorAll('section > h2')).map(text),
      links: Array.from(nav.querySelectorAll('a')).map((a) => ({
        text: text(a),
        href: a.getAttribute('href'),
        current: a.getAttribute('aria-current'),
        active: a.classList.contains('active'),
        rect: rect(a),
      })),
    } : null,
    toc: toc ? {
      rect: rect(toc),
      display: getComputedStyle(toc).display,
      links: Array.from(toc.querySelectorAll('a')).map((a) => ({ text: text(a), href: a.getAttribute('href') })),
    } : null,
    pager: pager ? {
      rect: rect(pager),
      display: getComputedStyle(pager).display,
      links: Array.from(pager.querySelectorAll('a')).map((a) => ({ text: text(a), href: a.getAttribute('href'), className: a.className })),
    } : null,
    content: article ? {
      headingCount: article.querySelectorAll('h2, h3').length,
      paragraphCount: article.querySelectorAll('p').length,
      listItemCount: article.querySelectorAll('li').length,
      tableCount: article.querySelectorAll('table').length,
      codeBlockCount: article.querySelectorAll('pre').length,
      blockquoteCount: article.querySelectorAll('blockquote').length,
      excerpt: text(article).slice(0, 240),
    } : null,
    heading: h1 ? { text: text(h1), style: style(h1, ['font-size', 'line-height', 'color', 'font-family']), contrast: contrast(h1) } : null,
    paragraph: paragraph ? { textLength: (paragraph.textContent || '').length, style: style(paragraph, ['font-size', 'line-height', 'color', 'font-family']), contrast: contrast(paragraph) } : null,
    body: style(document.body, ['background-color', 'color', 'min-width']),
    stylesheets: {
      count: document.styleSheets.length,
      links: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.getAttribute('href')),
    },
    theme: {
      attribute: document.documentElement.getAttribute('data-folio-theme'),
      colorScheme: document.documentElement.style.colorScheme || null,
    },
  };
})()`;

// ---------------------------------------------------------------------------
async function main() {
  const chromePath = findChrome();
  const packageManifest = JSON.parse(
    readFileSync(join(repoRoot, "packages", "folio", "package.json"), "utf8"),
  );
  const commit = git(["rev-parse", "HEAD"]);
  const shortCommit = git(["rev-parse", "--short=12", "HEAD"]);
  const dirty = Boolean(git(["status", "--porcelain"]));
  // The acceptance fixtures/results themselves make the tree dirty while a run
  // is in progress; what matters for the tarball is that no packaged source
  // changed. Both are recorded so the evidence stays honest.
  const packageSourceDirty = Boolean(
    git(["status", "--porcelain", "--", "packages", "apps", "schemas", "scripts"]),
  );
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);

  for (const dir of [resultsDir, shotsDir]) mkdirSync(dir, { recursive: true });

  const tempRoot = mkdtempSync(join(tmpdir(), "folio-fol014-"));
  const tarballDir = join(tempRoot, "tarball");
  const consumerDir = join(tempRoot, "consumer");
  mkdirSync(tarballDir, { recursive: true });
  cpSync(fixtureDir, consumerDir, { recursive: true });

  const acceptance = {
    meta: {
      generatedAt: new Date().toISOString(),
      branch,
      commit,
      dirtyWorkingTree: dirty,
      packageSourceDirty,
      node: process.version,
      npm: runNpm(["--version"], repoRoot).stdout.trim(),
      platform: `${process.platform} ${process.arch}`,
      package: `${packageManifest.name}@${packageManifest.version}`,
      chromePath,
      fixture: relative(repoRoot, fixtureDir).replace(/\\/g, "/"),
      scenario: scenarioLabel,
      outDir: relative(repoRoot, resultsDir).replace(/\\/g, "/"),
      staticRoutes: false,
      staticPhase: Boolean(STATIC),
    },
    packageEvidence: {},
    types: {},
    build: {},
    browser: {},
    console: [],
    checks: [],
  };

  const check = (id, status, detail, extra = {}) => {
    acceptance.checks.push({ id, status, detail, ...extra });
    log(`[${status.toLowerCase().padEnd(9)}] ${id} — ${detail}`);
  };

  log(scenarioLabel ? `FOL-019 scenario ${scenarioLabel} on the FOL-014 harness` : "FOL-014 default-UI acceptance");
  log(`  source:   ${commit}${dirty ? " (working tree dirty)" : ""} on ${branch}`);
  log(`  package:  ${packageManifest.name}@${packageManifest.version}`);
  log(`  browser:  ${chromePath}`);
  log(`  consumer: ${consumerDir}`);
  log("");

  // 1. Real artifacts.
  runNpm(["run", "build", "-w", "@uichat-mira/folio"], repoRoot);
  runNpm(
    ["pack", "--ignore-scripts", "--pack-destination", tarballDir, "--json"],
    join(repoRoot, "packages", "folio"),
  );
  const tarball = readdirSync(tarballDir).find((file) => file.endsWith(".tgz"));
  if (!tarball) fail("pack", "npm pack produced no tarball");
  const tarballPath = join(tarballDir, tarball);
  acceptance.packageEvidence = {
    tarball,
    sha256: sha256(tarballPath),
    bytes: statSync(tarballPath).size,
    sourceCommit: commit,
    sourceBranch: branch,
    buildCommand: "npm run build -w @uichat-mira/folio",
    packCommand: "npm pack --ignore-scripts",
    installCommand: `npm install --no-audit --no-fund ./${tarball} @vitejs/plugin-react@^5 typescript@^5.9.3 @types/react@^19 @types/react-dom@^19 @types/node@^24`,
    buildConsumerCommand: "node node_modules/vite/bin/vite.js build",
  };
  log(`[package]  ${tarball} sha256=${acceptance.packageEvidence.sha256} (${acceptance.packageEvidence.bytes} bytes)`);

  // A real independent install: the tarball plus dev tooling only. react,
  // react-dom, react-router-dom and vite arrive through peer resolution.
  runNpm(
    [
      "install",
      "--no-audit",
      "--no-fund",
      tarballPath,
      "@vitejs/plugin-react@^5",
      "typescript@^5.9.3",
      "@types/react@^19",
      "@types/react-dom@^19",
      "@types/node@^24",
    ],
    consumerDir,
  );
  const installed = {};
  for (const name of [
    "@uichat-mira/folio",
    "react",
    "react-dom",
    "react-router-dom",
    "vite",
    "typescript",
  ]) {
    const manifestPath = join(consumerDir, "node_modules", name, "package.json");
    installed[name] = existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, "utf8")).version
      : null;
  }
  acceptance.packageEvidence.installedVersions = installed;
  const folioInstalled = join(consumerDir, "node_modules", "@uichat-mira", "folio");
  acceptance.packageEvidence.installedFrom = {
    path: folioInstalled,
    isSymlink: existsSync(folioInstalled)
      ? spawnSync(process.execPath, [
          "-e",
          `const fs=require('fs');const p=${JSON.stringify(folioInstalled)};console.log(fs.lstatSync(p).isSymbolicLink())`,
        ], { encoding: "utf8" }).stdout.trim()
      : null,
  };
  log(`[install]  ok  ${Object.entries(installed).map(([k, v]) => `${k}@${v}`).join(", ")}`);
  check("install-independent", "PASS", `tarball installed outside the repository; workspace link=${acceptance.packageEvidence.installedFrom.isSymlink}`);

  // 2. TypeScript consumption: four independent strict tsc projects.
  const tsc = join(consumerDir, "node_modules", "typescript", "bin", "tsc");
  const runTsc = (project) => {
    const command = `node node_modules/typescript/bin/tsc -p ${project} --pretty false`;
    const result = runNode(
      [tsc, "-p", project, "--pretty", "false"],
      consumerDir,
      { allowFailure: true },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    const diagnostics = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /error TS\d+/.test(line))
      .map((line) => {
        const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
        return match
          ? { file: match[1], line: Number(match[2]), code: match[4], message: match[5] }
          : { raw: line };
      });
    return { project, command, exitCode: result.status, raw: output, diagnostics };
  };

  const typeRuns = {
    app: runTsc("tsconfig.json"),
    rootEntry: runTsc("tsconfig.types-root.json"),
    viteEntry: runTsc("tsconfig.types-vite.json"),
    virtualBaseline: runTsc("tsconfig.types-baseline.json"),
  };
  acceptance.types = typeRuns;

  const baselineCodes = new Set(typeRuns.virtualBaseline.diagnostics.map((d) => d.code));
  const baselineVirtualOnly =
    typeRuns.virtualBaseline.exitCode !== 0 &&
    typeRuns.virtualBaseline.diagnostics.length > 0 &&
    typeRuns.virtualBaseline.diagnostics.every(
      (d) => d.code === "TS2307" && /virtual:folio\/content/.test(d.message ?? d.raw ?? ""),
    );

  check(
    "types-root-entry",
    typeRuns.rootEntry.exitCode === 0 ? "PASS" : "FAIL",
    `@uichat-mira/folio root types: tsc exit ${typeRuns.rootEntry.exitCode} (strict, skipLibCheck=false)` +
      (typeRuns.rootEntry.exitCode === 0 ? "" : ` — ${typeRuns.rootEntry.diagnostics.map((d) => `${d.code} ${d.message}`).join(" | ")}`),
  );
  check(
    "types-vite-entry",
    typeRuns.viteEntry.exitCode === 0 ? "PASS" : "FAIL",
    `@uichat-mira/folio/vite types: tsc exit ${typeRuns.viteEntry.exitCode} (strict, skipLibCheck=false)` +
      (typeRuns.viteEntry.exitCode === 0 ? "" : ` — ${typeRuns.viteEntry.diagnostics.map((d) => `${d.code} ${d.message}`).join(" | ")}`),
  );
  check(
    "types-virtual-module",
    typeRuns.virtualBaseline.exitCode === 0 ? "PASS" : "FAIL",
    typeRuns.virtualBaseline.exitCode === 0
      ? "virtual:folio/content resolves without a consumer-side declaration"
      : `virtual:folio/content does not resolve from the tarball: ${typeRuns.virtualBaseline.diagnostics
          .map((d) => `${d.code} ${d.message}`)
          .join(" | ")} (only-virtual-module=${baselineVirtualOnly})`,
  );
  check(
    "types-app-project",
    typeRuns.app.exitCode === 0 ? "PASS" : "FAIL",
    `consumer app project (src/main.tsx + vite.config.ts): tsc exit ${typeRuns.app.exitCode}`,
  );
  acceptance.types.summary = {
    rootEntry: typeRuns.rootEntry.exitCode === 0 ? "PASS" : "FAIL",
    viteEntry: typeRuns.viteEntry.exitCode === 0 ? "PASS" : "FAIL",
    virtualModuleDefault: typeRuns.virtualBaseline.exitCode === 0 ? "PASS" : "FAIL",
    appProject: typeRuns.app.exitCode === 0 ? "PASS" : "FAIL",
    baselineOnlyVirtualModule: baselineVirtualOnly,
    baselineDiagnosticCodes: [...baselineCodes],
  };

  // A fixed virtual module type contract is a release gate: the harness must
  // not produce fresh screenshots for a TypeScript-broken candidate.
  // acceptance.types.summary shares the typeRuns object; never treat the
  // computed summary as a fifth tsc result.
  for (const name of ["app", "rootEntry", "viteEntry", "virtualBaseline"]) {
    const result = typeRuns[name];
    if (result.exitCode !== 0) {
      fail("types", `${name}: ${result.raw || `tsc exited ${result.exitCode}`}`);
    }
  }

  // 3. Build the default UI and confirm it is the real client bundle.
  const build = runNode(
    [join(consumerDir, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"],
    consumerDir,
    { allowFailure: true },
  );
  if (build.status !== 0) {
    fail(
      "build",
      `vite build failed with exit code ${build.status}\n${(build.stdout ?? "").trim()}\n${(build.stderr ?? "").trim()}`,
    );
  }
  const distDir = join(consumerDir, "dist");
  const assets = readdirSync(join(distDir, "assets"));
  const bundleText = readdirSync(join(distDir, "assets"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(join(distDir, "assets", file), "utf8"))
    .join("\n");
  const cssAssets = assets.filter((file) => file.endsWith(".css"));
  const cssText = cssAssets
    .map((file) => readFileSync(join(distDir, "assets", file), "utf8"))
    .join("\n");
  // The consumer imports only the tarball stylesheet; these two selectors only
  // exist in the official site's own CSS files, so finding either would mean
  // the acceptance was contaminated by apps/site styling.
  const officialSiteCssPresent =
    cssText.includes(".site-article-proof") ||
    cssText.includes(".showcase-home") ||
    cssText.includes(".claude-visual");
  const expectedTitles = EXPECTED_TITLES;
  const missingTitles = expectedTitles.filter((title) => !bundleText.includes(title));
  if (missingTitles.length) {
    fail("build", `client bundle is missing expected document titles: ${missingTitles.join(", ")}`);
  }
  acceptance.build = {
    command: "node node_modules/vite/bin/vite.js build",
    assets,
    distBytes: assets.reduce((total, file) => total + statSync(join(distDir, "assets", file)).size, 0),
    indexHtml: readFileSync(join(distDir, "index.html"), "utf8"),
    documentTitlesInBundle: expectedTitles,
    staticFilesGenerated: readdirSync(distDir).filter((file) => file !== "index.html" && file !== "assets"),
    css: {
      assets: cssAssets,
      bytes: cssAssets.reduce((total, file) => total + statSync(join(distDir, "assets", file)).size, 0),
      officialSiteCssPresent,
      tarballStylesheetSha256: sha256(join(consumerDir, "node_modules", "@uichat-mira", "folio", "dist", "styles.css")),
    },
  };
  log(`[build]    ok  ${assets.length} assets, ${acceptance.build.distBytes} bytes, no static HTML (staticRoutes: false)`);
  check("build-default-ui", "PASS", `vite build produced the default UI bundle with all ${expectedTitles.length} expected documents`);
  check(
    "build-no-official-site-css",
    officialSiteCssPresent ? "FAIL" : "PASS",
    `consumer CSS assets ${cssAssets.join(", ")} (${acceptance.build.css.bytes} bytes) contain no apps/site selector; source stylesheet sha256=${acceptance.build.css.tarballStylesheetSha256}`,
  );

  // 4. Browser acceptance.
  const server = await serve(distDir);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), "folio014-chrome-"));
  const debugPort = 9200 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp;
  let currentPage = "setup";
  const consoleEntries = [];
  try {
    const version = await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`);
    acceptance.browser.engine = version.Browser;
    acceptance.browser.userAgent = version["User-Agent"];
    acceptance.browser.protocolVersion = version["Protocol-Version"];
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolvePromise, rejectPromise) => {
      socket.onopen = resolvePromise;
      socket.onerror = () => rejectPromise(new Error("DevTools socket failed"));
    });
    cdp = new Cdp(socket);

    cdp.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (params.type !== "error" && params.type !== "warning" && params.type !== "assert") return;
      consoleEntries.push({
        page: currentPage,
        session: sessionId,
        type: params.type,
        text: params.args
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ")
          .slice(0, 500),
      });
    });
    cdp.on("Runtime.exceptionThrown", (params) => {
      const details = params.exceptionDetails ?? {};
      consoleEntries.push({
        page: currentPage,
        type: "exception",
        text: `${details.text ?? ""} ${details.exception?.description ?? ""}`.trim().slice(0, 800),
      });
    });
    cdp.on("Log.entryAdded", (params) => {
      const entry = params.entry ?? {};
      if (entry.level !== "error") return;
      consoleEntries.push({
        page: currentPage,
        type: `log:${entry.source ?? "unknown"}`,
        text: `${entry.text ?? ""} ${entry.url ?? ""}`.trim().slice(0, 500),
      });
    });

    const evaluate = async (sessionId, expression) => {
      const result = await cdp.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (result.exceptionDetails) {
        fail("browser", `evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
      }
      return result.result.value;
    };

    const openPage = async (label, metrics) => {
      currentPage = label;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Log.enable", {}, sessionId);
      await cdp.send("Emulation.setDeviceMetricsOverride", metrics, sessionId);
      // Deterministic light baseline; dark mode is then reached by clicking the
      // real theme toggle, which also proves the toggle works.
      await cdp.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source:
            "try { localStorage.setItem('folio-theme', 'light'); } catch (error) { window.__folioSeedError = String(error); }",
        },
        sessionId,
      );
      return sessionId;
    };

    const openStaticPage = async (label, metrics) => {
      currentPage = label;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Log.enable", {}, sessionId);
      // Script execution is disabled before the first navigation, so the
      // pre-rendered HTML is the only thing that can paint.
      await cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, sessionId);
      await cdp.send("Emulation.setDeviceMetricsOverride", metrics, sessionId);
      return sessionId;
    };

    const goto = async (sessionId, url) => {
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await loaded;
      await sleep(600);
    };

    const screenshot = async (sessionId, name) => {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(shot.data, "base64"));
      return `${name}.png`;
    };

    const clickAndRead = async (sessionId, selector, label) => {
      const clicked = await evaluate(
        sessionId,
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { ok: false, reason: 'selector not found' };
          el.click();
          return { ok: true, tag: el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80), href: el.getAttribute('href') };
        })()`,
      );
      await sleep(500);
      const state = await evaluate(sessionId, NAV_STATE);
      log(`[click]    ${label}: ${clicked.ok ? `clicked <${clicked.tag}> "${clicked.text}"` : clicked.reason} -> ${state.pathname}${state.hash}`);
      return { step: label, clicked, state };
    };

    const toggleTheme = async (sessionId, label) => {
      const result = await evaluate(
        sessionId,
        `(async () => {
          const visible = (el) => {
            if (!el) return false;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 1 && r.height > 1;
          };
          const direct = document.querySelector('.folio-theme-toggle');
          if (visible(direct)) { direct.click(); await new Promise((r) => setTimeout(r, 350)); return { via: 'header-toggle' }; }
          const menu = document.querySelector('.folio-mobile-menu-button');
          if (!visible(menu)) return { via: null, reason: 'no theme control found' };
          menu.click();
          await new Promise((r) => setTimeout(r, 300));
          const button = Array.from(document.querySelectorAll('.folio-mobile-panel button')).find((b) => /暗色|浅色/.test(b.textContent || ''));
          if (!button) return { via: 'mobile-panel', reason: 'theme button missing in mobile panel' };
          button.click();
          await new Promise((r) => setTimeout(r, 350));
          const panel = document.querySelector('.folio-mobile-menu-button');
          if (panel && panel.getAttribute('aria-expanded') === 'true') panel.click();
          await new Promise((r) => setTimeout(r, 250));
          return { via: 'mobile-panel' };
        })()`,
      );
      const state = await evaluate(sessionId, NAV_STATE);
      log(`[theme]    ${label}: via ${result.via} -> data-folio-theme=${state.dataTheme}`);
      return { step: label, via: result.via, state };
    };

    const searchProbe = async (sessionId, config) => {
      const trigger = config.trigger ?? ".folio-search-trigger";
      const overlay = config.overlay ?? ".folio-search-overlay";
      const input = config.input ?? ".folio-search-dialog input";
      const opened = await clickAndRead(sessionId, trigger, "desktop: open 搜索 overlay");
      const openState = await evaluate(
        sessionId,
        `(() => {
          const overlay = document.querySelector(${JSON.stringify(overlay)});
          const input = document.querySelector(${JSON.stringify(input)});
          const visible = (el) => {
            if (!el) return false;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 1 && r.height > 1;
          };
          return {
            overlayPresent: Boolean(overlay),
            overlayVisible: visible(overlay),
            inputPresent: Boolean(input),
            focused: document.activeElement === input,
            placeholder: input ? input.getAttribute('placeholder') : null,
          };
        })()`,
      );
      const queryResult = await evaluate(
        sessionId,
        `(async () => {
          const input = document.querySelector(${JSON.stringify(input)});
          if (!input) return { ok: false, reason: 'search input missing' };
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, ${JSON.stringify(config.query ?? "")});
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 350));
          const overlay = document.querySelector(${JSON.stringify(overlay)});
          const options = overlay ? Array.from(overlay.querySelectorAll('[role="option"]')) : [];
          return {
            ok: true,
            resultCount: options.length,
            results: options.slice(0, 3).map((option) => ({
              text: (option.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
              selected: option.getAttribute('aria-selected'),
            })),
            empty: Boolean(overlay && overlay.querySelector('.folio-search-empty')),
          };
        })()`,
      );
      const closed = await evaluate(
        sessionId,
        `(async () => {
          const input = document.querySelector(${JSON.stringify(input)});
          if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 350));
          return { overlayPresent: Boolean(document.querySelector(${JSON.stringify(overlay)})) };
        })()`,
      );
      const state = await evaluate(sessionId, NAV_STATE);
      log(
        `[search]   ${queryResult.resultCount ?? 0} results for "${config.query ?? ""}" -> overlay closed=${closed.overlayPresent === false}`,
      );
      return {
        step: "desktop: 搜索 overlay",
        opened,
        openState,
        query: config.query ?? "",
        queryResult,
        closed,
        state,
      };
    };

    // ---- desktop 1440x900 ------------------------------------------------
    const desktop = await openPage("desktop-1440x900", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await goto(desktop, `${origin}${START_PATH}`);
    const desktopLight = await evaluate(desktop, MEASURE);
    const desktopLightShot = await screenshot(desktop, "desktop-1440-light");
    const desktopDom = await evaluate(desktop, "document.getElementById('root').outerHTML");
    writeFileSync(join(resultsDir, "dom-desktop-1440-light.html"), desktopDom, "utf8");

    const desktopInteractions = [];
    desktopInteractions.push(
      await clickAndRead(desktop, INTERACTIONS.desktopToc.selector, INTERACTIONS.desktopToc.label),
    );
    desktopInteractions.push(
      await clickAndRead(desktop, INTERACTIONS.desktopSidebar.selector, INTERACTIONS.desktopSidebar.label),
    );
    desktopInteractions.push(
      await clickAndRead(desktop, ".folio-page-nav__next", "desktop: pager next from /docs/intro"),
    );
    desktopInteractions.push(
      await clickAndRead(desktop, ".folio-page-nav__previous", "desktop: pager previous"),
    );

    const desktopSearch = SEARCH ? await searchProbe(desktop, SEARCH) : null;

    await goto(desktop, `${origin}${START_PATH}`);
    const desktopTheme = await toggleTheme(desktop, "desktop: theme toggle to dark");
    const desktopDark = await evaluate(desktop, MEASURE);
    const desktopDarkShot = await screenshot(desktop, "desktop-1440-dark");

    // ---- mobile 375x812 --------------------------------------------------
    const mobile = await openPage("mobile-375x812", {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: 375,
      screenHeight: 812,
    });
    await goto(mobile, `${origin}${START_PATH}`);
    const mobileLight = await evaluate(mobile, MEASURE);
    const mobileLightShot = await screenshot(mobile, "mobile-375-light");
    // The rendered DOM is viewport-independent (only CSS media queries differ),
    // so one desktop DOM dump plus the drawer dump is enough evidence.

    const mobileInteractions = [];
    // 1. Open the sidebar drawer from the mobile tool bar.
    const drawerOpen = await clickAndRead(mobile, ".folio-docs-mobile-bar button:nth-of-type(1)", "mobile: open 菜单 drawer");
    const drawerState = await evaluate(mobile, MEASURE);
    const drawerShot = await screenshot(mobile, "mobile-375-drawer-open");
    writeFileSync(
      join(resultsDir, "dom-mobile-375-drawer-open.html"),
      await evaluate(mobile, "document.getElementById('root').outerHTML"),
      "utf8",
    );
    mobileInteractions.push({ ...drawerOpen, drawer: drawerState.mobileMenu.drawer, overlay: drawerState.mobileMenu.overlay, overflow: drawerState.layout.overflow });
    // 2. Close it with the drawer's own 关闭 control (no navigation).
    mobileInteractions.push(await clickAndRead(mobile, ".folio-docs-drawer__head button", "mobile: close drawer via 关闭"));
    // 3. Reopen and actually navigate to another document.
    await clickAndRead(mobile, ".folio-docs-mobile-bar button:nth-of-type(1)", "mobile: reopen 菜单 drawer");
    mobileInteractions.push(
      await clickAndRead(mobile, INTERACTIONS.drawerDoc.selector, INTERACTIONS.drawerDoc.label),
    );
    // 4. Open the in-page navigation panel and jump to a heading.
    const tocOpen = await clickAndRead(mobile, ".folio-docs-mobile-bar button:nth-of-type(2)", "mobile: open 页面导航 panel");
    const tocState = await evaluate(mobile, MEASURE);
    const tocShot = await screenshot(mobile, "mobile-375-toc-open");
    mobileInteractions.push({ ...tocOpen, mobileToc: tocState.mobileMenu.mobileToc, overflow: tocState.layout.overflow });
    mobileInteractions.push(
      await clickAndRead(mobile, INTERACTIONS.mobileTocLink.selector, INTERACTIONS.mobileTocLink.label),
    );
    // 5. Reopen and close with the panel's own 关闭 control.
    await clickAndRead(mobile, ".folio-docs-mobile-bar button:nth-of-type(2)", "mobile: reopen 页面导航 panel");
    mobileInteractions.push(await clickAndRead(mobile, ".folio-mobile-toc__head button", "mobile: close 页面导航 panel via 关闭"));

    await goto(mobile, `${origin}${START_PATH}`);
    const mobileTheme = await toggleTheme(mobile, "mobile: theme toggle to dark");
    const mobileDark = await evaluate(mobile, MEASURE);
    const mobileDarkShot = await screenshot(mobile, "mobile-375-dark");

    // ---- system preference path (no stored choice) ----------------------
    const systemPage = await openPage("desktop-system-dark", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-color-scheme", value: "dark" }] },
      systemPage,
    );
    await cdp.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: "try { localStorage.removeItem('folio-theme'); } catch (error) {}" },
      systemPage,
    );
    await goto(systemPage, `${origin}${START_PATH}`);
    const systemDark = await evaluate(systemPage, MEASURE);
    // No screenshot: the resulting state is identical to desktop-1440-dark.png,
    // which is already captured; only the route to it differs.

    acceptance.browser.result = {
      desktop: { light: desktopLight, dark: desktopDark, interactions: desktopInteractions, theme: desktopTheme, search: desktopSearch, screenshots: [desktopLightShot, desktopDarkShot] },
      mobile: { light: mobileLight, dark: mobileDark, interactions: mobileInteractions, theme: mobileTheme, screenshots: [mobileLightShot, mobileDarkShot, drawerShot, tocShot] },
      systemDark,
    };

    // ---- derived checks --------------------------------------------------
    const pageChecks = [
      { label: "desktop", light: desktopLight, dark: desktopDark, interactions: desktopInteractions },
      { label: "mobile", light: mobileLight, dark: mobileDark, interactions: mobileInteractions },
    ];
    for (const { label, light, dark, interactions } of pageChecks) {
      const overflow = light.layout.overflow;
      check(
        `${label}-no-horizontal-overflow`,
        overflow.horizontal || overflow.offenders.length ? "FAIL" : "PASS",
        `page scrollWidth/viewport = ${overflow.documentScrollWidth}/${light.viewport.width} (dark ${dark.layout.overflow.documentScrollWidth}); page-level escapees=${overflow.offenders.length}` +
          (overflow.offenders.length
            ? ` -> ${overflow.offenders.map((item) => `${item.tag}.${item.className.split(" ")[0]}[${item.left}..${item.right}]`).join(", ")}`
            : "") +
          `; scroll-contained=${overflow.contained.length}` +
          (overflow.contained.length
            ? ` (${overflow.contained[0].container} ${overflow.contained[0].containerScrollWidth}/${overflow.contained[0].containerClientWidth}, overflow-x:${overflow.contained[0].containerOverflowX})`
            : "") +
          `; silently clipped=${overflow.clipped.length}`,
      );
      check(
        `${label}-no-overlap`,
        light.layout.overlap.headerOverlapsH1 || light.layout.overlap.sidebarOverlapsMain || light.layout.overlap.tocOverlapsMain
          ? "FAIL"
          : "PASS",
        `header/h1=${light.layout.overlap.headerOverlapsH1}, sidebar/main=${light.layout.overlap.sidebarOverlapsMain}, toc/main=${light.layout.overlap.tocOverlapsMain}, h1 starts ${light.layout.overlap.h1BelowHeader}px below the header`,
      );
      check(
        `${label}-dark-theme-applied`,
        light.theme.attribute !== dark.theme.attribute && dark.theme.attribute === "dark" ? "PASS" : "FAIL",
        `light: theme=${light.theme.attribute} body=${light.readability.bodyBackground["background-color"]} text=${light.paragraph?.style.color}; ` +
          `dark: theme=${dark.theme.attribute} body=${dark.readability.bodyBackground["background-color"]} text=${dark.paragraph?.style.color}; stored=${dark.theme.stored}, color-scheme=${dark.theme.colorScheme}`,
      );
      const unusable = interactions.filter((item) => !item.clicked?.ok || item.state?.pathname === undefined);
      check(
        `${label}-interactions`,
        unusable.length ? "FAIL" : "PASS",
        `${interactions.length} interactions executed, ${unusable.length} unusable`,
        { interactions: interactions.map((item) => ({ step: item.step, clicked: item.clicked, pathname: item.state?.pathname, hash: item.state?.hash, h1: item.state?.h1, tocActiveHref: item.state?.tocActiveHref })) },
      );
    }

    if (desktopSearch) {
      const searchOk =
        desktopSearch.openState.overlayVisible &&
        desktopSearch.openState.inputPresent &&
        desktopSearch.queryResult.resultCount >= (SEARCH.minResults ?? 1) &&
        desktopSearch.closed.overlayPresent === false;
      check(
        "desktop-search",
        searchOk ? "PASS" : "FAIL",
        `搜索 trigger opens the overlay (visible=${desktopSearch.openState.overlayVisible}, focused=${desktopSearch.openState.focused}); query "${desktopSearch.query}" returned ${desktopSearch.queryResult.resultCount} option(s); Escape closes it=${desktopSearch.closed.overlayPresent === false}`,
      );
    }

    // Look interactions up by step label rather than index so inserting a step
    // cannot silently rebind an assertion to the wrong outcome.
    const findStep = (fragment) => mobileInteractions.find((item) => item.step.includes(fragment));
    const drawer = findStep("open 菜单")?.drawer;
    const drawerCloseByButton = findStep("close drawer")?.state;
    const drawerSelect = findStep("select doc")?.state;
    check(
      "mobile-drawer",
      drawer &&
        drawer.links.length >= 3 &&
        drawerCloseByButton?.drawerPresent === false &&
        drawerSelect?.pathname === INTERACTIONS.drawerDoc.expectedPath &&
        drawerSelect?.drawerPresent === false
        ? "PASS"
        : "FAIL",
      `opened ${drawer?.links?.length ?? 0} links (${drawer?.rect?.width ?? 0}x${drawer?.rect?.height ?? 0}px, overlay=${findStep("open 菜单")?.overlay?.background ?? "none"}); 关闭 closes it=${drawerCloseByButton?.drawerPresent === false}; selecting a document routes to ${drawerSelect?.pathname} and closes=${drawerSelect?.drawerPresent === false}`,
    );
    const tocPanel = findStep("open 页面导航")?.mobileToc;
    const tocSelect = findStep("select heading")?.state;
    const tocCloseByButton = findStep("close 页面导航")?.state;
    check(
      "mobile-toc",
      tocPanel &&
        tocPanel.links.length >= 3 &&
        tocSelect?.mobileTocPresent === false &&
        Boolean(tocSelect?.hash) &&
        tocCloseByButton?.mobileTocPresent === false
        ? "PASS"
        : "FAIL",
      `opened ${tocPanel?.links?.length ?? 0} headings (${tocPanel?.rect?.width ?? 0}x${tocPanel?.rect?.height ?? 0}px); selecting a heading sets hash ${tocSelect?.hash} and closes=${tocSelect?.mobileTocPresent === false}; 关闭 closes=${tocCloseByButton?.mobileTocPresent === false}`,
    );
    check(
      "mobile-dark-panel-closed",
      mobileDark.mobileMenu.panelPresent === false && mobileTheme.via === "mobile-panel" ? "PASS" : "FAIL",
      `theme reached dark through the mobile panel (${mobileTheme.via}) and the panel is closed afterwards (panelPresent=${mobileDark.mobileMenu.panelPresent})`,
    );
    check(
      "system-theme-default",
      systemDark.theme.attribute === "dark" && systemDark.theme.prefersDark ? "PASS" : "FAIL",
      `no stored choice + prefers-color-scheme: dark -> theme=${systemDark.theme.attribute}, prefersDark=${systemDark.theme.prefersDark}, body=${systemDark.readability.bodyBackground["background-color"]}`,
    );

    const barButtons = mobileLight.layout.mobileBar.buttons;
    const minHeight = Math.min(...barButtons.map((button) => button.rect.height));
    const drawerCloseSize = findStep("open 菜单")?.drawer?.closeButton;
    check(
      "mobile-tap-target-size",
      minHeight >= 24 ? "PASS" : "WARN",
      `mobile tool-bar buttons: ${barButtons.map((button) => `${button.text} ${button.rect.width}x${button.rect.height}`).join(", ")}; drawer 关闭 ${drawerCloseSize ? `${drawerCloseSize.width}x${drawerCloseSize.height}` : "n/a"}; smallest height ${Number.isFinite(minHeight) ? minHeight : "n/a"}px — 44px is the comfortable target and 24px the WCAG 2.2 minimum (the spacing exception may apply); recorded as an observation, not a blocker`,
    );

    check(
      "documentation-structure",
      desktopLight.layout.sidebar.links.length >= 3 &&
        desktopLight.layout.toc.items.length >= 3 &&
        desktopLight.layout.pager.links.length >= 2 &&
        desktopLight.content.tableCount >= 1 &&
        desktopLight.content.codeBlockCount >= 1
        ? "PASS"
        : "FAIL",
      `sidebar=${desktopLight.layout.sidebar.links.length} links across sections [${desktopLight.layout.sidebar.sections.join(" / ")}], toc=${desktopLight.layout.toc.items.length}, pager=[${desktopLight.layout.pager.links.map((l) => l.text).join(" | ")}], tables=${desktopLight.content.tableCount}, code=${desktopLight.content.codeBlockCount}`,
    );
    check(
      "readability-metrics",
      (desktopLight.paragraph?.contrast ?? 0) >= 4.5 && (desktopLight.readability.h1Contrast ?? 0) >= 3 ? "PASS" : "FAIL",
      `desktop body ${desktopLight.paragraph?.style["font-size"]}/${desktopLight.paragraph?.style["line-height"]} contrast ${desktopLight.paragraph?.contrast}:1, h1 ${desktopLight.heading.style["font-size"]} contrast ${desktopLight.readability.h1Contrast}:1, dark body contrast ${darkContrast(desktopDark)}, mobile h1 ${mobileLight.heading.style["font-size"]}, mobile body ${mobileLight.paragraph?.style["font-size"]}`,
    );
    // ---- static no-JS phase (scenario opt-in) ---------------------------
    if (STATIC) {
      const viteBin = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
      const staticBuild = runNode([viteBin, "build", "--logLevel", "warn"], consumerDir, {
        allowFailure: true,
        env: STATIC.buildEnv ?? {},
      });
      if (staticBuild.status !== 0) {
        fail(
          "static-build",
          `staticRoutes build failed with exit code ${staticBuild.status}\n` +
            `--- stdout ---\n${(staticBuild.stdout ?? "").trim()}\n` +
            `--- stderr ---\n${(staticBuild.stderr ?? "").trim()}`,
        );
      }
      const staticDistDir = join(consumerDir, "dist");
      const staticFiles = [];
      const walk = (directory, prefix = "") => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const full = join(directory, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(full, relativePath);
          else staticFiles.push(relativePath);
        }
      };
      walk(staticDistDir);
      const staticCssFiles = staticFiles.filter((file) => file.endsWith(".css"));
      const staticCssText = staticCssFiles
        .map((file) => readFileSync(join(staticDistDir, file), "utf8"))
        .join("\n");
      const routeDefinitions = STATIC.routes ?? [{ path: "/", text: [] }];
      const routeEvidence = routeDefinitions.map((definition) => {
        const route = typeof definition === "string" ? definition : definition.path;
        const expectedText = typeof definition === "string" ? [] : definition.text ?? [];
        const expectedClasses =
          typeof definition === "string" ? [] : definition.classes ?? STATIC.expectedClasses;
        const relativeRoute = route.replace(/^\/+|\/+$/g, "");
        const file = relativeRoute ? `${relativeRoute}/index.html` : "index.html";
        const full = join(staticDistDir, file);
        const html = existsSync(full) ? readFileSync(full, "utf8") : null;
        // The built template keeps the module script in <head>; the pre-rendered
        // body replaces the empty #root in <body>, so the root close is the last
        // </div> before </body>.
        const rootInner = html ? /<div id="root">([\s\S]*)<\/div>\s*<\/body>/.exec(html) : null;
        return {
          route,
          file,
          exists: Boolean(html),
          bytes: html ? Buffer.byteLength(html, "utf8") : 0,
          preRenderedRoot: Boolean(rootInner && rootInner[1].trim().length > 0),
          missingText: expectedText.filter((item) => !html || !html.includes(item)),
          expectedClasses,
          classesPresent: Boolean(html) && expectedClasses.every((name) => html.includes(name)),
          stylesheetLinks: html
            ? Array.from(html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)).map((match) => match[1])
            : [],
          pagerHrefs: html
            ? Array.from(html.matchAll(/class="folio-page-nav__[^"]*" href="([^"]+)"/g)).map((match) => match[1])
            : [],
        };
      });
      const brokenRoute = routeEvidence.find(
        (item) => !item.exists || item.missingText.length > 0 || !item.classesPresent || !item.preRenderedRoot,
      );
      check(
        "static-html-routes",
        brokenRoute ? "FAIL" : "PASS",
        `${routeEvidence.length} pre-rendered route files under dist; ` +
          routeEvidence
            .map(
              (item) =>
                `${item.route}->${item.file}${item.exists ? ` (${item.bytes}B, root=${item.preRenderedRoot}, classes=${item.classesPresent})` : " MISSING"}`,
            )
            .join("; "),
        { routes: routeEvidence },
      );

      const staticDesktopPage = await openStaticPage("static-desktop-1440", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await goto(staticDesktopPage, `${origin}${STATIC.startPath ?? "/docs/second/"}`);
      const staticDesktop = await evaluate(staticDesktopPage, STATIC_MEASURE);
      const staticDesktopShot = await screenshot(staticDesktopPage, "static-desktop-1440-light");
      await cdp.send(
        "Emulation.setEmulatedMedia",
        { features: [{ name: "prefers-color-scheme", value: "dark" }] },
        staticDesktopPage,
      );
      await sleep(300);
      const staticDesktopSystemDark = await evaluate(staticDesktopPage, STATIC_MEASURE);
      const staticSystemDarkShot = await screenshot(staticDesktopPage, "static-desktop-1440-system-dark");

      const staticMobilePage = await openStaticPage("static-mobile-375", {
        width: 375,
        height: 812,
        deviceScaleFactor: 1,
        mobile: true,
        screenWidth: 375,
        screenHeight: 812,
      });
      await goto(staticMobilePage, `${origin}${STATIC.startPath ?? "/docs/second/"}`);
      const staticMobile = await evaluate(staticMobilePage, STATIC_MEASURE);
      const staticMobileShot = await screenshot(staticMobilePage, "static-mobile-375-light");

      acceptance.static = {
        build: {
          command: "node node_modules/vite/bin/vite.js build",
          env: STATIC.buildEnv ?? {},
          files: staticFiles,
          htmlFiles: staticFiles.filter((file) => file.endsWith(".html")),
          cssFiles: staticCssFiles,
          cssBytes: staticCssFiles.reduce(
            (total, file) => total + statSync(join(staticDistDir, file)).size,
            0,
          ),
          officialSiteCssPresent:
            staticCssText.includes(".site-article-proof") ||
            staticCssText.includes(".showcase-home") ||
            staticCssText.includes(".claude-visual"),
          defaultSelectorsPresent: [
            ".folio-docnav",
            ".folio-toc",
            ".folio-page-nav",
            ".folio-static-doc-menu",
            ".folio-markdown",
          ].filter((selector) => staticCssText.includes(selector)),
          routes: routeEvidence,
        },
        browser: {
          desktop: staticDesktop,
          desktopSystemDark: staticDesktopSystemDark,
          mobile: staticMobile,
          screenshots: [staticDesktopShot, staticSystemDarkShot, staticMobileShot],
        },
      };

      const jsOff =
        staticDesktop.js.consumerRoots === null &&
        staticDesktop.classes.reactShell === false &&
        staticDesktop.theme.attribute === null &&
        staticDesktop.root.childElementCount > 0 &&
        staticDesktop.root.emptyShell === false;
      check(
        "static-no-js",
        jsOff ? "PASS" : "FAIL",
        `script execution disabled: consumer marker=${staticDesktop.js.consumerRoots}, React shell present=${staticDesktop.classes.reactShell}, theme attribute=${staticDesktop.theme.attribute}, #root children=${staticDesktop.root.childElementCount}, empty shell=${staticDesktop.root.emptyShell}; script tags in HTML=${staticDesktop.js.scriptTags.length}, JS resources fetched=${staticDesktop.js.jsResourcesLoaded.length} (a module preload may still be fetched; the consumer marker and React shell are the execution proof)`,
      );

      const staticNavOk =
        staticDesktop.classes.runtimeStatic &&
        staticDesktop.classes.docsShell &&
        staticDesktop.classes.docnav &&
        staticDesktop.classes.toc &&
        staticDesktop.classes.pager &&
        staticDesktop.classes.markdown &&
        (staticDesktop.nav?.links.length ?? 0) >= 4 &&
        (staticDesktop.nav?.rect?.width ?? 0) > 0 &&
        (staticDesktop.nav?.sections.length ?? 0) >= 2 &&
        (staticDesktop.toc?.links.length ?? 0) >= 3 &&
        (staticDesktop.toc?.rect?.width ?? 0) > 0 &&
        (staticDesktop.pager?.links.length ?? 0) >= 1 &&
        (staticDesktop.nav?.links.some((link) => link.current === "page") ?? false);
      check(
        "static-navigation",
        staticNavOk ? "PASS" : "FAIL",
        `static classes ${JSON.stringify(staticDesktop.classes)}; nav=${staticDesktop.nav?.links.length ?? 0} links in [${(staticDesktop.nav?.sections ?? []).join(" / ")}] at ${staticDesktop.nav?.rect?.width ?? 0}x${staticDesktop.nav?.rect?.height ?? 0}, toc=${staticDesktop.toc?.links.length ?? 0} headings at ${staticDesktop.toc?.rect?.width ?? 0}x${staticDesktop.toc?.rect?.height ?? 0}, pager=[${(staticDesktop.pager?.links ?? []).map((link) => `${link.className}:${link.href}`).join(" | ")}]`,
      );

      const staticContent = staticDesktop.content;
      const staticContentOk =
        (staticContent?.headingCount ?? 0) >= 3 &&
        (staticContent?.paragraphCount ?? 0) >= 2 &&
        (staticContent?.tableCount ?? 0) >= 1 &&
        (staticContent?.codeBlockCount ?? 0) >= 1 &&
        (staticContent?.blockquoteCount ?? 0) >= 1;
      check(
        "static-content",
        staticContentOk ? "PASS" : "FAIL",
        `pre-rendered article: headings=${staticContent?.headingCount ?? 0}, paragraphs=${staticContent?.paragraphCount ?? 0}, tables=${staticContent?.tableCount ?? 0}, code=${staticContent?.codeBlockCount ?? 0}, quotes=${staticContent?.blockquoteCount ?? 0}; excerpt="${(staticContent?.excerpt ?? "").slice(0, 80)}"`,
      );

      const staticCssOk =
        staticDesktop.stylesheets.count > 0 &&
        staticDesktop.stylesheets.links.length > 0 &&
        acceptance.static.build.officialSiteCssPresent === false &&
        acceptance.static.build.defaultSelectorsPresent.length === 5 &&
        staticDesktop.heading?.style["font-size"] === "44px" &&
        staticDesktop.paragraph?.style["font-size"] === "16px" &&
        staticDesktop.body?.["background-color"] === "rgb(250, 249, 245)";
      check(
        "static-default-css",
        staticCssOk ? "PASS" : "FAIL",
        `stylesheets=${staticDesktop.stylesheets.count} (${staticDesktop.stylesheets.links.join(", ")}); CSS selectors present=${acceptance.static.build.defaultSelectorsPresent.join(",")}; official-site selectors=${acceptance.static.build.officialSiteCssPresent}; h1 ${staticDesktop.heading?.style["font-size"]} / body ${staticDesktop.paragraph?.style["font-size"]} / canvas ${staticDesktop.body?.["background-color"]}; contrast h1=${staticDesktop.heading?.contrast}:1 body=${staticDesktop.paragraph?.contrast}:1`,
      );

      const staticMobileOk =
        staticMobile.viewport.scrollWidth === staticMobile.viewport.width &&
        staticMobile.classes.runtimeStatic &&
        staticMobile.classes.mobileBarStatic &&
        (staticMobile.pager?.rect?.width ?? 0) > 0 &&
        (staticMobile.content?.paragraphCount ?? 0) >= 2;
      check(
        "static-mobile-layout",
        staticMobileOk ? "PASS" : "FAIL",
        `375px static page: scrollWidth/viewport=${staticMobile.viewport.scrollWidth}/${staticMobile.viewport.width}, mobile bar static=${staticMobile.classes.mobileBarStatic}, static menus=${staticMobile.classes.staticMenus}, pager=${staticMobile.pager?.rect?.width ?? 0}x${staticMobile.pager?.rect?.height ?? 0}, paragraphs=${staticMobile.content?.paragraphCount ?? 0}`,
      );

      check(
        "static-theme-no-js",
        staticDesktopSystemDark.body?.["background-color"] === "rgb(250, 249, 245)" ? "WARN" : "PASS",
        `static HTML has no data-folio-theme attribute (attribute=${staticDesktop.theme.attribute}); with JS disabled and prefers-color-scheme: dark the canvas stays ${staticDesktopSystemDark.body?.["background-color"]} (${staticDesktopSystemDark.theme.attribute ?? "no attribute"}). Dark static output is a known gap recorded as an observation, not silently passed.`,
      );
    }
  } finally {
    try {
      cdp?.socket.close();
    } catch {
      // ignore
    }
    chrome.kill();
    server.close();
  }

  acceptance.console = consoleEntries;
  const errorEntries = consoleEntries.filter((entry) => entry.type !== "warning");
  check(
    "console-errors",
    errorEntries.length === 0 ? "PASS" : "FAIL",
    errorEntries.length === 0
      ? `no console errors or uncaught exceptions across all browser pages (desktop/mobile/system-preference${STATIC ? " + static no-JS" : ""})`
      : `${errorEntries.length} console errors: ${errorEntries.slice(0, 5).map((entry) => `${entry.page}:${entry.type}:${entry.text}`).join(" | ")}`,
  );

  const summary = {
    generatedAt: acceptance.meta.generatedAt,
    commit,
    passing: acceptance.checks.filter((item) => item.status === "PASS").length,
    failing: acceptance.checks.filter((item) => item.status === "FAIL").length,
  };
  acceptance.summary = summary;
  writeFileSync(join(resultsDir, "acceptance.json"), JSON.stringify(acceptance, null, 2), "utf8");

  log("");
  log(`Summary: ${summary.passing} PASS / ${summary.failing} FAIL`);
  log(`[results] ${join(resultsDir, "acceptance.json")}`);
  log(`[shots]   ${shotsDir}`);

  if (!keepTemp) rmSync(tempRoot, { recursive: true, force: true });
  else log(`[temp]    kept at ${tempRoot}`);
}

function darkContrast(measurement) {
  const value = measurement?.paragraph?.contrast;
  return value == null ? "n/a" : `${value}:1`;
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
