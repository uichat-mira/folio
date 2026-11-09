// Shared verification helpers for the FOL-041 archive acceptance harness.
//
// Kept deliberately dependency-free: Node built-ins only (including the global
// WebSocket used by the DevTools-protocol client), so the evidence scripts do
// not depend on the package under test or on automation libraries.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const researchDir = dirname(fileURLToPath(import.meta.url));
export const resultsDir = join(researchDir, "results");
export const screenshotsDir = join(resultsDir, "screenshots");
export const repoRoot = resolve(researchDir, "..", "..", "..");
export const packageRoot = join(repoRoot, "packages", "folio");
export const siteRoot = join(repoRoot, "apps", "site");
export const isWindows = process.platform === "win32";
export const npmCommand = isWindows ? "npm.cmd" : "npm";

export function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", timeout: 60_000 });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function posix(path) {
  return path.replace(/\\/g, "/");
}

export function walkFiles(root, predicate = () => true) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (predicate(path)) files.push(posix(relative(root, path)));
    }
  };
  walk(root);
  return files.sort();
}

/** Static route -> file map for a built Folio site. `/404` is a root file. */
export function htmlRoutes(root) {
  const routes = [];
  for (const file of walkFiles(root, (path) => path.endsWith(".html"))) {
    if (file === "404.html") {
      routes.push("/404");
      continue;
    }
    if (file === "index.html") {
      routes.push("/");
      continue;
    }
    if (!file.endsWith("/index.html")) continue;
    routes.push(`/${file.slice(0, -"/index.html".length)}`);
  }
  return routes.sort();
}

export function routeFile(root, route) {
  return route === "/404"
    ? join(root, "404.html")
    : route === "/"
      ? join(root, "index.html")
      : join(root, ...route.slice(1).split("/"), "index.html");
}

export function readRoute(root, route) {
  return readFileSync(routeFile(root, route), "utf8");
}

