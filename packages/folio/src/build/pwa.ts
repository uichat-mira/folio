// Build/Adapter layer: optional PWA integration for Folio consumer sites
// (FOL-039 / Issue #160).
//
// `folioPwa()` is a thin, opinionated composition of the upstream
// `vite-plugin-pwa` (generateSW + Workbox) plugin. Folio does not implement a
// second Service Worker engine, cache layer, message bus or update state
// machine: the Workbox runtime and the official `virtual:pwa-register/react`
// client keep those responsibilities. What this module owns is the
// multi-page-static-publication contract that the upstream defaults get wrong:
//
//   1. No SPA navigation fallback. Workbox defaults `navigateFallback` to
//      "index.html", which would answer an unknown article URL with the home
//      page. Folio never sets it and rejects a consumer attempt to.
//   2. No HTML precache. Workbox's default `globPatterns` precache every
//      generated page, which would let an old article body survive a
//      publication. Folio precaches hashed JS/CSS plus explicit brand assets.
//   3. A content-only publication must be visible. `vite-plugin-pwa` builds the
//      worker in `closeBundle`, after `folio()`'s static write stage wrote the
//      real article/document/collection/404 pages. A Markdown-only change
//      therefore leaves every JS/CSS hash untouched and Workbox would emit a
//      byte-identical worker, so clients would never learn about the
//      deployment. `folio:pwa` hashes the generated HTML into a deterministic
//      content version, writes it to `<versionFile>`, and injects it into the
//      Workbox precache manifest as a revisioned entry, so the worker bytes
//      change with the content. No full-site HTML precache is involved.
//
// Hook order is explicit, not incidental: `folio()` writes pages in
// writeBundle, before any closeBundle; this module hashes the final pages and
// rewrites the version entry in a `closeBundle` hook with `order: "pre"`; and
// `vite-plugin-pwa` is pinned to `integration.closeBundleOrder: "post"` so
// Workbox always builds the worker from the final artifact set. The
// `folio:pwa-validate` hook then re-reads the emitted manifest and worker and
// fails the build if the deployment contract was violated.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import type {
  ManifestOptions,
  VitePWAOptions,
  VitePluginPWAAPI,
} from "vite-plugin-pwa";
import type { FolioConfig } from "../types";

/** Default deterministic content-version file written into the output root. */
export const FOLIO_PWA_CONTENT_VERSION_FILE = "folio-version.json";

/**
 * Update behaviour contract.
 *
 * `prompt` (default) never activates a new service worker or reloads the page
 * without an explicit reader confirmation. `auto` is a separate, explicit mode
 * that activates and reloads as soon as a new worker is ready.
 */
export type FolioPwaUpdateMode = "prompt" | "auto";

export type FolioPwaIcon = {
  /** Public-dir-relative or absolute URL of the icon asset. */
  src: string;
  /** `WxH` (for example "192x192") or "any" for a scalable asset. */
  sizes: string;
  /** Image MIME type. Defaults to "image/png". */
  type?: string;
  /** "any", "maskable", or a space-separated combination. */
  purpose?: string;
};

export type FolioPwaOptions = {
  /**
   * The same Folio config handed to `folio()`. Only used for safe manifest
   * defaults (name, short name, description); Folio never infers brand assets.
   */
  config: FolioConfig;
  /**
   * Consumer-owned brand assets. A 192x192 and a 512x512 square icon are
   * required: without them the manifest is not installable.
   */
  icons: FolioPwaIcon[];
  /** Manifest `theme_color`. Defaults to the Folio primary token value. */
  themeColor?: string;
  /** Manifest `background_color`. Defaults to the Folio canvas token value. */
  backgroundColor?: string;
  /** Manifest `lang`. Defaults to "en". */
  lang?: string;
  /**
   * Manifest `start_url`. Defaults to the PWA scope, so root and subpath
   * deployments work without consumer tuning. A custom value must stay inside
   * the scope.
   */
  startUrl?: string;
  /**
   * Manifest and Service Worker `scope`. Defaults to the Vite `base`. An
   * explicit value must equal that base: a scope that disagrees with the
   * deployment path produces an uninstallable app or an uncontrollable worker,
   * so the build fails instead.
   */
  scope?: string;
  /**
   * `prompt` (default) waits for an explicit confirmation before the new worker
   * takes control and the page reloads. `auto` is an explicit separate mode; the
   * Folio prompt UI cannot fire in it because the official client never reports
   * `waiting` in auto mode.
   */
  updateMode?: FolioPwaUpdateMode;
  /** Name of the generated content-version file. Defaults to `folio-version.json`. */
  versionFile?: string;
  /** Extra public-dir assets to precache (icons, fonts, brand images). */
  includeAssets?: string[];
  /**
   * Manifest overrides merged last. `scope`, `start_url` and `id` are rejected
   * here because they must stay derived from the deployment base.
   */
  manifest?: Partial<ManifestOptions>;
  /**
   * Narrow Workbox escape hatch. Navigation fallback, HTML globbing and the
   * generated worker files stay controlled by Folio: a multi-page publication
   * must not gain an SPA fallback or a stale-HTML precache.
   */
  workbox?: Partial<NonNullable<VitePWAOptions["workbox"]>>;
  /** Build the site without PWA output while keeping the integration in place. */
  disable?: boolean;
};

