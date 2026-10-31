#!/usr/bin/env node
// FOL-007 host-impact harness.
//
// Reproduces the measurement behind docs/research/fol-007-css-host-impact.md:
// it packs the real `@uichat-mira/folio` tarball, takes the published
// `dist/styles.css` out of it, builds a minimal branded host page in several
// cascade orders, embeds real `FolioMarkdown` output into that page, and reads
// the resulting computed styles and screenshots from a headless Chrome over the
// DevTools protocol.
//
// It never imports Folio internals: the stylesheet comes from the tarball and
// the embedded Markdown comes from the same published `dist/index.js` build.
//
// Usage: node docs/research/fol-007/run.mjs [--keep]
// Requires a local Chrome/Edge; set FOLIO007_CHROME to override the search.
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const resultsDir = join(scriptDir, "results");
const keepTemp = process.argv.includes("--keep");
const isWindows = process.platform === "win32";

const CHROME_CANDIDATES = [
  process.env.FOLIO007_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function log(line) {
  console.log(line);
}

function fail(stage, message) {
  throw new Error(`[${stage}] ${message}`);
}

function runNpm(args, cwd) {
  const npm = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const command = existsSync(npm) ? process.execPath : isWindows ? "npm.cmd" : "npm";
  const commandArgs = existsSync(npm) ? [npm, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: !existsSync(npm) && isWindows,
    timeout: 600_000,
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });
  if (result.status !== 0) {
    fail(
      "setup",
      `${commandArgs.join(" ")} failed with exit code ${result.status}\n${(result.stdout ?? "").trim()}\n${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    fail("browser", `no Chrome/Edge found; tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Minimal Chrome DevTools Protocol client (Node 22+ ships a WebSocket client).
// ---------------------------------------------------------------------------
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.waiters = new Map();
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
    const waiters = this.waiters.get(message.method);
    if (!waiters) return;
    this.waiters.delete(message.method);
    for (const waiter of waiters) waiter(message.params);
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
      const waiters = this.waiters.get(method) ?? [];
      waiters.push(resolvePromise);
      this.waiters.set(method, waiters);
    });
  }
}

