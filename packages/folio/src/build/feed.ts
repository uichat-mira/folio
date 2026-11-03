// Build-layer feed planner (FOL-026 / Issue #125).
//
// This module owns RSS 2.0 / Atom 1.0 serialization and the "which feed files
// are actually publishable" decision. It deliberately does not import the
// static page writer: `static.ts` passes absolute-URL resolvers in, so feed
// generation cannot create a module cycle and cannot invent a second URL
// convention. The route-directory selection itself is reused from Core
// (`selectFolioCollectionDocs`) instead of being re-implemented here.
//
// Date honesty is the central rule. A date is emitted only when the frozen
// FOL-025 provenance says the source is trustworthy:
//
//   publication: dateSources.publishedAt in {"frontmatter", "legacy-date"}
//   modification: dateSources.updatedAt in {"frontmatter", "git-last-commit"}
//
// Git first-commit timestamps, file mtimes and the build clock are never used
// as a publication date. Undated documents still appear in RSS (without
// `<pubDate>`); Atom requires `<updated>`, so entries with no trustworthy date
// at all are excluded from Atom, and an Atom feed with no dated entry is not
// written (it would need a fabricated date).
import {
  folioCollectionIndexes,
  normalizeFolioCollectionPath,
  selectFolioCollectionDocs,
  type FolioCollectionIndex,
} from "../core/collection-index";
import type { FolioConfig, FolioDoc } from "../types";

/**
 * One declarative feed. `path` is a route directory whose descendants (at any
 * depth, regardless of `FolioDoc.type`) become entries. `rss` / `atom` select
 * the output file name relative to the static site root; `false` disables that
 * format, and omitting them keeps the `rss.xml` / `atom.xml` defaults.
 */
export type FolioStaticFeedOptions = {
  path: string;
  title?: string;
  description?: string;
  rss?: string | false;
  atom?: string | false;
};

export type FolioStaticFeedFormat = "rss" | "atom";

/** One feed file that the static writer must write verbatim. */
export type FolioStaticFeedOutput = {
  /** Site-root-relative output file name, for example `rss.xml`. */
  name: string;
  format: FolioStaticFeedFormat;
  /** MIME type advertised by the matching `<link rel="alternate">`. */
  type: "application/rss+xml" | "application/atom+xml";
  /** Resolved feed title used for HTML discovery. */
  title: string;
  /** Declared route directory that produced this file (for clear errors). */
  feedPath: string;
  content: string;
};

/** One HTML discovery link; emitted only for files that are actually written. */
export type FolioStaticFeedAlternate = {
  type: FolioStaticFeedOutput["type"];
  title: string;
  href: string;
};

export type FolioStaticFeedPlan = {
  files: FolioStaticFeedOutput[];
  alternates: FolioStaticFeedAlternate[];
};

export type FolioStaticFeedPlanInput = {
  config: FolioConfig;
  docs: readonly FolioDoc[];
  feeds: readonly FolioStaticFeedOptions[] | undefined;
  /**
   * Static output files the same build already writes (pages, `404.html`,
   * `sitemap.xml`, `robots.txt` when enabled). A feed output path that is
   * equal to, an ancestor of, or a descendant of one of these file paths would
   * make the outputs unable to coexist, so it is rejected before the writer
   * starts. Paths are compared case-insensitively with Windows-ambiguous
   * trailing dots/spaces folded, so every platform behaves the same.
   */
  reservedOutputs?: readonly string[];
  /** Absolute article/index URL resolver owned by the static page layer. */
  routeUrl: (path: string) => string;
  /** Absolute site-root asset URL resolver owned by the static page layer. */
  assetUrl: (name: string) => string;
};

const RSS_DEFAULT_FILE = "rss.xml";
const ATOM_DEFAULT_FILE = "atom.xml";
const RSS_MIME = "application/rss+xml";
const ATOM_MIME = "application/atom+xml";
const ATOM_NAMESPACE = "http://www.w3.org/2005/Atom";
const RSS_SELF_NAMESPACE = "http://www.w3.org/2005/Atom";

// XML 1.0 forbids these control characters even when escaped.
const INVALID_XML_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const TRUSTED_PUBLICATION_SOURCES = new Set<string>([
  "frontmatter",
  "legacy-date",
]);
const TRUSTED_MODIFICATION_SOURCES = new Set<string>([
  "frontmatter",
  "git-last-commit",
]);

type TrustedDate = {
  /** Normalized ISO-8601 UTC value. */
  iso: string;
  time: number;
};