/** Deterministic content version of one built site. */
export type FolioPwaContentVersion = {
  version: string;
  pages: number;
};

const DEFAULT_THEME_COLOR = "#cc785c";
const DEFAULT_BACKGROUND_COLOR = "#faf9f5";

function fail(message: string): never {
  throw new Error(`[folio:pwa] ${message}`);
}

/** Normalize a deployment path to a leading and trailing slash form. */
function normalizePathPrefix(value: string): string {
  const withLeading = value.startsWith("/") ? value : `/${value}`;
  const collapsed = withLeading.replace(/\/{2,}/g, "/");
  return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}

function validateIcons(icons: FolioPwaIcon[]): void {
  if (!Array.isArray(icons) || icons.length === 0) {
    fail(
      "icons must list the consumer's brand assets; Folio does not infer icon sizes from config.logo",
    );
  }
  const seen = new Set<string>();
  for (const icon of icons) {
    if (!icon || typeof icon.src !== "string" || icon.src.trim() === "") {
      fail("every PWA icon needs a non-empty src");
    }
    if (typeof icon.sizes !== "string" || !/^(?:any|\d+x\d+)$/.test(icon.sizes.trim())) {
      fail(
        `icon ${JSON.stringify(icon.src)} has invalid sizes ${JSON.stringify(icon.sizes)}; use "WxH" or "any"`,
      );
    }
    // Manifest icon sizes describe the image's pixel box, and installability
    // requires square artwork: a 192x256 entry is not a valid install icon even
    // though both dimensions are large enough. Rejecting it here also keeps the
    // emitted-manifest check meaningful instead of a second, looser rule.
    const dimensions = /^(\d+)x(\d+)$/.exec(icon.sizes.trim());
    if (dimensions !== null && dimensions[1] !== dimensions[2]) {
      fail(
        `icon ${JSON.stringify(icon.src)} has non-square sizes ${JSON.stringify(icon.sizes)}; PWA icons must be square (for example "192x192")`,
      );
    }
    if (seen.has(icon.src)) fail(`icon ${JSON.stringify(icon.src)} is listed twice`);
    seen.add(icon.src);
  }
  // Installability requires *square* icons: a 192x256 asset that merely has both
  // dimensions large enough is not a valid manifest icon, so the dimension check
  // below is a real square check rather than a "both sides big enough" one.
  const squareSizes = new Set(
    icons
      .map((icon) => /^(\d+)x(\d+)$/.exec(icon.sizes.trim()))
      .filter((match): match is RegExpExecArray => match !== null && match[1] === match[2])
      .map((match) => Number(match[1])),
  );
  for (const size of [192, 512]) {
    if (![...squareSizes].some((candidate) => candidate >= size)) {
      fail(
        `icons must include a square icon of at least ${size}x${size}; the manifest would not be installable`,
      );
    }
  }
}

function validateGlobPatterns(patterns: unknown, source: string): void {
  if (patterns === undefined) return;
  if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== "string")) {
    fail(`${source} must be an array of glob strings`);
  }
  for (const pattern of patterns) {
    // Folio is a multi-page publisher: precaching HTML would let an old article
    // body survive a publication, so any pattern that could match it is rejected.
    if ((pattern as string).toLowerCase().includes("html")) {
      fail(
        `${source} may not precache HTML (${JSON.stringify(pattern)}); Folio keeps content pages out of the offline shell`,
      );
    }
  }
}

function validateWorkbox(workbox: FolioPwaOptions["workbox"]): void {
  if (workbox === undefined) return;
  if (typeof workbox !== "object" || workbox === null || Array.isArray(workbox)) {
    fail("workbox must be an object");
  }
  if (workbox.navigateFallback) {
    fail(
      "navigateFallback is not supported: Folio is a multi-page publication, so an unknown article URL must reach the real 404 page instead of the home page",
    );
  }
  if ("navigateFallbackAllowlist" in workbox || "navigateFallbackDenylist" in workbox) {
    fail(
      "navigateFallbackAllowlist/Denylist only make sense with navigateFallback, which Folio never sets",
    );
  }
  validateGlobPatterns(workbox.globPatterns, "workbox.globPatterns");
  if (workbox.runtimeCaching !== undefined && !Array.isArray(workbox.runtimeCaching)) {
    fail("workbox.runtimeCaching must be an array of Workbox route definitions");
  }
}

/** Recursively list generated HTML files, sorted for a deterministic hash. */
function listHtmlFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".html")) files.push(path);
    }
  };
  walk(root);
  return files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Deterministic content version for one built site.
 *
 * The version hashes the relative path and bytes of every generated HTML page,
 * so it changes for Markdown-only edits (a new article body, a new collection
 * entry, a new byline date) even when no JS/CSS asset hash changes. Identical
 * input always yields the same version: sorted order, no timestamps and no
 * absolute paths, so a rebuild with unchanged content cannot fabricate an
 * update.
 */
