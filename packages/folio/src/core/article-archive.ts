import type { FolioArticleArchiveConfig, FolioDoc } from "../types";
import { compareFolioDocs, slugify } from "./content";

/**
 * FOL-040: Article category/tag archives are a pure Core data contract.
 *
 * A category is one optional archive dimension of an Article and never a
 * column, tree, navigation node or route directory. Tags stay the existing
 * zero-or-more topic labels. This module only groups the caller's own
 * `FolioDoc[]`; it renders nothing, reads nothing and persists no second
 * content index.
 */

export type FolioArticleArchiveKind = "category" | "tag";

/**
 * One derived archive bucket. `id` is the canonical identity of the source
 * label and `slug` is its URL identifier, so a category display-name override
 * changes only `title` and never routing. `docs` holds the original
 * `FolioDoc` objects in the existing Article order.
 */
export type FolioArticleArchiveGroup = {
  kind: FolioArticleArchiveKind;
  id: string;
  slug: string;
  title: string;
  docs: FolioDoc[];
};

export type FolioArticleArchiveIndex = {
  categories: FolioArticleArchiveGroup[];
  tags: FolioArticleArchiveGroup[];
  /** Articles whose category is missing or empty. */
  uncategorized: FolioDoc[];
  /** Articles without any non-empty tag. */
  untagged: FolioDoc[];
};

const ERROR_PREFIX = "folio article archive: ";

/**
 * Presentation spelling: NFC, trimmed, runs of whitespace collapsed. Case is
 * preserved because it is display text, not identity.
 */