type FeedEntry = {
  doc: FolioDoc;
  url: string;
  published?: TrustedDate;
  /** `updatedAt` (trusted) with `publishedAt` (trusted) as the fallback. */
  updated?: TrustedDate;
};

/** Escape text for XML 1.0 text nodes and attribute values. */
export function folioEscapeXml(value: string): string {
  return String(value)
    .replace(INVALID_XML_CHARACTERS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trustedDate(
  value: string | undefined,
  source: string | undefined,
  allowedSources: ReadonlySet<string>,
): TrustedDate | undefined {
  if (!value || !source || !allowedSources.has(source)) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return { iso: new Date(time).toISOString(), time };
}

function publishDate(doc: FolioDoc): TrustedDate | undefined {
  return trustedDate(
    doc.publishedAt,
    doc.dateSources?.publishedAt,
    TRUSTED_PUBLICATION_SOURCES,
  );
}

function entryDate(doc: FolioDoc): TrustedDate | undefined {
  return (
    trustedDate(
      doc.updatedAt,
      doc.dateSources?.updatedAt,
      TRUSTED_MODIFICATION_SOURCES,
    ) ?? publishDate(doc)
  );
}

// Mirrors the static writer's lexical rule: Windows silently drops trailing
// dots and spaces from path segments, so ".. " or "..." could become a parent
// segment. Feed names must never escape the site root even when the writer
// would reject them later, because the feed plan runs before the first write.
function isTraversalSegment(segment: string): boolean {
  const withoutTrailingDotsOrSpaces = segment.replace(/[. ]+$/, "");
  if (withoutTrailingDotsOrSpaces === "..") return true;
  return withoutTrailingDotsOrSpaces === "" && segment.includes(".");
}

// One comparison form for duplicates and reserved outputs: case-folded, with
// "." segments dropped and Windows-ambiguous trailing dots/spaces removed, so
// "Sitemap.XML", "./sitemap.xml" and "sitemap.xml." all collide with the real
// sitemap.xml regardless of the host filesystem.
function comparableOutputKey(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
    .map((segment) => segment.replace(/[. ]+$/, ""))
    .join("/")
    .toLowerCase();
}

// Two output files cannot coexist when one normalized path is the other
// path itself or a path-segment ancestor of it: one side would need the other
// file path to be a directory.
function comparableOutputPathsOverlap(left: string, right: string): boolean {
  if (!left || !right) return false;
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function normalizeFeedOutputName(
  name: string,
  feedPath: string,
  format: FolioStaticFeedFormat,
): string {
  if (name.includes("\0") || name.includes("\\")) {
    throw new Error(
      `folio static feed ${JSON.stringify(feedPath)} ${format} output name ${JSON.stringify(name)} contains a character that is not valid in a static output path`,
    );
  }
  const segments: string[] = [];
  for (const segment of name.split("/")) {
    if (segment === "" || segment === ".") continue;
    // ":" is invalid in Windows file names and makes an absolute drive or
    // stream target; reject it here so the failure happens before any write.
    if (segment.includes(":") || isTraversalSegment(segment)) {
      throw new Error(
        `folio static feed ${JSON.stringify(feedPath)} ${format} output name ${JSON.stringify(name)} ${segment.includes(":") ? "contains a character that is not valid in a static output path" : "escapes the static site root"}`,
      );
    }
    segments.push(segment);
  }
  const normalized = segments.join("/");
  if (!normalized) {
    throw new Error(
      `folio static feed ${JSON.stringify(feedPath)} ${format} output name ${JSON.stringify(name)} must point at a file inside the static site root`,
    );
  }
  return normalized;
}

function feedFileName(
  feed: FolioStaticFeedOptions,
  format: FolioStaticFeedFormat,
  value: string | false | undefined,
): string | undefined {
  if (value === false) return undefined;
  const fallback = format === "rss" ? RSS_DEFAULT_FILE : ATOM_DEFAULT_FILE;
  const name = value === undefined ? fallback : value;
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(
      `folio static feed ${JSON.stringify(feed.path)} ${format} output name must be a non-empty string or false`,
    );
  }
  return normalizeFeedOutputName(name, feed.path, format);
}

function selectFeedRoute(
  feed: FolioStaticFeedOptions,
  docs: readonly FolioDoc[],
): { route: string; docs: FolioDoc[] } {
  let route: string;
  try {
    route = normalizeFolioCollectionPath(feed.path);
  } catch (error) {
    throw new Error(
      `folio static feed ${JSON.stringify(feed.path)} has an invalid source route: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return { route, docs: selectFolioCollectionDocs(docs, route) };
}

function resolveFeedMeta(
  feed: FolioStaticFeedOptions,
  collection: FolioCollectionIndex | undefined,
  config: FolioConfig,
): { title: string; description: string } {
  const title =
    typeof feed.title === "string" && feed.title.trim()
      ? feed.title
      : (collection?.title ?? config.title);
  const description =
    typeof feed.description === "string"
      ? feed.description
      : collection?.description
        ? collection.description
        : config.description;
  return { title, description };
}

function orderValue(doc: FolioDoc): number {
  return Number.isFinite(doc.order) ? doc.order : Number.MAX_SAFE_INTEGER;
}

function compareFeedEntries(left: FeedEntry, right: FeedEntry): number {
  const leftTime = left.published?.time;
  const rightTime = right.published?.time;

  if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  if (leftTime !== undefined && rightTime === undefined) return -1;
  if (leftTime === undefined && rightTime !== undefined) return 1;

  const byOrder = orderValue(left.doc) - orderValue(right.doc);
  if (byOrder !== 0) return byOrder;
  return left.doc.path < right.doc.path
    ? -1
    : left.doc.path > right.doc.path
      ? 1
      : 0;
}

function buildEntries(
  docs: readonly FolioDoc[],
  routeUrl: (path: string) => string,
): FeedEntry[] {
  return docs
    .map((doc) => ({
      doc,
      url: routeUrl(doc.path),
      published: publishDate(doc),
      updated: entryDate(doc),
    }))
    .sort(compareFeedEntries);
}

function rfc822(date: TrustedDate): string {
  return new Date(date.time).toUTCString();
}

function renderRss(
  title: string,
  description: string,
  siteUrl: string,
  selfUrl: string,
  entries: readonly FeedEntry[],
): string {
  const items = entries
    .map((entry) => {
      const item = [
        "<item>",
        `<title>${folioEscapeXml(entry.doc.title)}</title>`,
        `<link>${folioEscapeXml(entry.url)}</link>`,
        `<guid isPermaLink="true">${folioEscapeXml(entry.url)}</guid>`,
        entry.doc.description
          ? `<description>${folioEscapeXml(entry.doc.description)}</description>`
          : "",
        entry.published
          ? `<pubDate>${rfc822(entry.published)}</pubDate>`
          : "",
        "</item>",
      ];
      return item.join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<rss version="2.0" xmlns:atom="${RSS_SELF_NAMESPACE}"><channel>`,
    `<title>${folioEscapeXml(title)}</title>`,
    `<link>${folioEscapeXml(siteUrl)}</link>`,
    `<description>${folioEscapeXml(description)}</description>`,
    `<atom:link rel="self" type="${RSS_MIME}" href="${folioEscapeXml(selfUrl)}"/>`,
    items,
    "</channel></rss>",
  ].join("");
}

function renderAtom(
  title: string,
  description: string,
  siteUrl: string,
  selfUrl: string,
  author: string,
  entries: readonly FeedEntry[],
): string {
  // Callers only reach this function with at least one dated entry.
  const feedUpdated = entries.reduce(
    (latest, entry) =>
      entry.updated!.time > latest.time ? entry.updated! : latest,
    entries[0].updated!,
  );

  const atomEntries = entries
    .map((entry) => {
      const published = entry.published
        ? `<published>${folioEscapeXml(entry.published.iso)}</published>`
        : "";
      const summary = entry.doc.description
        ? `<summary>${folioEscapeXml(entry.doc.description)}</summary>`
        : "";
      return [
        "<entry>",
        `<id>${folioEscapeXml(entry.url)}</id>`,
        `<title>${folioEscapeXml(entry.doc.title)}</title>`,
        `<link rel="alternate" type="text/html" href="${folioEscapeXml(entry.url)}"/>`,
        `<updated>${folioEscapeXml(entry.updated!.iso)}</updated>`,
        published,
        summary,
        "</entry>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<feed xmlns="${ATOM_NAMESPACE}">`,
    `<title>${folioEscapeXml(title)}</title>`,
    description
      ? `<subtitle>${folioEscapeXml(description)}</subtitle>`
      : "",
    `<id>${folioEscapeXml(selfUrl)}</id>`,
    `<updated>${folioEscapeXml(feedUpdated.iso)}</updated>`,
    `<link rel="self" type="${ATOM_MIME}" href="${folioEscapeXml(selfUrl)}"/>`,
    `<link rel="alternate" type="text/html" href="${folioEscapeXml(siteUrl)}"/>`,
    // Atom requires an author when entries have none. The site itself is the
    // only honest author here; no person is invented.
    `<author><name>${folioEscapeXml(author)}</name></author>`,
    atomEntries,
    "</feed>",
  ].join("");
}

function assertUniqueOutputs(files: readonly FolioStaticFeedOutput[]): void {
  const seen = new Map<string, FolioStaticFeedOutput>();
  for (const file of files) {
    // Compared case-insensitively with Windows-ambiguous trailing dots/spaces
    // folded: a case-only or dot-only difference would silently overwrite an
    // earlier feed on Windows and macOS.
    const key = comparableOutputKey(file.name);
    const previous = seen.get(key);
    if (previous) {
      throw new Error(
        `folio static feed output conflict: ${JSON.stringify(file.name)} would be written more than once ` +
          `(feed ${JSON.stringify(previous.feedPath)} ${previous.format} and feed ${JSON.stringify(file.feedPath)} ${file.format})`,
      );
    }
    seen.set(key, file);
  }
}

function assertNoReservedOutputConflict(
  files: readonly FolioStaticFeedOutput[],
  reservedOutputs: readonly string[],
): void {
  const reserved = new Map<string, string>();
  for (const name of reservedOutputs) {
    const key = comparableOutputKey(name);
    if (key && !reserved.has(key)) reserved.set(key, name);
  }
  for (const file of files) {
    const fileKey = comparableOutputKey(file.name);
    let conflict: string | undefined;
    for (const [reservedKey, name] of reserved) {
      if (comparableOutputPathsOverlap(fileKey, reservedKey)) {
        conflict = name;
        break;
      }
    }
    if (conflict !== undefined) {
      throw new Error(
        `folio static feed output conflict: ${JSON.stringify(file.name)} would conflict with the static output ${JSON.stringify(conflict)} ` +
          `(feed ${JSON.stringify(file.feedPath)} ${file.format}); normalized paths must not be equal or overlap at a path-segment boundary`,
      );
    }
  }
}

/**
 * Decide every feed file that is publishable and render it.
 *
 * No file and no alternate link is produced without `config.siteUrl`: absolute
 * URLs are part of the feed contract, and a feed with relative links would be
 * unusable in a reader. Output names are normalized first, then checked
 * against each other and against `reservedOutputs` (every static page target
 * plus 404.html / sitemap.xml / robots.txt when enabled). Equal paths and
 * file/directory prefix conflicts are rejected before the static writer has
 * written any page or feed.
 */
export function buildFolioStaticFeedPlan(
  input: FolioStaticFeedPlanInput,
): FolioStaticFeedPlan {
  const feeds = Array.isArray(input.feeds) ? input.feeds : [];
  if (!input.config.siteUrl || feeds.length === 0) {
    return { files: [], alternates: [] };
  }

  const siteUrl = input.routeUrl("/");
  const collections = folioCollectionIndexes(input.config);
  const files: FolioStaticFeedOutput[] = [];

  for (const feed of feeds) {
    const selected = selectFeedRoute(feed, input.docs);
    const collection = collections.find(
      (candidate) => candidate.path === selected.route,
    );
    const meta = resolveFeedMeta(feed, collection, input.config);
    const rssName = feedFileName(feed, "rss", feed.rss);
    const atomName = feedFileName(feed, "atom", feed.atom);
    const entries = buildEntries(selected.docs, input.routeUrl);

    if (rssName) {
      files.push({
        name: rssName,
        format: "rss",
        type: RSS_MIME,
        title: meta.title,
        feedPath: selected.route,
        content: renderRss(
          meta.title,
          meta.description,
          siteUrl,
          input.assetUrl(rssName),
          entries,
        ),
      });
    }

    if (atomName) {
      const datedEntries = entries.filter((entry) => entry.updated);
      if (datedEntries.length > 0) {
        files.push({
          name: atomName,
          format: "atom",
          type: ATOM_MIME,
          title: meta.title,
          feedPath: selected.route,
          content: renderAtom(
            meta.title,
            meta.description,
            siteUrl,
            input.assetUrl(atomName),
            input.config.title,
            datedEntries,
          ),
        });
      }
    }
  }

  assertNoReservedOutputConflict(files, input.reservedOutputs ?? []);
  assertUniqueOutputs(files);

  return {
    files,
    alternates: files.map((file) => ({
      type: file.type,
      title: file.title,
      href: input.assetUrl(file.name),
    })),
  };
}
