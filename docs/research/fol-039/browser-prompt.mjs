#!/usr/bin/env node
// FOL-039 PWA update-prompt acceptance harness.
//
// Proves, in a real headless Chrome, that the optional Folio PWA integration
// (`folioPwa()` from `@uichat-mira/folio/pwa`, `useFolioPwaUpdate()` and
// `<FolioPwaUpdatePrompt />` from `@uichat-mira/folio/pwa/react`) gives a
// prompt-based update experience on a *real tarball consumer site* whose second
// deployment changes only Markdown/HTML content.
//
// Shape: build the package -> `npm pack` -> install the `.tgz` into a temporary
// Vite + React consumer outside the repository -> build the same site twice
// from two Markdown contents into two output directories -> prove the builds
// differ in `folio-version.json` while every `assets/*.js|css` name and byte is
// identical -> serve deployment v1, register the worker in Chrome, switch the
// served root to v2, trigger an update check, and drive the real prompt
// (`[data-folio-pwa-update-prompt]` / `-dismiss` / `-confirm`) over the DevTools
// protocol, finally proving a blocked worker script is observable through the
// consumer's `onRegisterError` path without breaking the page.
//
// Usage:
//   node docs/research/fol-039/browser-prompt.mjs [--keep]
//
//   --keep  keep the temporary consumer/package directories and print their
//           paths instead of deleting them.
//
// Evidence rule: the default path always builds and packs the current checkout,
// so a PASS is evidence for `${git rev-parse HEAD}` plus the working tree. There
// is no option to substitute a different tarball.
//
// Exits non-zero with a staged `[stage] FAIL` message on any failure, and always
// writes results/acceptance.json (per-check status, timings, tarball sha256, the
// exact commit SHA, both content versions and console errors).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const fixtureDir = join(scriptDir, "consumer");
const resultsDir = join(scriptDir, "results");
const argv = process.argv.slice(2);
const keepTemp = argv.includes("--keep");

const CHROME_CANDIDATES = [
  process.env.FOLIO039_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

// Bounded waits. A publishing update check is one network round trip plus a
// worker install; these are generous enough for a cold machine and short enough
// that a hang is reported instead of waited out.
const PROMPT_TIMEOUT_MS = 45_000;
const RELOAD_TIMEOUT_MS = 30_000;
const REGISTER_TIMEOUT_MS = 30_000;
const REGISTER_ERROR_TIMEOUT_MS = 30_000;

const packageManifest = JSON.parse(
  readFileSync(join(repoRoot, "packages", "folio", "package.json"), "utf8"),
);
const packageName = packageManifest.name;

class HarnessError extends Error {
  constructor(stage, message) {
    super(message);
    this.stage = stage;
  }
}

const fail = (stage, message) => {
  throw new HarnessError(stage, message);
};
const log = (line = "") => console.log(line);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(root, prefix = "") {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(root, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const hasNpmCli = existsSync(npmCli);

function npm(args, cwd, { allowFailure = false, stage = "setup" } = {}) {
  const command = hasNpmCli ? process.execPath : "npm";
  const commandArgs = hasNpmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    timeout: 900_000,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !allowFailure) {
    fail(stage, `${commandArgs.join(" ")} failed with exit code ${result.status}\n${output.trim().slice(-4000)}`);
  }
  return { status: result.status, output };
}

function runNode(args, cwd, { allowFailure = false, stage = "command" } = {}) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 600_000 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 && !allowFailure) {
    fail(stage, `node ${args.join(" ")} failed with exit code ${result.status}\n${output.trim().slice(-4000)}`);
  }
  return { status: result.status, output };
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", timeout: 60_000 });
  return result.status === 0 ? (result.stdout ?? "").trim() : undefined;
}

// ---------------------------------------------------------------------------
// Minimal Chrome DevTools Protocol client (same approach as
// docs/research/fol-014/run.mjs): Node's built-in WebSocket, no automation
// dependency.
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
    for (const handler of this.listeners.get(message.method) ?? []) handler(message.params);
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(method, current.filter((item) => item !== handler));
    };
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
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
    await sleep(200);
  }
  fail("browser", `DevTools endpoint ${url} did not become ready`);
}

// ---------------------------------------------------------------------------
// Static multi-page server. It can switch its document root at runtime (v1 ->
// v2) without touching the browser, answers a directory URL with
// `<dir>/index.html`, serves the generated `404.html` with status 404, and marks
// the deployment-metadata files `no-cache` so a service-worker update check is a
// real revalidation instead of a memory-cache hit.
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const NO_CACHE_NAMES = new Set(["sw.js", "manifest.webmanifest", "folio-version.json"]);

function startServer(state) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("bad request");
      return;
    }
    // Deployment-level fault injection: the harness switches this on for the
    // registration-failure check so `/sw.js` answers 404. A blocked fetch is a
    // page-context decision that does not reliably apply to a service-worker
    // script fetch, while a 404 is answered by the same server the browser is
    // already talking to, so the failure mode is deterministic.
    if (state.failWorkerScript && pathname === "/sw.js") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
      response.end("service worker unavailable (fault injection)");
      return;
    }
    const root = state.root;
    const candidates = pathname.endsWith("/")
      ? [join(root, pathname, "index.html")]
      : [join(root, pathname), join(root, pathname, "index.html")];
    const notFound = join(root, "404.html");

    let file;
    let status = 200;
    for (const candidate of candidates) {
      if (!candidate.startsWith(root)) break;
      if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
      file = candidate;
      break;
    }
    if (!file && existsSync(notFound)) {
      file = notFound;
      status = 404;
    }
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
      response.end("not found");
      return;
    }
    const name = file.slice(file.lastIndexOf("/") + 1);
    const noCache = NO_CACHE_NAMES.has(name) || extname(file) === ".html";
    response.writeHead(status, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": noCache ? "no-cache" : "public, max-age=3600",
      "x-folio-deployment": state.deployment,
    });
    response.end(readFileSync(file));
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

