// T2/T3 check for the optional PWA integration (FOL-039).
//
// Every assertion below reads a site this check actually built from the
// installed tarball. The fixture is `scripts/fixtures/pwa-consumer`: a real
// Vite + React consumer that opts in with `folioPwa()` and mounts
// `<FolioPwaUpdatePrompt />`, exactly as the published documentation shows.
//
// Staged failures so a red run names the broken link in the chain:
//   [pwa]            a build failed for a reason other than a named stage
//   [pwa:root]       root deployment: manifest, worker, head links, precache
//   [pwa:subpath]    the same fixture under a non-root Vite base
//   [pwa:content]    a Markdown-only change must produce a new content version
//   [pwa:assets]     a JS change must still be picked up by the worker
//   [pwa:stable]     an unchanged rebuild must not fabricate a new version
//   [pwa:auto]       the explicit auto-update mode
//   [pwa:off]        `disable: true` must emit no PWA output at all
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const STATIC_SITE_URL = "https://example.test";
const ROOT_OUT_DIR = "dist-pwa";
const SUBPATH_OUT_DIR = "dist-pwa-sub";
const CONTENT_OUT_DIR = "dist-pwa-content";
const AUTO_OUT_DIR = "dist-pwa-auto";
const OFF_OUT_DIR = "dist-pwa-off";
const SUBPATH_BASE = "/folio-smoke/";

function check(stage, condition, message) {
  if (!condition) throw new Error(`[${stage}] FAIL ${message}`);
}

function readText(stage, path, what) {
  check(stage, existsSync(path), `${what} was not generated at ${path}`);
  return readFileSync(path, "utf8");
}

function readJson(stage, path, what) {
  const source = readText(stage, path, what);
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`[${stage}] FAIL ${what} is not valid JSON: ${error.message}`);
  }
}

/** Precache entries of a generated Workbox worker. */
function precacheEntries(worker) {
  const match = /precacheAndRoute\(\s*\[([\s\S]*?)\]\s*(?:,|\))/.exec(worker);
  check("pwa", Boolean(match), "the generated service worker has no precacheAndRoute([...]) manifest");
  return [...match[1].matchAll(/\{\s*url\s*:\s*"([^"]+)"\s*,\s*revision\s*:\s*("([^"]*)"|null)\s*\}/g)].map(
    (entry) => ({ url: entry[1], revision: entry[2] === "null" ? null : entry[3] }),
  );
}

function hashedAssets(directory) {
  const assetsDir = join(directory, "assets");
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir)
    .filter((name) => /\.(m?js|css)$/.test(name))
    .sort();
}

function assetHashes(directory) {
  const assetsDir = join(directory, "assets");
  if (!existsSync(assetsDir)) return {};
  const entries = {};
  for (const name of hashedAssets(directory)) {
    entries[name] = readFileSync(join(assetsDir, name), "utf8").length;
  }
  return entries;
}

function runBuild(
  viteCli,
  appDir,
  { outDir, base, updateMode, disabled, versionFile, contentDir, staticOnly },
) {
  rmSync(join(appDir, outDir), { recursive: true, force: true });
  const result = spawnSync(process.execPath, [viteCli, "build", "--logLevel", "warn"], {
    cwd: appDir,
    encoding: "utf8",
    timeout: 600_000,
    env: {
      ...process.env,
      FOLIO_PWA_OUT_DIR: outDir,
      FOLIO_PWA_BASE: base,
      FOLIO_PWA_SITE_URL: STATIC_SITE_URL,
      FOLIO_PWA_UPDATE_MODE: updateMode ?? "prompt",
      FOLIO_PWA_DISABLED: disabled ? "on" : "off",
      FOLIO_PWA_STATIC_ONLY: staticOnly ? "on" : "off",
      ...(versionFile ? { FOLIO_PWA_VERSION_FILE: versionFile } : {}),
      ...(contentDir ? { FOLIO_PWA_CONTENT_DIR: contentDir } : {}),
    },
  });
  if (result.error) {
    throw new Error(`[pwa] FAIL vite build could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `[pwa] FAIL vite build (base ${base}, mode ${updateMode ?? "prompt"}) exited with code ${result.status}\n` +
        `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
        `--- stderr ---\n${(result.stderr ?? "").trim()}`,
    );
  }
  return join(appDir, outDir);
}