export function computeFolioContentVersion(outDir: string): FolioPwaContentVersion {
  const root = resolve(outDir);
  if (!existsSync(root)) {
    fail(`output directory ${JSON.stringify(root)} does not exist; run the site build first`);
  }
  const files = listHtmlFiles(root);
  if (files.length === 0) {
    fail(
      `no generated HTML found in ${JSON.stringify(root)}; folioPwa() needs a build that writes at least index.html`,
    );
  }
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(root, file).replace(/\\/g, "/")).update("\0");
    hash.update(readFileSync(file)).update("\0");
  }
  return { version: hash.digest("hex").slice(0, 32), pages: files.length };
}

/** The plugin's public API for revising the Workbox precache manifest. */
function workboxApi(plugins: Plugin[]): VitePluginPWAAPI | undefined {
  for (const plugin of plugins) {
    const api = (plugin as { api?: VitePluginPWAAPI }).api;
    if (api && typeof api.extendManifestEntries === "function") return api;
  }
  return undefined;
}

function entryUrl(entry: string | { url: string }): string {
  return typeof entry === "string" ? entry : entry.url;
}

function resolveManifest(options: FolioPwaOptions): Partial<ManifestOptions> {
  const { config } = options;
  const override = options.manifest ?? {};
  for (const field of ["scope", "start_url", "id"] as const) {
    if (field in override) {
      fail(
        `manifest.${field} must not be overridden; it is derived from the Vite base so root and subpath deployments stay installable (use the dedicated option instead)`,
      );
    }
  }
  // `icons` is validated for installability (square 192 and 512, real artifacts)
  // and then re-checked on the emitted manifest. Allowing the generic manifest
  // override to replace it would let a consumer ship an unvalidated icon set, so
  // the dedicated `icons` option is the only way in.
  if ("icons" in override) {
    fail(
      "manifest.icons must not be overridden; pass the icons to the dedicated `icons` option so Folio can validate sizes, purposes and the emitted files",
    );
  }
  return {
    name: config.title,
    short_name: config.title,
    description: config.description,
    lang: options.lang ?? "en",
    display: "standalone",
    theme_color: options.themeColor ?? DEFAULT_THEME_COLOR,
    background_color: options.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    icons: options.icons.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      type: icon.type ?? "image/png",
      ...(icon.purpose ? { purpose: icon.purpose } : {}),
    })),
    ...override,
  };
}

// --- multi-page precache safety -------------------------------------------
//
// A precache entry is an opaque string to Workbox: it is fetched at runtime and
// cached under that URL. An entry only has to *look* like an asset for the
// build to succeed, so `assets/app-1234.js` and `blogs/first-post/` are the same
// kind of value to Workbox -- but the second one is a generated article page.
// Folio therefore never trusts the entry's spelling. Every entry is normalised
// (percent-decoding, query/fragment removal, dot-segment resolution, base
// resolution) and then resolved against the real build output, so a directory
// URL, a route alias, an `index` suffix or an encoded path cannot smuggle a
// generated page into the offline shell.

const HTML_EXTENSIONS = [".html", ".htm"];
/** Extensions that can never name a generated page. */
const STATIC_ASSET_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".map",
  ".json",
  ".webmanifest",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".txt",
  ".xml",
  ".pdf",
  ".wasm",
];

/** Strip a query/fragment and percent-decode one precache URL path. */
function decodedUrlPath(url: string, source: string): string {
  const withoutQuery = url.split("#")[0].split("?")[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return fail(
      `${source} contains the malformed percent-encoding ${JSON.stringify(url)}; the precache entry cannot be resolved to a build artifact`,
    );
  }
  // A decoded separator must behave like a separator, not like a literal
  // character inside a file name (%2F and %5C both decode to a path break).
  return decoded.replace(/\\\\/g, "/");
}

/**
 * Map a manifest/worker URL to a path inside the build output.
 *
 * The deployment serves the *contents of outDir* at the Vite base, so:
 *   - a relative URL (`assets/app-1.js`, `icon-192.png`) is relative to the
 *     worker/manifest, which live at the base: it maps to the same path inside
 *     outDir, whatever the base is;
 *   - an absolute URL (`/folio/app.css`) is a site path: it must start with the
 *     base, and the base prefix is what outDir stands for. Anything else points
 *     at another deployment on the origin and is rejected;
 *   - a cross-origin URL is always rejected.
 *
 * Dot segments are resolved first, so `a/../b.css` cannot escape the output
 * directory and `docs/hello/` is recognised as the page it is.
 */