// ---------------------------------------------------------------------------
// In-page probes.
// ---------------------------------------------------------------------------
const NAV_STATE = String.raw`(() => {
  const navEntries = performance.getEntriesByType('navigation');
  const prompt = document.querySelector('[data-folio-pwa-update-prompt]');
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const marker = document.querySelector('[data-content-marker]');
  return {
    url: location.pathname,
    navigationEntries: navEntries.length,
    navigationType: navEntries.length ? navEntries[0].type : null,
    timeOrigin: performance.timeOrigin,
    bootId: window.__folioBootId ?? null,
    mounted: window.__folioPwaMounted === true,
    registered: window.__folioPwaRegistered === true,
    registerError: window.__folioPwaRegisterError ?? null,
    markerText: marker ? (marker.textContent || '').replace(/\s+/g, ' ').trim() : null,
    articleHtmlPresent: Boolean(document.querySelector('#root .folio-markdown')),
    promptPresent: Boolean(prompt),
    promptVisible: visible(prompt),
    promptText: prompt ? (prompt.textContent || '').replace(/\s+/g, ' ').trim() : null,
    confirmPresent: Boolean(document.querySelector('[data-folio-pwa-update-confirm]')),
    dismissPresent: Boolean(document.querySelector('[data-folio-pwa-update-dismiss]')),
    controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    checkAvailable: typeof window.__folioPwaCheck === 'function',
  };
})()`;

const SW_STATE = String.raw`(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const registration = await navigator.serviceWorker.getRegistration();
  return {
    supported: true,
    present: Boolean(registration),
    scope: registration ? registration.scope : null,
    active: registration ? Boolean(registration.active) : false,
    activeScriptUrl: registration && registration.active ? registration.active.scriptURL : null,
    waiting: registration ? Boolean(registration.waiting) : false,
    installing: registration ? Boolean(registration.installing) : false,
    controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null,
  };
})()`;

const CACHE_STATE = String.raw`(async () => {
  const keys = await caches.keys();
  const precacheKeys = keys.filter((key) => key.startsWith('workbox-precache'));
  const entries = [];
  let folioVersion = null;
  let folioVersionRevision = null;
  let folioVersionEntryCount = 0;
  for (const key of precacheKeys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    entries.push({ key, count: requests.length, urls: requests.map((request) => request.url) });
    for (const request of requests) {
      if (!request.url.includes('folio-version.json')) continue;
      folioVersionEntryCount += 1;
      folioVersionRevision = new URL(request.url).searchParams.get('__WB_REVISION__');
      const response = await cache.match(request);
      if (response) folioVersion = await response.json();
    }
  }
  return { keys, precacheKeys, entries, folioVersion, folioVersionRevision, folioVersionEntryCount };
})()`;

function precacheUrls(swText) {
  const match = /precacheAndRoute\(\[([\s\S]*?)\]\s*(?:,|\))/.exec(swText);
  if (!match) return [];
  return [...match[1].matchAll(/url:"([^"]+)"/g)].map((entry) => entry[1]);
}