async function waitForEndpoint(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise((r) => setTimeout(r, 200));
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
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function serve(directory) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(directory, path);
    if (!file.startsWith(directory) || !existsSync(file)) {
      response.writeHead(404);
      response.end("not found");
      return;
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

async function main() {
  const chromePath = findChrome();
  log(`[browser]  ${chromePath}`);

  const tempRoot = mkdtempSync(join(tmpdir(), "folio007-"));
  const tarballDir = join(tempRoot, "tarball");
  const unpackDir = join(tempRoot, "unpack");
  const wwwDir = join(tempRoot, "www");
  for (const dir of [tarballDir, unpackDir, wwwDir, resultsDir, join(resultsDir, "screenshots")]) {
    mkdirSync(dir, { recursive: true });
  }

  // 1. Real artifacts only: build, pack, and take the published stylesheet.
  runNpm(["run", "build", "-w", "@uichat-mira/folio"], repoRoot);
  runNpm(
    ["pack", "--ignore-scripts", "--pack-destination", tarballDir, "--json"],
    join(repoRoot, "packages", "folio"),
  );
  const tarball = readdirSync(tarballDir).find((file) => file.endsWith(".tgz"));
  if (!tarball) fail("setup", "npm pack produced no tarball");
  const tarballPath = join(tarballDir, tarball);
  const extract = spawnSync("tar", ["-xzf", tarballPath, "-C", unpackDir, "package/dist/styles.css"], {
    encoding: "utf8",
  });
  if (extract.status !== 0) {
    fail("setup", `could not extract dist/styles.css: ${(extract.stderr ?? "").trim()}`);
  }

  const publishedCss = join(unpackDir, "package", "dist", "styles.css");
  const builtCss = join(repoRoot, "packages", "folio", "dist", "styles.css");
  const sourceCss = join(repoRoot, "packages", "folio", "src", "styles.css");
  const hashes = {
    "tarball package/dist/styles.css": sha256(publishedCss),
    "repo packages/folio/dist/styles.css": sha256(builtCss),
    "repo packages/folio/src/styles.css": sha256(sourceCss),
  };
  const unique = new Set(Object.values(hashes));
  if (unique.size !== 1) {
    fail("setup", `published stylesheet is not the built/source file: ${JSON.stringify(hashes, null, 2)}`);
  }
  log(`[tarball]  ${tarball} sha256=${sha256(tarballPath)}`);
  log(`[css]      dist/styles.css == src/styles.css sha256=${[...unique][0]}`);

  // 2. Build the official demo site so mode A is measured on a real FolioApp.
  // It is served from the server root because its built HTML references Vite
  // assets with absolute `/assets/...` URLs.
  runNpm(["run", "build", "-w", "@uichat-mira/folio-site"], repoRoot);
  cpSync(join(repoRoot, "apps", "site", "dist"), wwwDir, { recursive: true });

  // 3. Real FolioMarkdown markup from the same published build.
  const folio = await import(pathToFileURL(join(repoRoot, "packages", "folio", "dist", "index.js")).href);
  const markdownHtml = folio.renderFolioMarkdown(
    [
      "## Embedded Folio content",
      "",
      "This article is rendered by Folio inside a branded host page. A",
      "[content link](https://example.test/embedded) lives here too.",
      "",
      "> A blockquote picked up from the host page's typography.",
      "",
      "- list item one",
      "- list item two",
    ].join("\n"),
  );
  const embed = `<article class="folio-markdown">${markdownHtml}</article>`;

  // 4. Variants: identical host page, different stylesheet placement.
  const template = readFileSync(join(scriptDir, "host.html"), "utf8");
  const linkTag = '<link rel="stylesheet" href="/host/folio.css" />';
  const variants = [
    { name: "host-before", folioCss: "none", embed: "" },
    { name: "host-folio-after", folioCss: "after", embed },
    { name: "host-folio-first", folioCss: "before", embed },
  ];
  mkdirSync(join(wwwDir, "host"), { recursive: true });
  cpSync(publishedCss, join(wwwDir, "host", "folio.css"));
  for (const variant of variants) {
    const html = template
      .replace("<!--FOLIO_BEFORE-->", variant.folioCss === "before" ? linkTag : "")
      .replace("<!--FOLIO_AFTER-->", variant.folioCss === "after" ? linkTag : "")
      .replace("<!--FOLIO_EMBED-->", variant.embed)
      .replace('<html lang="en">', `<html lang="en" data-variant="${variant.name}">`);
    mkdirSync(join(wwwDir, "host", variant.name), { recursive: true });
    writeFileSync(join(wwwDir, "host", variant.name, "index.html"), html, "utf8");
  }

  // 5. Serve and drive Chrome.
  const server = await serve(wwwDir);
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const profile = mkdtempSync(join(tmpdir(), "folio007-chrome-"));
  const debugPort = 9000 + Math.floor(Math.random() * 500);
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

  const measurements = {
    meta: {
      generatedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      gitHead: spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim(),
      gitDirty:
        spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim() !== "",
      tarball: `${tarball} sha256=${sha256(tarballPath)}`,
      stylesheetHashes: hashes,
    },
    browser: chromePath,
    variants: {},
    site: null,
  };
  let cdp;
  try {
    const version = await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`);
    measurements.browser = `${version.Browser} (${version["User-Agent"]})`;
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((r, reject) => {
      socket.onopen = r;
      socket.onerror = () => reject(new Error("DevTools socket failed"));
    });
    cdp = new Cdp(socket);

    const measurePage = async (url, expression) => {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 900, height: 720, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await loaded;
      await new Promise((r) => setTimeout(r, 400));
      const evaluation = await cdp.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (evaluation.exceptionDetails) {
        fail("measure", JSON.stringify(evaluation.exceptionDetails));
      }
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      return { value: evaluation.result.value, screenshot: shot.data };
    };

    for (const variant of variants) {
      const { value, screenshot } = await measurePage(
        `${origin}/host/${variant.name}/`,
        `document.getElementById("results").textContent`,
      );
      measurements.variants[variant.name] = JSON.parse(value);
      writeFileSync(join(resultsDir, "screenshots", `${variant.name}.png`), Buffer.from(screenshot, "base64"));
      log(`[measure]  ${variant.name}`);
    }

    const siteExpression = `(() => {
      const read = (element, properties) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        const out = {};
        for (const property of properties) out[property] = style.getPropertyValue(property);
        return out;
      };
      const root = getComputedStyle(document.documentElement);
      const link = document.querySelector("a");
      const button = document.querySelector("button");
      const shell = document.querySelector(".folio-shell");
      const generic = document.querySelector("main") || document.querySelector("div");
      return {
        body: read(document.body, ["margin-top", "background-color", "color", "font-family"]),
        firstLink: link ? { ...read(link, ["color", "text-decoration-line"]), href: link.getAttribute("href") } : null,
        button: read(button, ["font-family", "font-size"]),
        shell: shell ? { ...read(shell, ["box-sizing"]), className: shell.className } : null,
        generic: generic ? { ...read(generic, ["box-sizing"]), tagName: generic.tagName, className: generic.className } : null,
        tokens: {
          folioCanvas: root.getPropertyValue("--folio-canvas").trim(),
          folioFontSans: root.getPropertyValue("--folio-font-sans").trim(),
        },
      };
    })()`;
    const site = await measurePage(`${origin}/`, siteExpression);
    measurements.site = site.value;
    writeFileSync(join(resultsDir, "screenshots", "folio-site.png"), Buffer.from(site.screenshot, "base64"));
    log("[measure]  folio-site (mode A)");
  } finally {
    try {
      cdp?.socket.close();
    } catch {
      // ignore
    }
    chrome.kill();
    server.close();
  }

  writeFileSync(join(resultsDir, "measurements.json"), JSON.stringify(measurements, null, 2), "utf8");
  log(`\n[results]  ${join(resultsDir, "measurements.json")}`);
  log(`[results]  ${join(resultsDir, "screenshots")}`);

  // 6. Compact before/after table on stdout so the run is self-explanatory.
  const before = measurements.variants["host-before"];
  for (const name of ["host-folio-after", "host-folio-first"]) {
    const after = measurements.variants[name];
    log(`\n=== ${name} vs host-before ===`);
    for (const section of ["root", "body", "paragraph", "link", "button", "input", "box", "hostCard"]) {
      for (const property of Object.keys(after[section] ?? {})) {
        const a = before[section]?.[property];
        const b = after[section]?.[property];
        if (a !== b) log(`  ${section}.${property}: ${a}  ->  ${b}`);
      }
    }
    for (const property of Object.keys(after.tokens)) {
      if (before.tokens[property] !== after.tokens[property]) {
        log(`  tokens.${property}: ${JSON.stringify(before.tokens[property])}  ->  ${JSON.stringify(after.tokens[property])}`);
      }
    }
  }

  if (!keepTemp) rmSync(tempRoot, { recursive: true, force: true });
  else log(`\n[temp]     kept at ${tempRoot}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