export function npmEnv() {
  return {
    ...process.env,
    npm_config_cache: join(repoRoot, ".npm-cache"),
    npm_config_logs_dir: join(repoRoot, ".npm-logs"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
}

export function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function formatCommand(executable, args) {
  return [executable, ...args]
    .map((part) => (/[\s"]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function outputTail(result, lines = 12) {
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (!text) return [];
  return text.split("\n").slice(-lines);
}

/**
 * Verification reporter: stages, checks, command log and a JSON result file.
 * A failed check throws, so a script can never continue past a failure.
 */
export class Reporter {
  constructor({ name, purpose, harness, meta = {} }) {
    this.name = name;
    this.results = {
      meta: {
        purpose,
        harness,
        generatedAt: new Date().toISOString(),
        branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
        commit: git(["rev-parse", "HEAD"]),
        shortCommit: git(["rev-parse", "--short", "HEAD"]),
        baseCommit: git(["rev-parse", "c6ecaef"]),
        dirtyWorkingTree: git(["status", "--porcelain"]) !== "",
        packagedSourcesDirty: git([
          "status",
          "--porcelain",
          "--",
          "packages",
          "apps/site",
          "schemas",
          "scripts",
        ]),
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        chrome: existsSync(
          process.env.FOLIO041_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
          ? process.env.FOLIO041_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined,
        npmCache: ".npm-cache (workspace-local; sandbox workaround)",
        ...meta,
      },
      stages: [],
      checks: [],
      commands: [],
      artifacts: {},
      summary: { status: "failed", total: 0, passed: 0, failed: 0 },
    };
    this.currentStage = undefined;
    this.stageStart = undefined;
  }

  stage(id, detail) {
    this.currentStage = { id, detail, status: "running", ms: 0 };
    this.results.stages.push(this.currentStage);
    this.stageStart = process.hrtime.bigint();
  }

  endStage() {
    if (!this.currentStage) return;
    this.currentStage.ms = Number((process.hrtime.bigint() - this.stageStart) / 1_000_000n);
    this.currentStage.status = "passed";
    this.currentStage = undefined;
  }

  check(id, fn) {
    console.log(`  … ${id}`);
    const started = process.hrtime.bigint();
    try {
      const detail = fn();
      this.results.checks.push({
        id,
        stage: this.results.stages.at(-1)?.id,
        status: "passed",
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        detail: detail === undefined ? undefined : typeof detail === "string" ? detail : detail,
      });
      return detail;
    } catch (error) {
      this.results.checks.push({
        id,
        stage: this.results.stages.at(-1)?.id,
        status: "failed",
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        detail: error?.message ?? String(error),
      });
      throw error;
    }
  }

  async checkAsync(id, fn) {
    console.log(`  … ${id}`);
    const started = process.hrtime.bigint();
    try {
      const detail = await fn();
      this.results.checks.push({
        id,
        stage: this.results.stages.at(-1)?.id,
        status: "passed",
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        detail: detail === undefined ? undefined : typeof detail === "string" ? detail : detail,
      });
      return detail;
    } catch (error) {
      this.results.checks.push({
        id,
        stage: this.results.stages.at(-1)?.id,
        status: "failed",
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        detail: error?.message ?? String(error),
      });
      throw error;
    }
  }

  recordCommand(label, result, extra = {}) {
    const entry = {
      command: label,
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
      outputTail: outputTail(result),
      ...extra,
    };
    this.results.commands.push(entry);
    return entry;
  }

  run(executable, args, { cwd = repoRoot, env = {}, allowFailure = false, tailLines = 12 } = {}) {
    const result = spawnSync(executable, args, {
      cwd,
      encoding: "utf8",
      timeout: 600_000,
      env: { ...process.env, ...env },
      shell: isWindows,
    });
    const label = `${formatCommand(executable, args)}  (cwd ${posix(relative(repoRoot, cwd)) || "."})`;
    this.recordCommand(label, result, { tailLines });
    if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
    if (result.status !== 0 && !allowFailure) {
      throw new Error(
        `${label} failed with exit code ${result.status}\n${outputTail(result, 40).join("\n")}`,
      );
    }
    return result;
  }

  npm(args, options = {}) {
    return this.run(npmCommand, args, { ...options, env: { ...npmEnv(), ...(options.env ?? {}) } });
  }

  node(args, options = {}) {
    return this.run(process.execPath, args, options);
  }

  fail(message) {
    throw new Error(message);
  }

  write(fileName) {
    const failed = this.results.checks.filter((check) => check.status === "failed").length;
    if (this.currentStage) {
      this.currentStage.status = "failed";
      this.currentStage.error = this.results.checks.find((check) => check.status === "failed")?.detail;
    }
    this.results.summary = {
      status: failed === 0 ? "passed" : "failed",
      total: this.results.checks.length,
      passed: this.results.checks.length - failed,
      failed,
    };
    this.results.meta.finishedAt = new Date().toISOString();
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(join(resultsDir, fileName), JSON.stringify(this.results, null, 2) + "\n");
    for (const check of this.results.checks) {
      console.log(`${check.status === "passed" ? "PASS" : "FAIL"}  ${check.id} (${check.ms}ms)`);
    }
    console.log(
      `\n${this.results.summary.passed}/${this.results.summary.total} checks passed` +
        (this.results.summary.failed ? " — FAILED" : ""),
    );
    console.log(`results: ${posix(relative(repoRoot, join(resultsDir, fileName)))}`);
    return this.results.summary;
  }
}

// ---------------------------------------------------------------------------
// Static multi-page server (directory URLs, sub-path deployment, 404 page).
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

export async function startServer(root, { base = "/" } = {}) {
  const normalizedBase = base === "/" ? "/" : base.replace(/\/+$/, "") + "/";
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
    if (normalizedBase !== "/") {
      if (!pathname.startsWith(normalizedBase)) {
        const notFound = join(root, "404.html");
        if (existsSync(notFound)) {
          response.writeHead(404, { "content-type": MIME[".html"], "cache-control": "no-cache" });
          response.end(readFileSync(notFound));
          return;
        }
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      pathname = "/" + pathname.slice(normalizedBase.length);
    }
    const candidates =
      pathname === "/"
        ? [join(root, "index.html")]
        : pathname.endsWith("/")
          ? [join(root, pathname, "index.html")]
          : [join(root, pathname), join(root, pathname, "index.html")];
    let file;
    let status = 200;
    for (const candidate of candidates) {
      if (!candidate.startsWith(root)) break;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        file = candidate;
        break;
      }
    }
    if (!file) {
      const notFound = join(root, "404.html");
      if (existsSync(notFound)) {
        file = notFound;
        status = 404;
      }
    }
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(status, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=60",
    });
    response.end(readFileSync(file));
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const { port } = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
    base: normalizedBase,
    close: () =>
      new Promise((resolvePromise) => {
        // Undici's keep-alive connection would otherwise keep server.close()
        // pending forever.
        server.closeAllConnections?.();
        server.close(resolvePromise);
      }),
  };
}

// ---------------------------------------------------------------------------
// Minimal Chrome DevTools Protocol client (Node's built-in WebSocket).
// ---------------------------------------------------------------------------
export class Cdp {
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
      this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== handler));
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

export async function launchChrome({ windowSize = "1440,900" } = {}) {
  const chromePath =
    process.env.FOLIO041_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(chromePath)) throw new Error(`Chrome not found at ${chromePath}`);
  const profileDir = tempDir("folio041-chrome-");
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--disable-breakpad",
      "--no-sandbox",
      "--hide-scrollbars",
      `--window-size=${windowSize}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const portFile = join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !existsSync(portFile)) await sleep(200);
  if (!existsSync(portFile)) {
    child.kill("SIGKILL");
    throw new Error("Chrome did not write DevToolsActivePort");
  }
  const [port] = readFileSync(portFile, "utf8").trim().split("\n");
  let version;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  if (!version) {
    child.kill("SIGKILL");
    throw new Error("Chrome DevTools endpoint did not become ready");
  }
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.onopen = resolvePromise;
    socket.onerror = () => rejectPromise(new Error("DevTools socket failed"));
  });
  const cdp = new Cdp(socket);
  const consoleEntries = [];
  cdp.on("Runtime.exceptionThrown", (params) => {
    const details = params.exceptionDetails ?? {};
    consoleEntries.push({
      type: "exception",
      text: `${details.text ?? ""} ${details.exception?.description ?? ""}`.trim().slice(0, 800),
    });
  });
  cdp.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error" && params.type !== "warning") return;
    consoleEntries.push({
      type: params.type,
      text: params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ").slice(0, 500),
    });
  });
  return {
    child,
    cdp,
    profileDir,
    browserVersion: version.Browser,
    consoleEntries,
    async stop() {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
      await sleep(300);
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}

export async function openPage(cdp, { width = 1440, height = 900, mobile = false, scale = 1 } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Log.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: scale, mobile },
    sessionId,
  );
  return { targetId, sessionId };
}

export async function setViewport(cdp, sessionId, { width, height, mobile = false, scale = 1 }) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: scale, mobile },
    sessionId,
  );
}

export async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(
      `in-page evaluation failed: ${result.exceptionDetails.text ?? ""} ${
        result.exceptionDetails.exception?.description ?? ""
      }`,
    );
  }
  return result.result.value;
}

export async function goto(cdp, sessionId, url) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url }, sessionId);
  await Promise.race([loaded, sleep(20_000)]);
  await sleep(500);
}

export async function poll(cdp, sessionId, expression, { label, timeout = 20_000, interval = 200 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, sessionId, expression);
      if (last) return last;
    } catch {
      // A navigation is in flight.
    }
    await sleep(interval);
  }
  throw new Error(`timed out after ${timeout}ms waiting for ${label}; last=${JSON.stringify(last)}`);
}

export async function screenshot(cdp, sessionId, filePath) {
  const { data } = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false },
    sessionId,
  );
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from(data, "base64"));
  return { path: posix(relative(repoRoot, filePath)), bytes: statSync(filePath).size };
}

export async function pressTab(cdp, sessionId) {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      { type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 },
      sessionId,
    );
  }
}

export async function pressEnter(cdp, sessionId) {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      {
        type,
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: "\r",
      },
      sessionId,
    );
  }
}

/** Copy a directory tree, optionally skipping top-level names. */
export function copyTree(source, target, { skip = [] } = {}) {
  cpSync(source, target, {
    recursive: true,
    filter: (path) => {
      const rel = posix(relative(source, path));
      if (!rel) return true;
      const top = rel.split("/")[0];
      return !skip.includes(top);
    },
  });
}

export function symlinkNodeModules(targetDir) {
  symlinkSync(join(repoRoot, "node_modules"), join(targetDir, "node_modules"), "dir");
}

export function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label} is missing ${JSON.stringify(needle)}`);
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripAssetHashes(html) {
  return html
    .replace(/assets\/[A-Za-z0-9_.-]+?-([A-Za-z0-9_-]{8,})\.(js|css)/g, "assets/HASH.$2")
    .replace(/assets\/index-[A-Za-z0-9_-]+\.(js|css)/g, "assets/index-HASH.$1");
}

export function parseEntryList(html) {
  const entries = [];
  const pattern =
    /<a class="folio-entry-link" href="([^"]+)">([^<]+)<\/a>|<a class="folio-entry" href="([^"]+)">[\s\S]*?<h[23] class="folio-entry-title">([^<]*)<\/h[23]>/g;
  for (const match of html.matchAll(pattern)) {
    if (match[1] !== undefined) entries.push({ href: match[1], title: match[2] });
    else entries.push({ href: match[3], title: match[4] });
  }
  return entries;
}

export function parseArchiveTitleEntries(html) {
  // Archive/collection entry lists whose entries have tag links are wrapped in
  // a <div class="folio-entry"> instead of a whole-row anchor.
  const entries = [];
  for (const match of html.matchAll(/<h2 class="folio-entry-title">([^<]+)<\/h2>/g)) {
    entries.push({ title: match[1] });
  }
  return entries;
}

export function parseLocs(sitemap) {
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}