// ---------------------------------------------------------------------------
async function main() {
  const startedAt = Date.now();
  const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chromePath) fail("browser", `no Chrome found; tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`);

  const commit = git(["rev-parse", "HEAD"]) ?? "unknown";
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const dirty = Boolean(git(["status", "--porcelain"]));

  const acceptance = {
    meta: {
      generatedAt: new Date().toISOString(),
      harness: "docs/research/fol-039/browser-prompt.mjs",
      branch,
      commit,
      dirtyWorkingTree: dirty,
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      chromePath,
      chromeVersion: spawnSync(chromePath, ["--version"], { encoding: "utf8" }).stdout.trim(),
      package: `${packageManifest.name}@${packageManifest.version}`,
      fixture: relative(repoRoot, fixtureDir).replace(/\\/g, "/"),
      commands: {
        buildPackage: "cd packages/folio && npm run build",
        pack: "cd packages/folio && npm pack --ignore-scripts --pack-destination <tmp>",
        install:
          "npm install --no-audit --no-fund <tarball> vite@^7 @vitejs/plugin-react@^5 react@^19 " +
          "react-dom@^19 react-router-dom@^7 @types/react@^19 @types/react-dom@^19 @types/node@^24 " +
          "vite-plugin-pwa@^2 workbox-window@^7.4.1",
        buildSite: "node node_modules/vite/bin/vite.js build --outDir <dir>",
      },
    },
    packageEvidence: {},
    builds: {},
    content: {},
    assets: {},
    deployment: {},
    timings: {},
    checks: [],
    console: [],
    failure: null,
  };

  const check = (id, status, detail, extra = {}) => {
    acceptance.checks.push({ id, status, detail, ...extra });
    log(`[${status.padEnd(10)}] ${id} — ${detail}`);
  };

  mkdirSync(resultsDir, { recursive: true });
  const tempRoot = mkdtempSync(join(tmpdir(), "folio-fol039-"));
  const tarballDir = join(tempRoot, "tarball");
  const consumerDir = join(tempRoot, "consumer");
  mkdirSync(tarballDir, { recursive: true });
  log("FOL-039 PWA prompt acceptance");
  log(`  source:   ${commit}${dirty ? " (working tree dirty)" : ""} on ${branch}`);
  log(`  package:  ${packageManifest.name}@${packageManifest.version}`);
  log(`  browser:  ${chromePath}`);
  log(`  temp:     ${tempRoot}`);
  log("");

  let server;
  let chrome;
  const consoleEntries = [];
  let currentPage = "setup";
  let expectedConsole = false;

  try {
    // 1. Real artifact: build the package and pack it.
    const buildStart = Date.now();
    npm(["run", "build"], join(repoRoot, "packages", "folio"), { stage: "package-build" });
    acceptance.timings.packageBuildMs = Date.now() - buildStart;
    npm(["pack", "--ignore-scripts", "--pack-destination", tarballDir], join(repoRoot, "packages", "folio"), {
      stage: "pack",
    });
    const tarball = readdirSync(tarballDir).find((file) => file.endsWith(".tgz"));
    if (!tarball) fail("pack", "npm pack produced no tarball");
    const tarballPath = join(tarballDir, tarball);
    acceptance.packageEvidence = {
      tarball: relative(repoRoot, tarballPath).startsWith("..") ? tarballPath : relative(repoRoot, tarballPath),
      fileName: tarball,
      sha256: sha256(tarballPath),
      bytes: statSync(tarballPath).size,
      sourceCommit: commit,
      sourceBranch: branch,
    };
    log(`[package]  ${tarball} sha256=${acceptance.packageEvidence.sha256}`);
    check(
      "package-packed-from-source",
      "PASS",
      `npm run build && npm pack produced ${tarball} (${acceptance.packageEvidence.bytes} bytes, ` +
        `sha256 ${acceptance.packageEvidence.sha256}) from ${commit}`,
      { ms: acceptance.timings.packageBuildMs },
    );

    // 2. Independent install outside the repository.
    cpSync(fixtureDir, consumerDir, { recursive: true });
    const installStart = Date.now();
    npm(
      [
        "install",
        "--no-audit",
        "--no-fund",
        tarballPath,
        "vite@^7",
        "@vitejs/plugin-react@^5",
        "react@^19",
        "react-dom@^19",
        "react-router-dom@^7",
        "@types/react@^19",
        "@types/react-dom@^19",
        "@types/node@^24",
        "vite-plugin-pwa@^2",
        "workbox-window@^7.4.1",
      ],
      consumerDir,
      { stage: "install" },
    );
    acceptance.timings.installMs = Date.now() - installStart;

    const installedDir = join(consumerDir, "node_modules", packageName);
    const installedManifest = JSON.parse(readFileSync(join(installedDir, "package.json"), "utf8"));
    const installedLink = lstatSync(installedDir).isSymbolicLink();
    const installedLinkTarget = installedLink ? readlinkSync(installedDir) : null;
    const dependencyVersions = {};
    for (const name of [
      "vite",
      "@vitejs/plugin-react",
      "react",
      "react-dom",
      "react-router-dom",
      "vite-plugin-pwa",
      "workbox-window",
    ]) {
      dependencyVersions[name] = JSON.parse(
        readFileSync(join(consumerDir, "node_modules", name, "package.json"), "utf8"),
      ).version;
    }
    acceptance.packageEvidence.installed = {
      version: installedManifest.version,
      symlink: installedLink,
      symlinkTarget: installedLinkTarget,
      pwaJsSha256: sha256(join(installedDir, "dist", "pwa.js")),
      pwaReactJsSha256: sha256(join(installedDir, "dist", "pwa-react.js")),
      dependencies: dependencyVersions,
    };
    check(
      "install-independent-tarball",
      !installedLink && installedManifest.name === packageManifest.name ? "PASS" : "FAIL",
      `${packageName}@${installedManifest.version} installed into ${consumerDir} from the tarball ` +
        `(symlink=${installedLink}); vite ${dependencyVersions.vite}, vite-plugin-pwa ` +
        `${dependencyVersions["vite-plugin-pwa"]}, workbox-window ${dependencyVersions["workbox-window"]}, ` +
        `react ${dependencyVersions.react}`,
      { ms: acceptance.timings.installMs },
    );

    // 3. Two builds: v1, then a Markdown-only v2.
    const runId = crypto.randomUUID().slice(0, 8);
    const markers = {
      v1: `FOL039-RUN-${runId}-V1-content`,
      v2: `FOL039-RUN-${runId}-V2-content`,
    };
    const contentPath = join(consumerDir, "content", "docs", "hello.md");
    const contentTemplate = readFileSync(contentPath, "utf8");
    if (!contentTemplate.includes("__FOL039_MARKER__")) {
      fail("build-v1", "fixture content/docs/hello.md lost its __FOL039_MARKER__ placeholder");
    }
    const writeContent = (marker) =>
      writeFileSync(contentPath, contentTemplate.replaceAll("__FOL039_MARKER__", marker), "utf8");
    const buildSite = (outDir, stage) => {
      writeFileSync(
        join(consumerDir, "vite.config.ts"),
        readFileSync(join(fixtureDir, "vite.config.ts"), "utf8"),
        "utf8",
      );
      const start = Date.now();
      const result = runNode([join(consumerDir, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", outDir], consumerDir, {
        allowFailure: true,
        stage,
      });
      const ms = Date.now() - start;
      if (result.status !== 0) {
        fail(stage, `vite build failed with exit code ${result.status}\n${result.output.trim().slice(-4000)}`);
      }
      return ms;
    };

    writeContent(markers.v1);
    acceptance.timings.buildV1Ms = buildSite("dist-v1", "build-v1");
    const distV1 = join(consumerDir, "dist-v1");
    if (!existsSync(join(distV1, "index.html"))) fail("build-v1", "dist-v1/index.html is missing");
    const versionV1 = JSON.parse(readFileSync(join(distV1, "folio-version.json"), "utf8"));
    const htmlV1 = readFileSync(join(distV1, "docs", "hello", "index.html"), "utf8");
    if (!htmlV1.includes(markers.v1)) {
      fail("build-v1", `generated docs/hello/index.html does not contain marker ${markers.v1}`);
    }
    const htmlCountV1 = listFiles(distV1).filter((file) => file.endsWith(".html")).length;
    if (!existsSync(join(distV1, "sw.js"))) fail("build-v1", "dist-v1/sw.js is missing");
    check(
      "build-v1-static-html",
      "PASS",
      `staticRoutes:true wrote ${htmlCountV1} real HTML pages; docs/hello/index.html carries ${markers.v1}; ` +
        `folio-version.json version=${versionV1.version} pages=${versionV1.pages}`,
      { ms: acceptance.timings.buildV1Ms },
    );

    writeContent(markers.v2);
    acceptance.timings.buildV2Ms = buildSite("dist-v2", "build-v2");
    const distV2 = join(consumerDir, "dist-v2");
    const versionV2 = JSON.parse(readFileSync(join(distV2, "folio-version.json"), "utf8"));
    const htmlV2 = readFileSync(join(distV2, "docs", "hello", "index.html"), "utf8");
    if (!htmlV2.includes(markers.v2)) {
      fail("build-v2", `generated docs/hello/index.html does not contain marker ${markers.v2}`);
    }
    check(
      "build-v2-static-html",
      "PASS",
      `second build wrote ${listFiles(distV2).filter((file) => file.endsWith(".html")).length} HTML pages; ` +
        `docs/hello/index.html carries ${markers.v2}; folio-version.json version=${versionV2.version} ` +
        `pages=${versionV2.pages}`,
      { ms: acceptance.timings.buildV2Ms },
    );
    acceptance.builds = {
      v1: {
        outDir: "dist-v1",
        contentVersion: versionV1.version,
        pages: versionV1.pages,
        htmlFiles: listFiles(distV1).filter((file) => file.endsWith(".html")),
        ms: acceptance.timings.buildV1Ms,
      },
      v2: {
        outDir: "dist-v2",
        contentVersion: versionV2.version,
        pages: versionV2.pages,
        htmlFiles: listFiles(distV2).filter((file) => file.endsWith(".html")),
        ms: acceptance.timings.buildV2Ms,
      },
    };
    acceptance.content = {
      markerV1: markers.v1,
      markerV2: markers.v2,
      versionV1: versionV1.version,
      versionV2: versionV2.version,
      pagesV1: versionV1.pages,
      pagesV2: versionV2.pages,
    };

    // Content-only condition: identical asset names *and* bytes, different
    // content version. If assets ever differ, the scenario is not what this
    // harness claims to test, so it stops instead of reporting a misleading pass.
    const assetsOf = (dist) =>
      listFiles(join(dist, "assets")).map((name) => ({ name, sha256: sha256(join(dist, "assets", name)) }));
    const assetsV1 = assetsOf(distV1);
    const assetsV2 = assetsOf(distV2);
    acceptance.assets = {
      v1: assetsV1,
      v2: assetsV2,
      swV1: sha256(join(distV1, "sw.js")),
      swV2: sha256(join(distV2, "sw.js")),
      workboxV1: listFiles(distV1).find((file) => /^workbox-.*\.js$/.test(file)) ?? null,
      workboxV2: listFiles(distV2).find((file) => /^workbox-.*\.js$/.test(file)) ?? null,
    };
    const namesV1 = assetsV1.map((asset) => asset.name).join(", ");
    const namesV2 = assetsV2.map((asset) => asset.name).join(", ");
    if (namesV1 !== namesV2) {
      fail(
        "content-only-condition",
        `asset filenames differ between the builds, so this is not a content-only publication:\n` +
          `  v1: ${namesV1}\n  v2: ${namesV2}`,
      );
    }
    const bytesIdentical = assetsV1.every((asset, index) => asset.sha256 === assetsV2[index]?.sha256);
    if (!bytesIdentical) {
      fail("content-only-condition", "asset filenames match but some asset bytes differ between the builds");
    }
    if (versionV1.version === versionV2.version) {
      fail(
        "content-only-condition",
        `folio-version.json did not change for a Markdown-only edit (both ${versionV1.version}); ` +
          "the worker bytes would be identical and no update could ever be detected",
      );
    }
    acceptance.assets.assetNames = assetsV1.map((asset) => asset.name);
    check(
      "content-only-condition",
      "PASS",
      `assets byte-identical across builds (${assetsV1.length} files: ${namesV1}); ` +
        `folio-version.json ${versionV1.version} -> ${versionV2.version}, pages ${versionV1.pages} -> ${versionV2.pages}`,
    );

    const precachedV1 = precacheUrls(readFileSync(join(distV1, "sw.js"), "utf8"));
    const precachedV2 = precacheUrls(readFileSync(join(distV2, "sw.js"), "utf8"));
    acceptance.assets.precacheV1 = precachedV1;
    acceptance.assets.precacheV2 = precachedV2;
    const workerChanged = acceptance.assets.swV1 !== acceptance.assets.swV2;
    const versionPrecached = precachedV2.includes("folio-version.json");
    const noHtmlPrecached = precachedV2.every((url) => !url.endsWith(".html"));
    check(
      "worker-changed-by-content-version",
      workerChanged && versionPrecached && noHtmlPrecached ? "PASS" : "FAIL",
      `sw.js sha256 ${acceptance.assets.swV1.slice(0, 12)} -> ${acceptance.assets.swV2.slice(0, 12)}; ` +
        `v2 precaches ${precachedV2.length} entries (${precachedV2.join(", ")}) including folio-version.json, ` +
        `no HTML precached=${noHtmlPrecached}`,
    );

    // 4. Serve v1, register the worker, then switch the root to v2.
    const state = { root: distV1, deployment: "v1", failWorkerScript: false };
    server = await startServer(state);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const pageUrl = `${origin}/docs/hello/`;
    acceptance.deployment = { origin, pageUrl, v1: versionV1.version, v2: versionV2.version };

    const servedV1 = await fetch(pageUrl);
    if (!servedV1.ok) fail("serve", `GET ${pageUrl} -> ${servedV1.status}`);
    const servedHtmlV1 = await servedV1.text();
    if (!servedHtmlV1.includes(markers.v1)) fail("serve", "served v1 HTML does not contain the v1 marker");
    for (const route of ["/docs/hello/", "/", "/sw.js", "/manifest.webmanifest", "/folio-version.json"]) {
      const probe = await fetch(`${origin}${route}`);
      if (!probe.ok) fail("serve", `GET ${route} -> ${probe.status}`);
      const expectedType = route === "/sw.js"
        ? "text/javascript"
        : route === "/manifest.webmanifest"
          ? "application/manifest+json"
          : null;
      if (expectedType && !(probe.headers.get("content-type") ?? "").startsWith(expectedType)) {
        fail("serve", `GET ${route} has content-type ${probe.headers.get("content-type")}`);
      }
      if (extname(route.replace(/\/$/, "")) !== "" || route === "/") {
        if (probe.headers.get("cache-control") !== "no-cache") {
          fail("serve", `GET ${route} is served with cache-control ${JSON.stringify(probe.headers.get("cache-control"))}`);
        }
      }
    }
    const missing = await fetch(`${origin}/docs/not-published/`);
    if (missing.status !== 404) fail("serve", `GET /docs/not-published/ -> ${missing.status}, expected 404`);
    check(
      "serve-v1-multipage",
      "PASS",
      `${pageUrl} served the generated static page (${servedHtmlV1.length} bytes); /docs/not-published/ -> 404; ` +
        `sw.js, manifest.webmanifest, folio-version.json and HTML are served no-cache`,
    );

    const profileDir = mkdtempSync(join(tmpdir(), "folio039-chrome-"));
    const debugPort = 9400 + Math.floor(Math.random() * 400);
    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1280,900",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    const version = await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`);
    acceptance.deployment.engine = version.Browser;
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolvePromise, rejectPromise) => {
      socket.onopen = resolvePromise;
      socket.onerror = () => rejectPromise(new Error("DevTools socket failed"));
    });
    const cdp = new Cdp(socket);

    cdp.on("Runtime.consoleAPICalled", (params) => {
      if (params.type !== "error" && params.type !== "warning") return;
      consoleEntries.push({
        page: currentPage,
        type: params.type,
        expected: expectedConsole,
        text: params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ").slice(0, 500),
      });
    });
    cdp.on("Runtime.exceptionThrown", (params) => {
      const details = params.exceptionDetails ?? {};
      const text = `${details.text ?? ""} ${details.exception?.description ?? ""}`.trim();
      if (!text) return;
      consoleEntries.push({ page: currentPage, type: "exception", expected: expectedConsole, text: text.slice(0, 800) });
    });
    cdp.on("Log.entryAdded", (params) => {
      const entry = params.entry ?? {};
      if (entry.level !== "error") return;
      consoleEntries.push({
        page: currentPage,
        type: `log:${entry.source ?? "unknown"}`,
        expected: expectedConsole,
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
        const details = result.exceptionDetails;
        throw new Error(
          `in-page evaluation failed: ${details.text ?? ""} ${details.exception?.description ?? ""}`.trim(),
        );
      }
      return result.result.value;
    };

    const openTarget = async (label) => {
      currentPage = label;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Log.enable", {}, sessionId);
      await cdp.send("Network.enable", {}, sessionId);
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      return sessionId;
    };

    const goto = async (sessionId, url) => {
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await loaded;
      await sleep(400);
    };

    const poll = async (sessionId, expression, { label: what, timeout = 20_000, interval = 200 }) => {
      const deadline = Date.now() + timeout;
      let last;
      while (Date.now() < deadline) {
        try {
          last = await evaluate(sessionId, expression);
          if (last) return last;
        } catch {
          // A navigation is in flight; retry until the deadline.
        }
        await sleep(interval);
      }
      fail("browser", `timed out after ${timeout}ms waiting for ${what}; last value ${JSON.stringify(last)}`);
    };

    const click = async (sessionId, selector) => {
      const result = await evaluate(
        sessionId,
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { ok: false, reason: 'selector not found' };
          const r = el.getBoundingClientRect();
          const info = {
            ok: true,
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
            rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
          };
          el.click();
          return info;
        })()`,
      );
      if (!result.ok) fail("browser", `cannot click ${selector}: ${result.reason}`);
      return result;
    };

    // --- 1. First deployment loads and the service worker registers. --------
    const t1 = Date.now();
    const page = await openTarget("v1-first-load");
    await goto(page, pageUrl);
    await poll(page, "window.__folioPwaMounted === true && typeof window.__folioPwaCheck === 'function'", {
      label: "the fixture to mount and expose __folioPwaCheck",
      timeout: REGISTER_TIMEOUT_MS,
    });
    const swState = await poll(
      page,
      `(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration || !registration.active) return null;
        return { scope: registration.scope, scriptURL: registration.active.scriptURL, state: registration.active.state };
      })()`,
      { label: "an active service worker registration", timeout: REGISTER_TIMEOUT_MS },
    );
    const page1 = await evaluate(page, NAV_STATE);
    if (!page1.markerText || !page1.markerText.includes(markers.v1)) {
      fail(
        "browser-v1-load",
        `the rendered content marker does not show the v1 Markdown; got ${JSON.stringify(page1.markerText)}`,
      );
    }
    if (page1.promptPresent) fail("browser-v1-load", "the update prompt is visible before any new deployment exists");
    const cacheV1 = await evaluate(page, CACHE_STATE);
    acceptance.content.cacheV1 = cacheV1;
    check(
      "v1-load-registers-worker",
      "PASS",
      `deployment v1 rendered ${JSON.stringify(markers.v1)} at ${pageUrl}; worker ${swState.scriptURL} active ` +
        `(state=${swState.state}, scope=${swState.scope}); no prompt before a new deployment; precache ` +
        `${JSON.stringify(cacheV1.precacheKeys)} holds folio-version.json ${cacheV1.folioVersion?.version}`,
      { ms: Date.now() - t1 },
    );

    // `registerType: "prompt"` never sets `clientsClaim` (only `autoUpdate`
    // does), so the very first visit is not controlled by the worker it just
    // installed. One more navigation is normal browser behaviour and is what
    // makes the next page controlled -- only a controlled page gets
    // `controllerchange` when the waiting worker activates. This baseline
    // navigation happens strictly *before* the v2 deployment exists, and is
    // recorded so it can never be mistaken for the prompt-driven reload.
    const tBaseline = Date.now();
    await goto(page, pageUrl);
    await poll(page, "window.__folioPwaMounted === true", { label: "the controlled page to mount" });
    const baseline = await evaluate(page, NAV_STATE);
    const baselineSw = await evaluate(page, SW_STATE);
    const baselineBootId = baseline.bootId;
    if (!baselineSw.controller) {
      fail(
        "browser-controlled-baseline",
        `the second load of deployment v1 is still uncontrolled (controller=${JSON.stringify(baselineSw.controller)}); ` +
          "a prompt-confirmed update could not reload this page",
      );
    }
    check(
      "v1-controlled-baseline",
      "PASS",
      `a second navigation of deployment v1 is controlled by ${baselineSw.controller}; bootId=${baselineBootId}, ` +
        `navigationEntries=${baseline.navigationEntries}, content marker still ${JSON.stringify(markers.v1)}`,
      { ms: Date.now() - tBaseline },
    );

    // --- 2. v2 content-only deployment is detected within a bounded wait. ---
    const t2 = Date.now();
    state.root = distV2;
    state.deployment = "v2";
    const servedV2 = await (await fetch(pageUrl)).text();
    if (!servedV2.includes(markers.v2)) {
      fail("browser-update-detect", "the server is not serving the v2 page after the root switch");
    }
    await evaluate(page, "window.__folioPwaCheck()");
    const promptState = await poll(
      page,
      `(() => {
        const el = document.querySelector('[data-folio-pwa-update-prompt]');
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0 &&
          r.width > 1 && r.height > 1;
        if (!visible) return null;
        return {
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
          confirm: Boolean(el.querySelector('[data-folio-pwa-update-confirm]')),
          dismiss: Boolean(el.querySelector('[data-folio-pwa-update-dismiss]')),
        };
      })()`,
      { label: "[data-folio-pwa-update-prompt]", timeout: PROMPT_TIMEOUT_MS },
    );
    const detectMs = Date.now() - t2;
    const waitingAfterDetect = await evaluate(page, SW_STATE);
    acceptance.content.prompt = promptState;
    check(
      "v2-content-only-update-detected",
      waitingAfterDetect.waiting && promptState.confirm && promptState.dismiss ? "PASS" : "FAIL",
      `prompt "${promptState.text}" appeared ${detectMs}ms after the v2 root was switched on and ` +
        `window.__folioPwaCheck() ran; waiting worker=${waitingAfterDetect.waiting}, ` +
        `confirm/dismiss buttons=${promptState.confirm}/${promptState.dismiss}`,
      { ms: detectMs, promptText: promptState.text, promptRect: promptState.rect },
    );

    // --- 3. The prompt is visible and the page did NOT reload. --------------
    const t3 = Date.now();
    const duringPrompt = await evaluate(page, NAV_STATE);
    const noReloadWhilePromptVisible =
      duringPrompt.promptVisible &&
      duringPrompt.navigationEntries === 1 &&
      duringPrompt.bootId === baselineBootId &&
      duringPrompt.timeOrigin === baseline.timeOrigin &&
      Boolean(duringPrompt.markerText) &&
      duringPrompt.markerText.includes(markers.v1);
    check(
      "no-reload-while-prompt-visible",
      noReloadWhilePromptVisible ? "PASS" : "FAIL",
      `prompt visible=${duringPrompt.promptVisible}, navigationEntries=${duringPrompt.navigationEntries} ` +
        `(type ${duringPrompt.navigationType}), bootId ${baselineBootId} -> ${duringPrompt.bootId}, ` +
        `timeOrigin unchanged=${duringPrompt.timeOrigin === baseline.timeOrigin}, content marker still ` +
        `v1=${Boolean(duringPrompt.markerText && duringPrompt.markerText.includes(markers.v1))}`,
      { ms: Date.now() - t3, state: duringPrompt },
    );

    // --- 4. Dismiss removes the prompt without reloading. -------------------
    const t4 = Date.now();
    const dismissed = await click(page, "[data-folio-pwa-update-dismiss]");
    await poll(page, "document.querySelector('[data-folio-pwa-update-prompt]') === null", {
      label: "the prompt to disappear after dismiss",
      timeout: 10_000,
    });
    const afterDismiss = await evaluate(page, NAV_STATE);
    const dismissOk =
      !afterDismiss.promptPresent &&
      afterDismiss.navigationEntries === 1 &&
      afterDismiss.bootId === baselineBootId &&
      Boolean(afterDismiss.markerText) &&
      afterDismiss.markerText.includes(markers.v1);
    check(
      "dismiss-keeps-page",
      dismissOk ? "PASS" : "FAIL",
      `clicked dismiss "${dismissed.text}"; prompt removed=${!afterDismiss.promptPresent}, ` +
        `navigationEntries=${afterDismiss.navigationEntries}, bootId unchanged=${afterDismiss.bootId === baselineBootId}, ` +
        `content marker still v1=${Boolean(afterDismiss.markerText && afterDismiss.markerText.includes(markers.v1))}`,
      { ms: Date.now() - t4, state: afterDismiss },
    );

    // --- 5. Show the prompt again, confirm, and the page reloads onto v2. ---
    // The fixture's own "show the prompt again" control remounts the *unchanged*
    // public `<FolioPwaUpdatePrompt />`, which is exactly what a later app
    // session does after a dismissal. No Folio internal state is poked.
    const t5 = Date.now();
    const reopened = await click(page, "[data-folio-pwa-show-prompt]");
    await poll(page, "Boolean(document.querySelector('[data-folio-pwa-update-prompt]'))", {
      label: "the prompt to be shown again by the remounted public component",
      timeout: 20_000,
    });
    const beforeConfirm = await evaluate(page, NAV_STATE);
    const confirmed = await click(page, "[data-folio-pwa-update-confirm]");
    await poll(
      page,
      `(() => (window.__folioPwaMounted === true && window.__folioBootId !== ${JSON.stringify(baselineBootId)}) || null)()`,
      { label: "the confirmed update to reload the page", timeout: RELOAD_TIMEOUT_MS, interval: 250 },
    );
    await poll(page, "typeof window.__folioPwaCheck === 'function'", { label: "the reloaded fixture to mount" });
    const afterReload = await evaluate(page, NAV_STATE);
    const reloadOk =
      afterReload.bootId !== baselineBootId &&
      afterReload.navigationEntries === 1 &&
      Boolean(afterReload.markerText) &&
      afterReload.markerText.includes(markers.v2) &&
      !afterReload.markerText.includes(markers.v1);
    check(
      "confirm-reloads-onto-new-content",
      reloadOk ? "PASS" : "FAIL",
      `clicked show-prompt "${reopened.text}" (prompt visible again=${beforeConfirm.promptVisible}) then confirm ` +
        `"${confirmed.text}"; reloaded=${afterReload.bootId !== baselineBootId} (bootId ${baselineBootId} -> ` +
        `${afterReload.bootId}), navigationEntries=${afterReload.navigationEntries}, content marker shows the ` +
        `new Markdown=${Boolean(afterReload.markerText && afterReload.markerText.includes(markers.v2))}`,
      { ms: Date.now() - t5, afterReload },
    );

    // --- 6. Old precache cleaned; current precache carries the new hash. ----
    const t6 = Date.now();
    const cacheAfter = await evaluate(page, CACHE_STATE);
    const singlePrecache = cacheAfter.precacheKeys.length === 1;
    const singleVersionEntry = cacheAfter.folioVersionEntryCount === 1;
    const cachedVersionMatches =
      cacheAfter.folioVersion?.version === versionV2.version &&
      cacheAfter.folioVersionRevision === versionV2.version;
    acceptance.content.cacheAfter = cacheAfter;
    check(
      "precache-cleaned-and-current",
      singlePrecache && singleVersionEntry && cachedVersionMatches ? "PASS" : "FAIL",
      `caches.keys() = ${JSON.stringify(cacheAfter.keys)}; precache caches=${cacheAfter.precacheKeys.length}; ` +
        `cached folio-version.json version=${JSON.stringify(cacheAfter.folioVersion?.version)} ` +
        `(revision ${cacheAfter.folioVersionRevision}) equals the v2 build ${versionV2.version}=${cachedVersionMatches}; ` +
        `folio-version.json cache entries=${cacheAfter.folioVersionEntryCount}`,
      { ms: Date.now() - t6 },
    );

    // --- 7. Registration failure is observable and non-fatal. --------------
    // A fresh browser context is used on purpose: the main context still has a
    // page controlled by the current worker, and per the service-worker
    // specification a registration is only torn down once it has no clients, so
    // unregistering on the old tab would not be observable from a new one.
    // The fault itself is a real 404 for `/sw.js` answered by the deployment, so
    // the browser rejects `register()` with a network/HTTP error -- exactly the
    // failure the consumer's `onRegisterError` path has to report.
    const t7 = Date.now();
    const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
    currentPage = "v2-registration-failure";
    expectedConsole = true;
    state.failWorkerScript = true;
    const failingSw = await fetch(`${origin}/sw.js`);
    if (failingSw.status !== 404) {
      fail("browser-register-error", `fault injection did not take effect (/sw.js -> ${failingSw.status})`);
    }
    const { targetId: failureTargetId } = await cdp.send("Target.createTarget", {
      url: "about:blank",
      browserContextId,
    });
    const { sessionId: failurePage } = await cdp.send("Target.attachToTarget", {
      targetId: failureTargetId,
      flatten: true,
    });
    await cdp.send("Page.enable", {}, failurePage);
    await cdp.send("Runtime.enable", {}, failurePage);
    await cdp.send("Log.enable", {}, failurePage);
    await goto(failurePage, pageUrl);
    await poll(failurePage, "window.__folioPwaMounted === true", {
      label: "the fixture to mount while /sw.js answers 404",
    });
    let registerError;
    try {
      registerError = await poll(failurePage, "window.__folioPwaRegisterError || null", {
        label: "the consumer onRegisterError path to report the failing worker script",
        timeout: REGISTER_ERROR_TIMEOUT_MS,
      });
    } catch (error) {
      fail(
        "browser-register-error",
        `a 404 /sw.js produced no window.__folioPwaRegisterError within ${REGISTER_ERROR_TIMEOUT_MS}ms ` +
          `(a silent hang instead of an observable failure): ${error.message}`,
      );
    }
    const failureState = await evaluate(failurePage, NAV_STATE);
    const failureSw = await evaluate(failurePage, SW_STATE);
    const failureOk =
      Boolean(failureState.markerText) &&
      failureState.markerText.includes(markers.v2) &&
      failureSw.present === false &&
      failureState.registerError !== null;
    check(
      "registration-failure-observable",
      failureOk ? "PASS" : "FAIL",
      `/sw.js answered 404 for a fresh browser context; consumer reported onRegisterError ` +
        `${JSON.stringify(String(registerError).slice(0, 160))}; registration present=${failureSw.present}; ` +
        `article still rendered=${Boolean(failureState.markerText && failureState.markerText.includes(markers.v2))}`,
      { ms: Date.now() - t7, registerError: String(registerError) },
    );
    state.failWorkerScript = false;
    expectedConsole = false;

    acceptance.timings.totalMs = Date.now() - startedAt;
    acceptance.deployment.profileDir = profileDir;
  } catch (error) {
    const failure = {
      stage: error instanceof HarnessError ? error.stage : "harness",
      message: error.message,
    };
    acceptance.failure = failure;
    check(`stage-${failure.stage}`, "FAIL", failure.message.split("\n")[0]);
    console.error(`\n[${failure.stage}] FAIL ${failure.message}\n`);
  } finally {
    try {
      chrome?.kill("SIGKILL");
    } catch {
      // Already gone.
    }
    if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
    if (acceptance.timings.totalMs === undefined) acceptance.timings.totalMs = Date.now() - startedAt;
    acceptance.console = consoleEntries;
    acceptance.consoleUnexpected = consoleEntries.filter((entry) => !entry.expected);
    const failing = acceptance.checks.filter((item) => item.status === "FAIL");
    acceptance.summary = {
      generatedAt: new Date().toISOString(),
      commit,
      passing: acceptance.checks.filter((item) => item.status === "PASS").length,
      failing: failing.length,
      status:
        !acceptance.failure && failing.length === 0 && acceptance.consoleUnexpected.length === 0
          ? "PASS"
          : "FAIL",
      tarballSha256: acceptance.packageEvidence.sha256 ?? null,
      contentVersions: {
        v1: acceptance.content.versionV1 ?? null,
        v2: acceptance.content.versionV2 ?? null,
      },
    };
    acceptance.summary.unexpectedConsoleErrors = acceptance.consoleUnexpected.length;
    if (acceptance.consoleUnexpected.length > 0) {
      // An unexpected console error blocks the PASS claim (see the status above)
      // instead of hiding in an appendix; the run is only green when the page
      // logged nothing the harness did not inject on purpose.
      acceptance.summary.consoleNote =
        "unexpected console errors were recorded; fix the fixture or explain them before claiming PASS";
    }
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(join(resultsDir, "acceptance.json"), `${JSON.stringify(acceptance, null, 2)}\n`, "utf8");
    if (keepTemp) log(`[keep]     temp preserved at ${tempRoot}`);
    else rmSync(tempRoot, { recursive: true, force: true });
    log("");
    log(
      `[summary]  ${acceptance.summary.passing} pass / ${failing.length} fail, ` +
        `${acceptance.consoleUnexpected.length} unexpected console errors`,
    );
    log(`[results]  ${relative(process.cwd(), join(resultsDir, "acceptance.json"))}`);
    if (acceptance.summary.status !== "PASS") {
      process.exitCode = 1;
      if (acceptance.failure) console.error(`[${acceptance.failure.stage}] FAIL ${acceptance.failure.message}`);
      for (const item of failing) console.error(`[${item.id}] FAIL ${item.detail}`);
      if (acceptance.summary.consoleNote) {
        for (const entry of acceptance.consoleUnexpected) {
          console.error(`[console] ${entry.page ?? "?"} ${entry.type}: ${entry.text}`);
        }
      }
    }
  }
}

await main();