function precacheUrlToRelative(url: string, base: string, source: string): string {
  const path = decodedUrlPath(url, source);
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) {
    return fail(
      `${source} contains the absolute URL ${JSON.stringify(url)}; Folio never precaches cross-origin responses`,
    );
  }
  const scope = normalizePathPrefix(base);
  let siteRelative: string;
  if (path.startsWith("/")) {
    if (scope !== "/" && path !== scope.slice(0, -1) && !path.startsWith(scope)) {
      return fail(
        `${source} contains ${JSON.stringify(url)}, which resolves outside the deployment scope ${JSON.stringify(scope)}`,
      );
    }
    siteRelative = path.slice(scope === "/" ? 1 : scope.length);
  } else {
    siteRelative = path;
  }
  const segments: string[] = [];
  for (const segment of siteRelative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        return fail(`${source} contains ${JSON.stringify(url)}, which escapes the build output`);
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

/** Whether a resolved output-relative path names a page instead of an asset. */
function describesGeneratedPage(relative: string): boolean {
  const lower = relative.toLowerCase();
  for (const extension of HTML_EXTENSIONS) {
    if (lower.endsWith(extension)) return true;
  }
  if (lower.endsWith("/")) return true;
  const segments = lower.split("/");
  const last = segments[segments.length - 1] ?? "";
  if (last === "") return true;
  // A route alias: `/docs/index` is served by `docs/index.html`.
  const dot = last.lastIndexOf(".");
  const stem = dot === -1 ? last : last.slice(0, dot);
  if (stem === "index") return true;
  // An extensionless URL can be a directory route on any static host, and a
  // precache entry must be a *file* whose bytes are known.
  if (dot === -1) return true;
  return false;
}

/** Whether a resolved path can be precached as a static asset. */
function isStaticAssetPath(relative: string): boolean {
  const lower = relative.toLowerCase();
  return STATIC_ASSET_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Config-time guard for the entries a consumer hands to Workbox directly.
 *
 * The authoritative check runs against the emitted manifest below; this one
 * fails earlier with a message that names the offending option, so a consumer
 * learns which value is wrong instead of only that the build was rejected.
 */
function assertPrecacheEntryIsNotAPage(url: string, source: string): void {
  if (typeof url !== "string" || url.trim() === "") {
    fail(`${source} contains an empty precache entry`);
  }
  const relative = precacheUrlToRelative(url, "/", source);
  if (describesGeneratedPage(relative)) {
    fail(
      `${source} contains ${JSON.stringify(url)}, which names a generated page; Folio keeps article and document HTML out of the offline shell`,
    );
  }
}

/** All URLs that a consumer can inject into the Workbox precache manifest. */
function validateConsumerPrecacheEntries(
  options: FolioPwaOptions,
  versionFile: string,
): void {
  const includeAssets = options.includeAssets ?? [];
  for (const entry of includeAssets) {
    assertPrecacheEntryIsNotAPage(entry, "includeAssets");
  }
  const additional = options.workbox?.additionalManifestEntries ?? [];
  for (const entry of additional) {
    const url = entryUrl(entry);
    if (url === versionFile) continue;
    assertPrecacheEntryIsNotAPage(url, "workbox.additionalManifestEntries");
  }
  const templated = options.workbox?.templatedURLs;
  if (templated !== undefined) {
    if (typeof templated !== "object" || templated === null || Array.isArray(templated)) {
      fail("workbox.templatedURLs must be an object keyed by the URL it precaches");
    }
    for (const url of Object.keys(templated)) {
      assertPrecacheEntryIsNotAPage(url, "workbox.templatedURLs");
    }
  }
  // `workbox.manifestTransforms` cannot be inspected (it is a function), so it
  // is deliberately allowed and caught by the emitted-manifest validation: any
  // entry it injects is checked against the real build output.
}

type PrecacheEntry = { url: string; revision: string | null };

/**
 * Precache entries of the generated worker, read from the emitted artifact.
 *
 * Fails closed: a worker whose manifest cannot be read is a build failure, not
 * an empty list. Returning `[]` here would make every downstream safety check
 * vacuously true -- precisely how an HTML precache could ship unnoticed.
 */
function readWorkerPrecacheManifest(worker: string): PrecacheEntry[] {
  const match = /precacheAndRoute\(\s*\[([\s\S]*?)\]\s*(?:,|\))/.exec(worker);
  if (!match) {
    fail(
      "the generated service worker has no readable precacheAndRoute([...]) manifest; Folio cannot verify the offline-shell boundary",
    );
  }
  // Validate every emitted entry. The former matchAll regex silently skipped
  // objects with extra fields (e.g. an integrity-bearing HTML entry).
  // Parse the full Workbox literal array as data; never execute worker code.
  // If the upstream generator changes its syntax, fail closed.
  const literal = "[" + match[1] + "]"; 
  const json = literal.replace(
    /([,{]\s*)([A-Za-z_$][\w$]*)\s*:/g,
    (_match, prefix: string, key: string) => prefix + '"' + key + '":',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    fail("the generated service worker precache manifest has unreadable entries; refusing a partial parse");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail("the generated service worker precache manifest is empty or not an array");
  }
  return parsed.map((raw: unknown, index: number): PrecacheEntry => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      fail("precache entry " + index + " is not a literal object");
    }
    const entry = raw as Record<string, unknown>;
    if (Object.keys(entry).some((key) => !["url", "revision", "integrity"].includes(key))) {
      fail("precache entry " + index + " has unsupported fields; refusing an unverified manifest");
    }
    if (
      typeof entry.url !== "string" ||
      !(entry.revision === null || typeof entry.revision === "string") ||
      (entry.integrity !== undefined && typeof entry.integrity !== "string")
    ) {
      fail("precache entry " + index + " has invalid URL, revision or integrity");
    }
    return { url: entry.url, revision: entry.revision };
  });
}

/**
 * Check real local icon artwork instead of trusting the manifest size label.
 * A real 1x1 PNG labeled 512x512 cannot be an installable application icon.
 * SVG is scalable, but its intrinsic viewport must be square.
 */
function validateLocalIconArtwork(file: string, icon: FolioPwaIcon): void {
  const mime = icon.type ?? "image/png";
  if (mime === "image/png") {
    const bytes = readFileSync(file);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (
      bytes.length < 24 ||
      !bytes.subarray(0, 8).equals(signature) ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR"
    ) {
      fail("PWA icon " + JSON.stringify(icon.src) + " has an invalid PNG header");
    }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const claimed = /^(\d+)x(\d+)$/.exec(icon.sizes.trim());
    if (!claimed || width === 0 || width !== height ||
      width !== Number(claimed[1]) || height !== Number(claimed[2])) {
      fail(
        "PWA icon " + JSON.stringify(icon.src) + " has actual PNG dimensions " +
        width + "x" + height + ", but declares " + JSON.stringify(icon.sizes) +
        "; provide matching square artwork",
      );
    }
    return;
  }
  if (mime === "image/svg+xml") {
    const source = readFileSync(file, "utf8");
    const svg = /<svg\b([^>]*)>/i.exec(source)?.[1];
    if (!svg) fail("PWA icon " + JSON.stringify(icon.src) + " is not an SVG document");
    const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(svg)?.[1];
    const box = viewBox?.trim().split(/[\s,]+/).map(Number);
    if (box && (box.length !== 4 || box.some((n) => !Number.isFinite(n)) ||
      box[2] <= 0 || box[2] !== box[3])) {
      fail("PWA icon " + JSON.stringify(icon.src) + " has a non-square SVG viewBox");
    }
    const width = /\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(svg)?.[1];
    const height = /\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(svg)?.[1];
    if (width && height && (Number(width) <= 0 || Number(width) !== Number(height))) {
      fail("PWA icon " + JSON.stringify(icon.src) + " has non-square SVG dimensions");
    }
    if (!box && !(width && height)) {
      fail("PWA icon " + JSON.stringify(icon.src) + " needs a square SVG viewBox or width/height");
    }
    return;
  }
  // Other raster formats require a format-specific decoder. Do not claim they
  // were validated merely because the file exists.
  fail("cannot verify local PWA icon " + JSON.stringify(icon.src) +
    " of type " + JSON.stringify(mime) + "; use PNG or SVG");
}

/**
 * Icons must survive the trip into the emitted manifest.
 *
 * The consumer's `icons` option is the single source of truth: `manifest.icons`
 * is rejected in `resolveManifest`, and this re-reads `manifest.webmanifest` to
 * prove the emitted document still lists exactly those icons, with square sizes
 * and a real file (or an explicit remote/data URL) behind each `src`.
 */
function validateManifestIcons(
  manifest: { icons?: unknown },
  expected: FolioPwaIcon[],
  outDir: string,
  base: string,
): void {
  const actual = manifest.icons;
  if (!Array.isArray(actual)) {
    fail("the emitted manifest.webmanifest has no icons array; the app would not be installable");
  }
  if (actual.length !== expected.length) {
    fail(
      `the emitted manifest lists ${actual.length} icon(s) while the consumer configured ${expected.length}; ` +
        "a manifest override must not change the validated icon set",
    );
  }
  const square = (sizes: unknown): boolean => {
    if (typeof sizes !== "string") return false;
    if (sizes.trim() === "any") return true;
    const match = /^(\d+)x(\d+)$/.exec(sizes.trim());
    return match !== null && match[1] === match[2];
  };
  for (const [index, icon] of expected.entries()) {
    const emitted = actual[index] as { src?: unknown; sizes?: unknown; type?: unknown; purpose?: unknown };
    if (!emitted || typeof emitted !== "object") {
      fail(`the emitted manifest icon ${index} is not an object`);
    }
    if (emitted.src !== icon.src) {
      fail(
        `the emitted manifest icon ${index} src is ${JSON.stringify(emitted.src)}, expected ${JSON.stringify(icon.src)}`,
      );
    }
    const expectedSizes = icon.sizes.trim();
    if (emitted.sizes !== expectedSizes) {
      fail(
        `the emitted manifest icon ${index} sizes is ${JSON.stringify(emitted.sizes)}, expected ${JSON.stringify(expectedSizes)}`,
      );
    }
    if (!square(emitted.sizes)) {
      fail(
        `the emitted manifest icon ${index} (${JSON.stringify(emitted.src)}) has non-square sizes ${JSON.stringify(emitted.sizes)}; installable icons must be square`,
      );
    }
    const expectedType = icon.type ?? "image/png";
    if (emitted.type !== expectedType) {
      fail(
        `the emitted manifest icon ${index} type is ${JSON.stringify(emitted.type)}, expected ${JSON.stringify(expectedType)}`,
      );
    }
    if ((icon.purpose ? icon.purpose : undefined) !== (emitted.purpose ?? undefined)) {
      fail(
        `the emitted manifest icon ${index} purpose is ${JSON.stringify(emitted.purpose)}, expected ${JSON.stringify(icon.purpose)}`,
      );
    }
  }
  const sizes = new Set(
    (actual as { sizes?: string }[]).map((icon) => (typeof icon.sizes === "string" ? icon.sizes.trim() : "")),
  );
  for (const required of ["192x192", "512x512"]) {
    if (!sizes.has(required)) {
      fail(
        `the emitted manifest has no ${required} icon; the app would not be installable`,
      );
    }
  }
  for (const icon of expected) {
    const src = icon.src;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) {
      // A remote or data: icon is valid in a manifest, but Folio cannot verify
      // a file it does not own.
      continue;
    }
    const relative = precacheUrlToRelative(src, base, "icons");
    const file = join(outDir, relative);
    if (!existsSync(file)) {
      fail(
        `the configured icon ${JSON.stringify(src)} is not part of the build output (${relative}); the manifest would advertise a missing file. ` +
          `Use a base-relative src such as "icons/icon-192.png": the manifest is served from the deployment base, so a leading "/" breaks a subpath deployment`,
      );
    }
    validateLocalIconArtwork(file, icon);
  }
}

