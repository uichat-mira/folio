// Build layer: the single projection from Folio content/config to the
// structured metadata emitted by the default static pages (FOL-027 / #126).
//
// Responsibilities:
//   - map a route to the conservative Schema.org page type
//     (WebSite / CollectionPage / Article / TechArticle);
//   - resolve authors with one precedence rule
//     (document frontmatter > `config.author` > omit the property);
//   - project only *trusted* Folio dates (`publishedAt` / `updatedAt`) and the
//     per-route sitemap `<lastmod>`.
//
// Non-responsibilities: it never parses Git history, never reads the clock or
// file mtimes, and never renders HTML. `static.ts` stays the only caller; these
// helpers are intentionally not re-exported from the package entries.
import { normalizeFolioDate } from "../core/dates";
import { normalizeStaticRoute } from "../static-output";
import type { FolioAuthor, FolioConfig, FolioDoc } from "../types";
import type { FolioStaticBuildContext, FolioStaticRoute } from "../static";

const SCHEMA_CONTEXT = "https://schema.org";

type JsonLdPerson = { "@type": "Person"; name: string; url?: string };
type JsonLdObject = Record<string, unknown>;

// A Git first commit only proves when the file entered the current repository,
// so it is never a trustworthy original publication date. Build/deployment
// time and file mtimes are not Folio dates at all and never appear here.
const TRUSTED_PUBLISHED_AT: ReadonlySet<string> = new Set([
  "frontmatter",
  "legacy-date",
]);
const TRUSTED_UPDATED_AT: ReadonlySet<string> = new Set([
  "frontmatter",
  "git-last-commit",
]);

/**
 * The original publication date Folio may publish, or `undefined` when the
 * provenance does not allow it (notably `git-first-commit` and `unknown`).
 */
export function trustedFolioPublishedAt(
  doc: FolioDoc | undefined,
): string | undefined {
  if (!doc?.publishedAt) return undefined;
  return TRUSTED_PUBLISHED_AT.has(doc.dateSources?.publishedAt ?? "")
    ? doc.publishedAt
    : undefined;
}

/**
 * The modification date Folio may publish, or `undefined`. Only an explicit
 * frontmatter `updatedAt` or the latest Git commit for the file qualifies.
 */
export function trustedFolioUpdatedAt(
  doc: FolioDoc | undefined,
): string | undefined {
  if (!doc?.updatedAt) return undefined;
  return TRUSTED_UPDATED_AT.has(doc.dateSources?.updatedAt ?? "")
    ? doc.updatedAt
    : undefined;
}

function personFromAuthor(value: FolioAuthor): JsonLdPerson | undefined {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { "@type": "Person", name } : undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return undefined;
  const url = typeof value.url === "string" ? value.url.trim() : "";
  return url
    ? { "@type": "Person", name, url }
    : { "@type": "Person", name };
}

// Frontmatter keeps the legacy `dataList` semantics: an array (now also
// accepting `{ name, url }` objects instead of stringifying them) or one
// string split on `|`, `,` or `，`.
function frontmatterAuthors(value: unknown): JsonLdPerson[] {
  const people: JsonLdPerson[] = [];
  const add = (entry: unknown): void => {
    if (typeof entry === "string") {
      const name = entry.trim();
      if (name) people.push({ "@type": "Person", name });
      return;
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const person = personFromAuthor(entry as FolioAuthor);
      if (person) people.push(person);
      return;
    }
    if (typeof entry === "number" || typeof entry === "boolean") {
      people.push({ "@type": "Person", name: String(entry) });
    }
  };

  if (Array.isArray(value)) {
    for (const entry of value) add(entry);
  } else if (typeof value === "string" && value.trim()) {
    for (const part of value.split(/[|,，]/)) {
      const name = part.trim();
      if (name) people.push({ "@type": "Person", name });
    }
  } else if (value != null) {
    add(value);
  }

  return people;
}