function displayLabel(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Canonical archive identity for a category or tag label: NFC, trimmed,
 * whitespace-collapsed and lowercased. ASCII case differences therefore merge
 * (`Frontend` / `frontend`) while Chinese text is preserved. An empty result
 * means "uncategorized" / "unlabeled" and never becomes a group.
 *
 * Category identity comes from the frontmatter value, so it does not depend on
 * the display name configured for the collection.
 */
export function normalizeFolioArticleArchiveId(label: string): string {
  // Lowercasing can introduce combining characters (for example "İ"), so the
  // result is NFC-normalized again to keep identity comparisons stable.
  return displayLabel(label).toLowerCase().normalize("NFC");
}

/**
 * URL identifier for a category/tag identity. It reuses the repository's
 * `slugify` rules: Chinese survives, ASCII is lowercased, punctuation is
 * stripped. Two different identities can collapse to the same identifier
 * (`C++` / `C#` -> `c`); the index builder throws instead of silently sharing
 * one archive URL, and an identity with no URL-safe character also throws.
 */
export function folioArticleArchiveSlug(value: string): string {
  return slugify(normalizeFolioArticleArchiveId(value));
}

function compareText(left: string, right: string): number {
  // Code-point order is deliberate: locale-aware collation varies by runtime.
  return left < right ? -1 : left > right ? 1 : 0;
}

type ArchiveBucket = {
  title: string;
  docs: FolioDoc[];
};

function addToBucket(
  buckets: Map<string, ArchiveBucket>,
  id: string,
  label: string,
  doc: FolioDoc,
): void {
  let bucket = buckets.get(id);
  if (!bucket) {
    // The first article in the stable Article order supplies the fallback
    // display spelling, so the same document set always produces the same label.
    bucket = { title: label, docs: [] };
    buckets.set(id, bucket);
  }
  bucket.docs.push(doc);
}

function resolveCategoryLabels(
  config?: boolean | FolioArticleArchiveConfig,
): Map<string, string> {
  const overrides = new Map<string, string>();
  const rawKeys = new Map<string, string>();
  // The collection option and this builder share one shape: `true` (or an
  // absent/false option) simply means "use the source labels".
  if (!config || typeof config !== "object") return overrides;

  for (const [rawKey, rawValue] of Object.entries(config.categoryLabels ?? {})) {
    if (typeof rawValue !== "string") continue;
    const id = normalizeFolioArticleArchiveId(rawKey);
    const label = displayLabel(rawValue);
    // Empty configured labels fall back to the source spelling instead of
    // creating an untitled archive; empty keys cannot identify a category.
    if (!id || !label) continue;

    const existing = overrides.get(id);
    if (existing !== undefined) {
      if (existing !== label) {
        throw new Error(
          ERROR_PREFIX +
            "conflicting category display labels for " +
            JSON.stringify(id) +
            ": " +
            JSON.stringify(existing) +
            " from key " +
            JSON.stringify(rawKeys.get(id)) +
            " vs " +
            JSON.stringify(label) +
            " from key " +
            JSON.stringify(rawKey),
        );
      }
      continue;
    }

    overrides.set(id, label);
    rawKeys.set(id, rawKey);
  }

  return overrides;
}

function buildGroups(
  kind: FolioArticleArchiveKind,
  buckets: Map<string, ArchiveBucket>,
  categoryLabels: Map<string, string>,
): FolioArticleArchiveGroup[] {
  const groups = [...buckets.entries()].map(([id, bucket]) => {
    const slug = folioArticleArchiveSlug(id);
    if (!slug) {
      throw new Error(
        ERROR_PREFIX +
          kind +
          " " +
          JSON.stringify(id) +
          " has no URL-safe identifier",
      );
    }
    return {
      kind,
      id,
      slug,
      title: kind === "category" ? categoryLabels.get(id) ?? bucket.title : bucket.title,
      docs: bucket.docs,
    };
  });

  const idsBySlug = new Map<string, string>();
  for (const group of groups) {
    const existing = idsBySlug.get(group.slug);
    if (existing !== undefined) {
      throw new Error(
        ERROR_PREFIX +
          kind +
          " URL identifier collision: " +
          JSON.stringify(group.slug) +
          " is shared by " +
          JSON.stringify(existing) +
          " and " +
          JSON.stringify(group.id),
      );
    }
    idsBySlug.set(group.slug, group.id);
  }

  if (kind === "category") {
    // A display override must not make two distinct categories look like the
    // same archive to a reader.
    const idsByTitle = new Map<string, string>();
    for (const group of groups) {
      const normalizedTitle = normalizeFolioArticleArchiveId(group.title);
      const existing = idsByTitle.get(normalizedTitle);
      if (existing !== undefined) {
        throw new Error(
          ERROR_PREFIX +
            "duplicate category display label " +
            JSON.stringify(group.title) +
            " for " +
            JSON.stringify(existing) +
            " and " +
            JSON.stringify(group.id),
        );
      }
      idsByTitle.set(normalizedTitle, group.id);
    }
  }

  // Groups are ordered by URL identifier so the order is independent of
  // display-label configuration and of the caller's array order.
  return groups.sort(
    (left, right) => compareText(left.slug, right.slug) || compareText(left.id, right.id),
  );
}

/**
 * Derive deterministic Article category and tag groups from the caller's own
 * documents.
 *
 * - Only `type: "article"` entries participate. Documents, pages and every
 *   other type are ignored, which keeps collection recursion and routes
 *   unchanged.
 * - A category is a single optional value; tags remain zero or more. Empty
 *   values land in `uncategorized` / `untagged` and never create an empty group.
 * - Articles inside a group use the existing Article ordering
 *   (`compareFolioDocs`: date descending with missing dates last, then `order`)
 *   with a stable `path` tie-break.
 * - Returned groups contain the original full `FolioDoc` objects; nothing is
 *   re-parsed or persisted.
 * - `config` is the same shape as `FolioCollectionConfig.archive`: omit it (or
 *   pass `true` / `false`) for source labels, or pass the object form to
 *   override category display labels.
 */
export function buildFolioArticleArchiveIndex(
  docs: readonly FolioDoc[],
  config?: boolean | FolioArticleArchiveConfig,
): FolioArticleArchiveIndex {
  const categoryLabels = resolveCategoryLabels(config);
  const articles = docs
    .filter((doc) => doc.type === "article")
    .slice()
    .sort(
      (left, right) =>
        compareFolioDocs(left, right) || compareText(left.path, right.path),
    );

  const categoryBuckets = new Map<string, ArchiveBucket>();
  const tagBuckets = new Map<string, ArchiveBucket>();
  const uncategorized: FolioDoc[] = [];
  const untagged: FolioDoc[] = [];

  for (const article of articles) {
    const rawCategory = typeof article.category === "string" ? article.category : "";
    const categoryId = normalizeFolioArticleArchiveId(rawCategory);
    if (categoryId) {
      addToBucket(categoryBuckets, categoryId, displayLabel(rawCategory), article);
    } else {
      uncategorized.push(article);
    }

    const seenTags = new Set<string>();
    for (const rawTag of article.tags ?? []) {
      if (typeof rawTag !== "string") continue;
      const tagId = normalizeFolioArticleArchiveId(rawTag);
      // Repeated spellings of one tag inside one article must not duplicate it.
      if (!tagId || seenTags.has(tagId)) continue;
      seenTags.add(tagId);
      addToBucket(tagBuckets, tagId, displayLabel(rawTag), article);
    }
    if (seenTags.size === 0) untagged.push(article);
  }

  return {
    categories: buildGroups("category", categoryBuckets, categoryLabels),
    tags: buildGroups("tag", tagBuckets, categoryLabels),
    uncategorized,
    untagged,
  };
}

/**
 * Resolve one archive group from an already-built index, matching the URL
 * identifier first and then the canonical id. Route decoders pass the decoded
 * path segment; an unknown or empty identifier returns `undefined`.
 */
export function findFolioArticleArchiveGroup(
  index: FolioArticleArchiveIndex,
  kind: FolioArticleArchiveKind,
  identifier: string,
): FolioArticleArchiveGroup | undefined {
  const needle = typeof identifier === "string" ? identifier.trim() : "";
  if (!needle) return undefined;

  const groups = kind === "category" ? index.categories : index.tags;
  const id = normalizeFolioArticleArchiveId(needle);
  return groups.find((group) => group.slug === needle || group.id === id);
}