/** Manifest + worker + per-page head contract for one deployment base. */
function verifyDeployment(stage, distDir, base, expectedTitle, log) {
  const manifest = readJson(stage, join(distDir, "manifest.webmanifest"), "manifest.webmanifest");
  check(
    stage,
    manifest.scope === base,
    `manifest scope is ${JSON.stringify(manifest.scope)}, expected the deployment base ${JSON.stringify(base)}`,
  );
  check(
    stage,
    typeof manifest.start_url === "string" && manifest.start_url.startsWith(base),
    `manifest start_url is ${JSON.stringify(manifest.start_url)}, expected it inside ${JSON.stringify(base)}`,
  );
  check(stage, manifest.name === expectedTitle, `manifest name is ${JSON.stringify(manifest.name)}`);
  check(stage, manifest.short_name === expectedTitle, "manifest short_name is not the site title");
  check(stage, manifest.display === "standalone", "manifest display is not standalone");
  check(stage, manifest.theme_color === "#cc785c", "manifest theme_color did not come from the consumer");
  check(stage, manifest.background_color === "#faf9f5", "manifest background_color did not come from the consumer");
  check(stage, manifest.lang === "zh-CN", "manifest lang did not come from the consumer");
  const iconSizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
  for (const size of ["192x192", "512x512"]) {
    check(stage, iconSizes.has(size), `manifest icons are missing a ${size} entry`);
  }
  check(
    stage,
    (manifest.icons ?? []).some((icon) => icon.purpose === "maskable"),
    "manifest icons are missing the maskable purpose",
  );

  const worker = readText(stage, join(distDir, "sw.js"), "sw.js");
  const precached = precacheEntries(worker);
  const urls = precached.map((entry) => entry.url);
  const html = urls.filter((url) => url.endsWith(".html"));
  check(
    stage,
    html.length === 0,
    `the worker precaches HTML (${html.slice(0, 3).join(", ")}); generated pages must stay out of the offline shell`,
  );
  check(stage, /cleanupOutdatedCaches\(\)/.test(worker), "the worker does not clean outdated precaches");
  check(
    stage,
    !/navigateFallback|NavigationRoute/.test(worker),
    "the worker contains a navigation fallback; a multi-page publication must not answer unknown URLs with the home page",
  );
  check(
    stage,
    urls.includes("folio-version.json"),
    `the worker does not precache folio-version.json (entries: ${urls.join(", ")})`,
  );
  const versionEntry = precached.find((entry) => entry.url === "folio-version.json");
  check(
    stage,
    typeof versionEntry.revision === "string" && /^[0-9a-f]{8,}$/.test(versionEntry.revision),
    `the folio-version.json precache entry has no content revision: ${JSON.stringify(versionEntry.revision)}`,
  );
  check(
    stage,
    !urls.includes("sw.js") && !urls.includes("registerSW.js"),
    "the worker precaches a copy of the registration script or itself",
  );
  check(
    stage,
    precached.some((entry) => /^assets\/.*\.js$/.test(entry.url)),
    "the worker precaches no hashed application asset",
  );
  // No implicit runtime caching: Workbox only emits registerRoute for explicitly
  // configured runtimeCaching entries.
  check(
    stage,
    !/registerRoute\(/.test(worker),
    "the worker registers a runtime caching route although the consumer configured none",
  );

  const version = readJson(stage, join(distDir, "folio-version.json"), "folio-version.json");
  check(
    stage,
    versionEntry.revision === version.version,
    `the worker revision ${JSON.stringify(versionEntry.revision)} does not match the emitted content version ${JSON.stringify(version.version)}`,
  );
  check(
    stage,
    Number.isInteger(version.pages) && version.pages >= 4,
    `folio-version.json counts ${JSON.stringify(version.pages)} pages, expected the home, collection, document and article pages`,
  );

  // Every generated HTML page must advertise the manifest, and the URL must
  // carry the deployment base so a subpath install still resolves it.
  const pages = [
    "index.html",
    join("blogs", "index.html"),
    join("blogs", "first-post", "index.html"),
    join("docs", "hello", "index.html"),
    "404.html",
  ];
  for (const relative of pages) {
    const htmlSource = readText(stage, join(distDir, relative), relative.replace(/\\/g, "/"));
    const label = relative.replace(/\\/g, "/");
    check(
      stage,
      htmlSource.includes(`<link rel="manifest" href="${base}manifest.webmanifest">`),
      `${label} does not link the base-prefixed manifest ${base}manifest.webmanifest`,
    );
    check(
      stage,
      !/id="vite-plugin-pwa:register-sw"/.test(htmlSource),
      `${label} carries an injected registration script; registration must stay in the client bundle so the prompt contract is not bypassed`,
    );
    check(
      stage,
      htmlSource.includes(`${base}assets/`),
      `${label} has no base-prefixed asset reference`,
    );
  }
  check(
    stage,
    readText(stage, join(distDir, "404.html"), "404.html").includes(
      '<meta name="robots" content="noindex,nofollow">',
    ),
    "the 404 page lost its noindex semantics",
  );
  check(
    stage,
    readText(stage, join(distDir, join("docs", "hello", "index.html")), "document page").includes(
      "PWA consumer fixture",
    ),
    "the document page does not carry the prerendered Markdown",
  );
  log(
    `[${stage}]   ok  base ${base}: manifest scope/start_url, ${precached.length} precache entries (no HTML, no fallback), manifest link on ${pages.length} pages, content version ${version.version.slice(0, 12)}…`,
  );
  return { version: version.version, precached, worker };
}

export function verifyPwaConsumer({ consumerDir, fixtureDir, log }) {
  const appDir = join(consumerDir, "pwa-app");
  cpSync(fixtureDir, appDir, { recursive: true });

  const viteCli = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  check(
    "pwa",
    existsSync(viteCli),
    `the consumer installation has no Vite CLI at ${viteCli}`,
  );
  check(
    "pwa",
    existsSync(join(appDir, "content", "docs", "hello.md")),
    "the copied PWA fixture has no Markdown to build",
  );

  // A fresh marker per run: the generated pages must contain this run's value,
  // so a stale output directory cannot satisfy the content assertions.
  const marker = `FOLIO_PWA_${randomBytes(8).toString("hex")}`;
  const markdownPath = join(appDir, "content", "docs", "hello.md");
  const markdown = readFileSync(markdownPath, "utf8");
  check(
    "pwa",
    markdown.includes("{{FOLIO_PWA_CONTENT_MARKER}}"),
    `${markdownPath} has no content marker placeholder`,
  );
  writeFileSync(
    markdownPath,
    markdown.replaceAll("{{FOLIO_PWA_CONTENT_MARKER}}", marker),
  );

  // --- root deployment ------------------------------------------------------
  const rootDir = runBuild(viteCli, appDir, { outDir: ROOT_OUT_DIR, base: "/" });
  const root = verifyDeployment("pwa:root", rootDir, "/", "Folio PWA consumer fixture", log);

  // --- subpath deployment ---------------------------------------------------
  const subDir = runBuild(viteCli, appDir, { outDir: SUBPATH_OUT_DIR, base: SUBPATH_BASE });
  verifyDeployment("pwa:subpath", subDir, SUBPATH_BASE, "Folio PWA consumer fixture", log);
  const subIndex = readText("pwa:subpath", join(subDir, "index.html"), "the subpath home page");
  check(
    "pwa:subpath",
    subIndex.includes(`${SUBPATH_BASE}assets/`),
    `the subpath home page does not reference ${SUBPATH_BASE}assets/*`,
  );

  // --- content-only publication --------------------------------------------
  // Same JS/CSS bytes, different Markdown: this is the case a plain
  // vite-plugin-pwa setup cannot detect, because the worker would be rebuilt
  // identically from unchanged asset hashes.
  const contentDirV1 = runBuild(viteCli, appDir, {
    outDir: CONTENT_OUT_DIR,
    base: "/",
    staticOnly: true,
  });
  const contentV1 = readJson("pwa:content", join(contentDirV1, "folio-version.json"), "folio-version.json");
  const assetsV1 = hashedAssets(contentDirV1);
  const workerV1 = readText("pwa:content", join(contentDirV1, "sw.js"), "sw.js");
  const contentOnlyMarker = `${marker}_CONTENT_ONLY`;
  writeFileSync(
    markdownPath,
    readFileSync(markdownPath, "utf8").replace(marker, contentOnlyMarker),
  );
  const contentDirV2 = runBuild(viteCli, appDir, {
    outDir: CONTENT_OUT_DIR,
    base: "/",
    staticOnly: true,
  });
  const contentV2 = readJson("pwa:content", join(contentDirV2, "folio-version.json"), "folio-version.json");
  const assetsV2 = hashedAssets(contentDirV2);
  const workerV2 = readText("pwa:content", join(contentDirV2, "sw.js"), "sw.js");
  check(
    "pwa:content",
    JSON.stringify(assetsV1) === JSON.stringify(assetsV2),
    `the content-only rebuild changed JS/CSS asset names (${assetsV1.join(", ")} -> ${assetsV2.join(", ")}); the check would not prove content detection`,
  );
  check(
    "pwa:content",
    contentV1.version !== contentV2.version,
    `a Markdown-only change did not change the content version (${contentV1.version}); clients would never see the deployment`,
  );
  check(
    "pwa:content",
    workerV1 !== workerV2,
    "a Markdown-only change produced a byte-identical service worker; the browser would never install an update",
  );
  check(
    "pwa:content",
    readText("pwa:content", join(contentDirV2, "docs", "hello", "index.html"), "document page").includes(
      contentOnlyMarker,
    ),
    "the rebuilt document page does not carry the new Markdown marker",
  );
  log(
    `[pwa:content] ok  Markdown-only change: identical ${assetsV1.length} asset(s), new version ${contentV1.version.slice(0, 12)}… -> ${contentV2.version.slice(0, 12)}…, worker bytes changed`,
  );

  // --- unchanged rebuild ----------------------------------------------------
  const stableDir = runBuild(viteCli, appDir, {
    outDir: CONTENT_OUT_DIR,
    base: "/",
    staticOnly: true,
  });
  const stable = readJson("pwa:stable", join(stableDir, "folio-version.json"), "folio-version.json");
  check(
    "pwa:stable",
    stable.version === contentV2.version,
    `an unchanged rebuild fabricated a new content version (${contentV2.version} -> ${stable.version}); every page load would offer an update`,
  );
  log("[pwa:stable] ok  unchanged rebuild keeps the same content version");

  // --- JS/CSS publication ---------------------------------------------------
  const entryPath = join(appDir, "src", "static-only.tsx");
  const entry = readFileSync(entryPath, "utf8");
  writeFileSync(
    entryPath,
    entry.replace('"FOLIO_PWA_ASSET_MARKER"', `"FOLIO_PWA_ASSET_MARKER_${marker}"`),
  );
  const assetDir = runBuild(viteCli, appDir, {
    outDir: CONTENT_OUT_DIR,
    base: "/",
    staticOnly: true,
  });
  const assetVersion = readJson("pwa:assets", join(assetDir, "folio-version.json"), "folio-version.json");
  const assetsV3 = hashedAssets(assetDir);
  check(
    "pwa:assets",
    JSON.stringify(assetsV1) !== JSON.stringify(assetsV3),
    "changing an application source file did not change any hashed asset name",
  );
  check(
    "pwa:assets",
    precacheEntries(readText("pwa:assets", join(assetDir, "sw.js"), "sw.js")).some((entry) =>
      assetsV3.some((name) => entry.url.endsWith(name)),
    ),
    "the rebuilt worker does not precache the new hashed asset",
  );
  check(
    "pwa:assets",
    assetVersion.version !== contentV2.version,
    "a JS change did not change the content version",
  );
  log("[pwa:assets] ok  JS change rotates the hashed asset and the worker precache");

  // --- explicit auto-update mode -------------------------------------------
  const autoDir = runBuild(viteCli, appDir, {
    outDir: AUTO_OUT_DIR,
    base: "/",
    updateMode: "auto",
    staticOnly: true,
  });
  const autoWorker = readText("pwa:auto", join(autoDir, "sw.js"), "sw.js");
  check(
    "pwa:auto",
    /self\.skipWaiting\(\)/.test(autoWorker) || /skipWaiting/.test(autoWorker),
    "the auto-update worker never activates a waiting worker",
  );
  check(
    "pwa:auto",
    /clientsClaim/.test(autoWorker) || /clients\.claim\(\)/.test(autoWorker),
    "the auto-update worker never claims clients",
  );
  check(
    "pwa:auto",
    existsSync(join(autoDir, "manifest.webmanifest")),
    "the auto-update build emitted no manifest",
  );
  log("[pwa:auto] ok  auto-update mode activates and claims without the prompt");

  // --- disabled -------------------------------------------------------------
  const offDir = runBuild(viteCli, appDir, {
    outDir: OFF_OUT_DIR,
    base: "/",
    disabled: true,
    staticOnly: true,
  });
  for (const relative of ["manifest.webmanifest", "sw.js", "folio-version.json"]) {
    check(
      "pwa:off",
      !existsSync(join(offDir, relative)),
      `disable: true still emitted ${relative}`,
    );
  }
  check(
    "pwa:off",
    !readText("pwa:off", join(offDir, "index.html"), "the disabled home page").includes(
      'rel="manifest"',
    ),
    "disable: true still added a manifest link",
  );
  check(
    "pwa:off",
    existsSync(join(offDir, "docs", "hello", "index.html")),
    "disable: true broke static route generation",
  );
  log("[pwa:off]   ok  disable: true emits no PWA output and keeps the static site");

  return { appDir };
}