// `config.author` is a typed API value, not frontmatter: a string is exactly
// one person and an array is exactly the configured list.
function configuredAuthors(config: FolioConfig): JsonLdPerson[] {
  const value = config.author;
  if (value === undefined || value === null) return [];
  const entries: FolioAuthor[] = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) => personFromAuthor(entry))
    .filter((person): person is JsonLdPerson => person !== undefined);
}

function resolvedAuthors(doc: FolioDoc, config: FolioConfig): JsonLdPerson[] {
  const explicit = frontmatterAuthors(doc.data.author);
  return explicit.length ? explicit : configuredAuthors(config);
}

function websiteJsonLd(
  config: FolioConfig,
  canonical: string,
  description?: string,
): JsonLdObject {
  const jsonLd: JsonLdObject = {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: config.title,
  };
  if (description !== undefined) jsonLd.description = description;
  if (canonical) jsonLd.url = canonical;
  return jsonLd;
}

/**
 * Conservative JSON-LD for one default static route.
 *
 * - home `/` -> `WebSite` (site name, description, absolute URL);
 * - a configured collection route without a document -> `CollectionPage`;
 * - a document -> `Article` (article type) or `TechArticle`, with only trusted
 *   dates, a resolved image and authors that actually exist;
 * - any other custom route without a document keeps the conservative
 *   `WebSite` shape.
 *
 * A consumer-supplied `route.jsonLd` never reaches this function: `static.ts`
 * lets it win untouched.
 */
export function defaultFolioJsonLd(
  route: FolioStaticRoute,
  context: FolioStaticBuildContext,
  canonical: string,
  image: string | undefined,
): JsonLdObject {
  const doc = route.doc;

  if (!doc) {
    const routePath = normalizeStaticRoute(route.path);
    if (routePath === "/") {
      return websiteJsonLd(context.config, canonical, context.config.description);
    }
    const isCollection = (context.config.collections ?? []).some(
      (collection) => normalizeStaticRoute(collection.path) === routePath,
    );
    if (isCollection) {
      const jsonLd: JsonLdObject = {
        "@context": SCHEMA_CONTEXT,
        "@type": "CollectionPage",
        name: route.title,
        description: route.description,
      };
      if (canonical) jsonLd.url = canonical;
      return jsonLd;
    }
    return websiteJsonLd(context.config, canonical);
  }

  const jsonLd: JsonLdObject = {
    "@context": SCHEMA_CONTEXT,
    "@type": doc.type === "article" ? "Article" : "TechArticle",
    headline: route.title,
    description: route.description,
  };
  if (canonical) jsonLd.url = canonical;
  if (image) jsonLd.image = image;

  const publishedAt = trustedFolioPublishedAt(doc);
  if (publishedAt) jsonLd.datePublished = publishedAt;
  const updatedAt = trustedFolioUpdatedAt(doc);
  if (updatedAt) jsonLd.dateModified = updatedAt;

  const authors = resolvedAuthors(doc, context.config);
  if (authors.length) jsonLd.author = authors;

  jsonLd.publisher = { "@type": "Organization", name: context.config.title };
  return jsonLd;
}

/**
 * Sitemap `<lastmod>` for one written route.
 *
 * Precedence: an explicit `route.lastmod` (validated and normalized here) wins
 * over the document's trusted `updatedAt`. Without either there is no
 * `<lastmod>`: publication dates, build time and `git-first-commit` are never
 * used as a modification date.
 *
 * An invalid explicit value throws a route-specific error so a consumer typo
 * fails the build instead of publishing a malformed sitemap.
 */
export function resolveFolioSitemapLastmod(
  route: FolioStaticRoute,
): string | undefined {
  if (route.lastmod !== undefined) {
    const normalized = normalizeFolioDate(route.lastmod);
    if (!normalized) {
      throw new Error(
        `folio static route ${JSON.stringify(route.path)} lastmod ${JSON.stringify(route.lastmod)} is not a valid ISO 8601 date; use YYYY-MM-DD or a date-time with an explicit timezone (Z or a numeric offset)`,
      );
    }
    return normalized;
  }
  return trustedFolioUpdatedAt(route.doc);
}
