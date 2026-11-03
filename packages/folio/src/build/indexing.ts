// Build-layer indexing policy (FOL-028 / Issue #127).
//
// This module is the single place that decides which robots signals a static
// build emits. The public surface is only
// `FolioStaticBuildOptions.siteIndexing`; nothing here is re-exported from
// `src/index.ts` or `src/build/vite-adapter.ts`, so the helpers stay internal
// and cannot freeze a second public API.
//
// The policy is explicit opt-in only. Hostnames, deployment providers
// (`github.io`), `localhost`, sub-paths, environment variables and repository
// names are deliberately NOT inputs: guessing that a site is a preview is the
// failure mode this contract exists to prevent. A consumer that deploys a
// preview must say so.
//
// robots.txt tradeoff (frozen): a `Disallow: /` robots.txt would hide the pages
// from crawlers, including the page-level `<meta name="robots">` that requests
// removal from the index. Preview mode therefore keeps crawling allowed and
// uses an explicit marker comment instead. A robots.txt `Disallow` is not
// search-result removal either way; URLs that were already indexed need a
// separate search-engine removal request.

export const FOLIO_INDEXING_DEFAULT_ROBOTS = "index,follow";
export const FOLIO_INDEXING_NOINDEX_ROBOTS = "noindex,nofollow";

// `404.html` is never a page worth indexing. It stays noindex in both indexing
// policies; an explicit `FolioStaticRoute.robots` on the not-found route still
// wins over this not-found default.
export const FOLIO_NOT_FOUND_ROBOTS = FOLIO_INDEXING_NOINDEX_ROBOTS;

// Written into the preview robots.txt so a human (and a diff) can see why the
// otherwise permissive file exists.
export const FOLIO_PREVIEW_ROBOTS_MARKER =
  "# Preview build: site-wide noindex. Crawling stays allowed so crawlers can read the page-level noindex.";

export type FolioSiteIndexing = "index" | "noindex";

/**
 * Validate the public `siteIndexing` option before any output is written.
 *
 * A typo such as `"no-index"` must fail loudly: silently falling back to the
 * indexable default would publish a preview that search engines may collect,
 * which is exactly what this option is supposed to prevent. The option is
 * unchecked at runtime for plain-JavaScript consumers, so this guard is the
 * real contract for them.
 */
export function assertFolioSiteIndexing(
  value: unknown,
): asserts value is FolioSiteIndexing | undefined {
  if (value === undefined || value === "index" || value === "noindex") return;
  throw new Error(
    `folio static siteIndexing must be "index" or "noindex", got ${JSON.stringify(
      value,
    )}; refusing to write a static site whose indexing policy is ambiguous`,
  );
}

/** The built-in page-level robots value for a site indexing policy. */
export function folioIndexingRobots(
  siteIndexing: FolioSiteIndexing | undefined,
): string {
  return siteIndexing === "noindex"
    ? FOLIO_INDEXING_NOINDEX_ROBOTS
    : FOLIO_INDEXING_DEFAULT_ROBOTS;
}

/**
 * Resolve one page's effective robots value.
 *
 * Precedence: explicit `route.robots` > the supplied fallback (the site policy
 * for ordinary pages, the not-found default for `404.html`) > nothing, because
 * every caller supplies a fallback. Falsy `route.robots` values keep their
 * historical meaning: absent, `undefined` and `""` all fall back instead of
 * emitting an empty `content=""`.
 */
export function resolveFolioIndexingRobots(
  routeRobots: string | undefined,
  fallback: string,
): string {
  return routeRobots || fallback;
}

/**
 * The exact `robots.txt` bytes for one build.
 *
 * Default mode is unchanged from before this option existed. Preview mode
 * keeps `Allow: /` on purpose and omits the `Sitemap:` line, because the
 * preview sitemap may still exist but must not be advertised.
 */
export function folioRobotsTxt(options: {
  siteIndexing: FolioSiteIndexing | undefined;
  sitemapUrl: string;
}): string {
  if (options.siteIndexing === "noindex") {
    return `${FOLIO_PREVIEW_ROBOTS_MARKER}\nUser-agent: *\nAllow: /\n`;
  }
  return `User-agent: *\nAllow: /\nSitemap: ${options.sitemapUrl}\n`;
}