/**
 * Asserts the deployment contract on the real build artifacts (the emitted
 * manifest, the generated worker and the emitted precache manifest) instead of
 * on the options Folio passed in, so an upstream default change or a consumer
 * escape hatch cannot silently reintroduce an SPA fallback, a scope mismatch, an
 * HTML precache or a worker without the content version.
 */
function validateGeneratedSite(
  outDir: string,
  base: string,
  versionFile: string,
  expectedIcons: FolioPwaIcon[],
): void {
  const expected = normalizePathPrefix(base);

  const manifestPath = join(outDir, "manifest.webmanifest");
  if (!existsSync(manifestPath)) {
    fail(
      `expected ${JSON.stringify(manifestPath)} to exist after the build; vite-plugin-pwa did not emit the web manifest`,
    );
  }
  let manifest: { scope?: string; start_url?: string; icons?: unknown };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`manifest.webmanifest is not valid JSON: ${(error as Error).message}`);
  }
  if (manifest.scope !== expected) {
    fail(
      `manifest scope ${JSON.stringify(manifest.scope)} does not match the deployment base ${JSON.stringify(expected)}`,
    );
  }
  const startUrl =
    typeof manifest.start_url === "string" ? normalizePathPrefix(manifest.start_url) : "";
  if (!startUrl.startsWith(expected)) {
    fail(
      `manifest start_url ${JSON.stringify(manifest.start_url)} is outside the deployment base ${JSON.stringify(expected)}`,
    );
  }
  validateManifestIcons(manifest, expectedIcons, outDir, base);

  const versionPath = join(outDir, versionFile);
  if (!existsSync(versionPath)) {
    fail(`expected the content version file ${JSON.stringify(versionPath)} after the build`);
  }
  let version: string;
  try {
    version = (JSON.parse(readFileSync(versionPath, "utf8")) as { version: string }).version;
  } catch (error) {
    fail(`${versionFile} is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof version !== "string" || !/^[0-9a-f]{8,}$/.test(version)) {
    fail(`${versionFile} does not carry a hexadecimal content version: ${JSON.stringify(version)}`);
  }

  const workerPath = join(outDir, "sw.js");
  if (!existsSync(workerPath)) {
    fail(`expected the generated service worker ${JSON.stringify(workerPath)} after the build`);
  }
  const worker = readFileSync(workerPath, "utf8");
  if (!worker.includes(versionFile) || !worker.includes(version)) {
    fail(
      `the generated service worker does not precache ${versionFile} with content version ${JSON.stringify(version)}; the content-update signal never reached Workbox`,
    );
  }
  if (/navigateFallback|NavigationRoute/.test(worker)) {
    fail(
      "the generated service worker contains a navigation fallback; Folio is a multi-page publication and must not answer unknown URLs with the home page",
    );
  }

  // Authoritative check: resolve every emitted entry against the build output.
  const precached = readWorkerPrecacheManifest(worker);
  const pageEntries: string[] = [];
  for (const entry of precached) {
    const relative = precacheUrlToRelative(entry.url, base, "the generated precache manifest");
    const absolute = join(outDir, relative);
    const exists = existsSync(absolute);
    if (describesGeneratedPage(relative)) {
      pageEntries.push(entry.url);
      continue;
    }
    if (!exists) {
      fail(
        `the generated service worker precaches ${JSON.stringify(entry.url)}, which is not part of the build output (${relative}); a precache entry must name a real artifact`,
      );
    }
    if (!isStaticAssetPath(relative)) {
      fail(
        `the generated service worker precaches ${JSON.stringify(entry.url)} (${relative}), which Folio cannot classify as a static asset`,
      );
    }
  }
  if (pageEntries.length > 0) {
    fail(
      `the generated service worker precaches generated pages (${pageEntries.slice(0, 3).join(", ")}); ` +
        "article content must stay out of the offline shell, and a directory, alias or percent-encoded URL is still that page",
    );
  }
  for (const forbidden of ["sw.js", "registerSW.js"]) {
    if (precached.some((entry) => precacheUrlToRelative(entry.url, base, "sw") === forbidden)) {
      fail(`the generated service worker precaches ${forbidden}; a stale worker copy must never ship`);
    }
  }
  if (!/cleanupOutdatedCaches\(\)/.test(worker)) {
    fail("the generated service worker does not clean outdated precaches");
  }
}

/**
 * Optional PWA integration for a Folio consumer site.
 *
 * Returns the Vite plugin array to spread into `plugins`. Plain `folio()` users
 * are unaffected: nothing is emitted or registered unless this function is
 * called, and no Service Worker is registered unless the consumer also mounts
 * `useFolioPwaUpdate()` or `<FolioPwaUpdatePrompt />` from
 * `@uichat-mira/folio/pwa/react`.
 */
export function folioPwa(options: FolioPwaOptions): Plugin[] {
  if (!options || typeof options !== "object") {
    fail("folioPwa() requires an options object");
  }
  if (!options.config || typeof options.config !== "object") {
    fail("folioPwa() requires the Folio config used by folio()");
  }
  if (typeof options.config.title !== "string" || options.config.title.trim() === "") {
    fail("folioPwa() requires config.title; it becomes the manifest name");
  }
  if (typeof options.config.description !== "string") {
    fail("folioPwa() requires config.description; it becomes the manifest description");
  }
  if (
    options.updateMode !== undefined &&
    options.updateMode !== "prompt" &&
    options.updateMode !== "auto"
  ) {
    fail(
      `updateMode must be "prompt" or "auto", got ${JSON.stringify(options.updateMode)}; the two update modes cannot be mixed`,
    );
  }
  if (options.versionFile !== undefined) {
    if (
      typeof options.versionFile !== "string" ||
      options.versionFile.trim() === "" ||
      options.versionFile.includes("/") ||
      options.versionFile.includes("\\")
    ) {
      fail("versionFile must be a plain file name in the output root");
    }
  }
  if (options.scope !== undefined) {
    if (typeof options.scope !== "string" || options.scope.trim() === "") {
      fail("scope must be a non-empty string");
    }
    if (!options.scope.startsWith("/")) {
      fail(
        `scope must be an absolute site path starting with "/", got ${JSON.stringify(options.scope)}`,
      );
    }
  }
  if (options.startUrl !== undefined) {
    if (typeof options.startUrl !== "string" || options.startUrl.trim() === "") {
      fail("startUrl must be a non-empty string");
    }
    if (!options.startUrl.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(options.startUrl)) {
      fail(
        `startUrl must be a site-relative path starting with "/", got ${JSON.stringify(options.startUrl)}`,
      );
    }
  }
  validateIcons(options.icons);
  validateWorkbox(options.workbox);
  validateGlobPatterns(options.includeAssets, "includeAssets");

  const updateMode: FolioPwaUpdateMode = options.updateMode ?? "prompt";
  const versionFile = options.versionFile ?? FOLIO_PWA_CONTENT_VERSION_FILE;
  validateConsumerPrecacheEntries(options, versionFile);
  const manifest = resolveManifest(options);

  let config: ResolvedConfig | undefined;
  const applyDeploymentScope = (base: string): void => {
    if (!base.startsWith("/")) {
      fail(
        `the PWA integration needs an absolute Vite base (for example "/" or "/folio/"), got ${JSON.stringify(base)}: a relative base cannot define a valid Service Worker scope`,
      );
    }
    const scope = normalizePathPrefix(base);
    if (options.scope !== undefined && normalizePathPrefix(options.scope) !== scope) {
      fail(
        `scope ${JSON.stringify(options.scope)} does not match the Vite base ${JSON.stringify(base)}; both must describe the same deployment path`,
      );
    }
    const startUrl = options.startUrl ?? scope;
    if (!normalizePathPrefix(startUrl).startsWith(scope)) {
      fail(
        `startUrl ${JSON.stringify(startUrl)} is outside the deployment base ${JSON.stringify(scope)}`,
      );
    }
    manifest.scope = scope;
    manifest.start_url = startUrl;
    // `id` participates in install identity; pinning it to the start URL keeps a
    // re-install from creating a second app entry after a base change.
    manifest.id = startUrl;
  };

  const pwaPlugins = VitePWA({
    registerType: updateMode === "auto" ? "autoUpdate" : "prompt",
    // Registration belongs to the consumer's client bundle through the official
    // `virtual:pwa-register/react` hook. Injecting a registration script into
    // every generated static page would register once per route and bypass the
    // prompt contract entirely.
    injectRegister: false,
    strategies: "generateSW",
    filename: "sw.js",
    manifestFilename: "manifest.webmanifest",
    manifest,
    includeAssets: options.includeAssets,
    ...(options.scope !== undefined ? { scope: normalizePathPrefix(options.scope) } : {}),
    workbox: {
      ...options.workbox,
      // Enforced after the consumer's escape hatch: these decide the multi-page
      // safety of the whole integration.
      navigateFallback: undefined,
      globPatterns: ["**/*.{js,css}"],
      globIgnores: [
        "**/*.html",
        // A rebuild into a non-empty outDir would otherwise precache the
        // previous copy of the generated worker files.
        "sw.js",
        "workbox-*.js",
        ...(options.workbox?.globIgnores ?? []),
      ],
      cleanupOutdatedCaches: true,
      // No implicit runtime caching: no API, no authenticated and no
      // cross-origin responses. Any additional route is an explicit consumer
      // decision with a documented reason.
      runtimeCaching: options.workbox?.runtimeCaching ?? [],
      additionalManifestEntries: (options.workbox?.additionalManifestEntries ?? []).filter(
        (entry) => entryUrl(entry) !== versionFile,
      ),
      // `auto` is the only mode that activates without asking. Upstream only
      // applies these two when it also injects the registration script, and
      // Folio always registers through the client bundle, so they are set here
      // explicitly instead of relying on that side effect.
      ...(updateMode === "auto" ? { skipWaiting: true, clientsClaim: true } : {}),
    },
    // Pin the upstream Workbox generation after every `pre` closeBundle hook so
    // the content version and the generated pages are always final inputs
    // instead of racing the worker build.
    integration: { closeBundleOrder: "post" },
    devOptions: { enabled: false },
    showMaximumFileSizeToCacheInBytesWarning: true,
    ...(options.disable ? { disable: true } : {}),
  });

  const pwaApi = workboxApi(pwaPlugins);

  const folioPwaPlugin: Plugin = {
    name: "folio:pwa",
    // Matches folio()'s adapter: the ordering below is explicit, not incidental.
    enforce: "pre",

    // The deployment base is known before any plugin resolves its options, so
    // scope/start_url are set here rather than racing the upstream plugin's own
    // configResolved. `base` is absent in the common root deployment, where Vite
    // defaults to "/", so the manifest must be finalized for that case too; the
    // resolved base is re-validated below.
    config(userConfig: UserConfig) {
      if (options.disable) return undefined;
      applyDeploymentScope(userConfig.base ?? "/");
      return undefined;
    },

    configResolved(resolved) {
      config = resolved;
      if (options.disable) return;
      // Validate only: the manifest object was already finalized in `config`,
      // which every plugin's `config` hook precedes the first `configResolved`.
      const base = resolved.base;
      if (!base.startsWith("/")) {
        fail(
          `the PWA integration needs an absolute Vite base (for example "/" or "/folio/"), got ${JSON.stringify(base)}`,
        );
      }
      const scope = normalizePathPrefix(base);
      if (options.scope !== undefined && normalizePathPrefix(options.scope) !== scope) {
        fail(
          `scope ${JSON.stringify(options.scope)} does not match the Vite base ${JSON.stringify(base)}; both must describe the same deployment path`,
        );
      }
      if (
        manifest.scope !== scope ||
        typeof manifest.start_url !== "string" ||
        !manifest.start_url.startsWith(scope)
      ) {
        fail(
          `the PWA manifest deployment fields (scope ${JSON.stringify(manifest.scope)}, start_url ${JSON.stringify(manifest.start_url)}) do not match the Vite base ${JSON.stringify(base)}`,
        );
      }
      // No manifest entry is reserved here on purpose. vite-plugin-pwa resolves
      // its options inside its own async `configResolved`, and Vite runs every
      // `configResolved` hook concurrently, so `api.extendManifestEntries()`
      // can observe an unresolved plugin context. The version entry is added
      // only in the `pre` closeBundle hook below, which runs after option
      // resolution and before the pinned `post` worker build.
    },

    closeBundle: {
      // `sequential` keeps this hook serialized with the other closeBundle
      // hooks; `pre` runs it after every static write (so folio()'s generated
      // pages exist) and before the upstream worker build (pinned to `post`).
      sequential: true,
      order: "pre",
      handler(error: Error | undefined) {
        if (error || !config || options.disable) return;
        const outDir = resolve(config.root, config.build.outDir);
        const { version, pages } = computeFolioContentVersion(outDir);
        writeFileSync(
          join(outDir, versionFile),
          `${JSON.stringify({ version, pages })}\n`,
          "utf8",
        );
        pwaApi?.extendManifestEntries((entries) => [
          ...entries.filter((entry) => entryUrl(entry) !== versionFile),
          { url: versionFile, revision: version },
        ]);
        config?.logger.info(
          `[folio:pwa] content version ${version} from ${pages} generated page${pages === 1 ? "" : "s"} -> ${versionFile}`,
        );
      },
    },
  };

  const validationPlugin: Plugin = {
    name: "folio:pwa-validate",
    // No `enforce: "pre"`: Vite sorts closeBundle hooks by `enforce` before
    // `order`, and the upstream worker build plugin is itself `enforce: "post"`.
    // A `pre` plugin would therefore validate before `sw.js` exists. This plugin
    // is appended after the upstream plugin array below, so within the shared
    // `post`/`post` bucket it runs last.
    enforce: "post",
    closeBundle: {
      // `post` runs after every default-order closeBundle hook, which is where
      // vite-plugin-pwa writes the worker.
      sequential: true,
      order: "post",
      handler(error: Error | undefined) {
        if (error || !config || options.disable) return;
        validateGeneratedSite(
          resolve(config.root, config.build.outDir),
          config.base,
          versionFile,
          options.icons,
        );
      },
    },
  };

  return [folioPwaPlugin, ...pwaPlugins, validationPlugin];
}
