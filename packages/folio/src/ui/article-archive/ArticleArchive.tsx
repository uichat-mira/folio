import type { MouseEvent, Ref } from "react";
import { Link } from "react-router-dom";
import { buildFolioArticleArchiveIndex } from "../../core/article-archive";
import type {
  FolioArticleArchiveGroup,
  FolioArticleArchiveIndex,
} from "../../core/article-archive";
import {
  folioCollectionIndexes,
  normalizeFolioCollectionPath,
  selectFolioCollectionDocs,
  type FolioCollectionIndex,
} from "../../core/collection-index";
import type {
  FolioArticleArchiveConfig,
  FolioConfig,
  FolioDoc,
} from "../../types";
import { FolioEntryList, type FolioEntryTagLink } from "../entry-list";

/**
 * FOL-041: the default React UI consumes the FOL-040 Core archive index. This
 * module only derives routes from each opted-in collection path and renders
 * them; grouping, ordering, filtering and label normalization stay in Core.
 */

export type FolioArticleArchiveCollection = {
  collection: FolioCollectionIndex;
  archive: true | FolioArticleArchiveConfig;
  index: FolioArticleArchiveIndex;
};

export type FolioArticleArchiveRoute = {
  path: string;
  collection: FolioCollectionIndex;
  group: FolioArticleArchiveGroup;
};

export type FolioArticleArchiveModel = {
  collections: FolioArticleArchiveCollection[];
  byCollection: ReadonlyMap<string, FolioArticleArchiveCollection>;
  routes: FolioArticleArchiveRoute[];
  tagsByDoc: ReadonlyMap<string, readonly FolioEntryTagLink[]>;
};

function routeHref(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function normalizeRoutePath(path: string): string {
  const normalized = `/${path}`.replace(/\/{2,}/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

/**
 * A category/tag archive URL inside one configured collection path. The Core
 * group `slug` is URL-safe by contract; `segment` stays decoded so the static
 * writer creates the same path a browser requests after percent-decoding.
 */
export function folioArticleArchiveRoutePath(
  collectionPath: string,
  kind: FolioArticleArchiveGroup["kind"],
  slug: string,
): string {
  return `${collectionPath}/${kind}/${slug}`;
}

function archiveConfigFor(
  config: FolioConfig,
  collectionPath: string,
): true | FolioArticleArchiveConfig | undefined {
  const configured = (config.collections ?? []).find(
    (collection) =>
      normalizeFolioCollectionPath(collection.path) === collectionPath,
  );
  const archive = configured?.archive;
  return archive ? archive : undefined;
}

/**
 * Build every opted-in archive page and the per-document tag links used by the
 * collection index and article metadata.
 *
 * Route conflicts are rejected here as well as in the static builder: React
 * Router would otherwise silently shadow a document route. The error names the
 * archive route and the surface it collides with.
 */
export function buildFolioArticleArchiveModel(
  docs: readonly FolioDoc[],
  config: FolioConfig,
): FolioArticleArchiveModel {
  const collections = folioCollectionIndexes(config);
  const owners = new Map<string, string>();
  const archiveOwners = new Map<string, string>();

  // Existing duplicate-route handling belongs to the static writer; here we
  // only need to know which non-archive surfaces already own a route so an
  // archive page can never shadow them.
  const remember = (path: string, owner: string): void => {
    const normalized = normalizeRoutePath(path);
    if (!owners.has(normalized)) owners.set(normalized, owner);
  };

  const claimArchive = (path: string, owner: string): string => {
    const normalized = normalizeRoutePath(path);
    const previous = owners.get(normalized) ?? archiveOwners.get(normalized);
    if (previous) {
      throw new Error(
        "folio article archive route conflict: " +
          JSON.stringify(normalized) +
          " (" +
          owner +
          ") conflicts with " +
          previous,
      );
    }
    archiveOwners.set(normalized, owner);
    return normalized;
  };

  remember("/", "site home");
  for (const collection of collections) {
    remember(collection.path, `collection index ${JSON.stringify(collection.title)}`);
  }
  for (const doc of docs) {
    remember(doc.path, `document ${JSON.stringify(doc.title)}`);
  }

  const archiveCollections: FolioArticleArchiveCollection[] = [];
  const byCollection = new Map<string, FolioArticleArchiveCollection>();
  const routes: FolioArticleArchiveRoute[] = [];
  const tagsByDoc = new Map<string, FolioEntryTagLink[]>();

  for (const collection of collections) {
    const archive = archiveConfigFor(config, collection.path);
    if (!archive) continue;

    const index = buildFolioArticleArchiveIndex(
      selectFolioCollectionDocs(docs, collection.path),
      archive,
    );
    const entry: FolioArticleArchiveCollection = { collection, archive, index };
    archiveCollections.push(entry);
    byCollection.set(collection.path, entry);

    for (const group of [...index.categories, ...index.tags]) {
      const path = claimArchive(
        folioArticleArchiveRoutePath(collection.path, group.kind, group.slug),
        `${group.kind} archive ${JSON.stringify(group.title)} of ${JSON.stringify(collection.title)}`,
      );
      routes.push({ path, collection, group });

      if (group.kind !== "tag") continue;
      for (const doc of group.docs) {
        const links = tagsByDoc.get(doc.path) ?? [];
        links.push({ label: group.title, href: path });
        tagsByDoc.set(doc.path, links);
      }
    }
  }

  return {
    collections: archiveCollections,
    byCollection,
    routes,
    tagsByDoc,
  };
}

/**
 * Compact category entry row for an opted-in collection index page.
 *
 * The anchors keep real archive URLs so modified clicks, middle clicks, no-JS
 * static pages and crawlers still reach the archive routes. When `onSelect` is
 * provided, a plain left click switches the surrounding list in place instead
 * of navigating, which is what makes the row behave as one filter layer.
 */
export function FolioArchiveCategoryRow({
  collection,
  groups,
  activeId,
  onSelect,
  rowRef,
}: {
  collection: FolioCollectionIndex;
  groups: readonly FolioArticleArchiveGroup[];
  /** Active category id, or null/undefined for the unfiltered collection. */
  activeId?: string | null;
  /** Enables in-place filtering; omit to keep every chip a normal link. */
  onSelect?: (group: FolioArticleArchiveGroup | null) => void;
  /** Sticky row handle, used to measure the offset for scroll resets. */
  rowRef?: Ref<HTMLElement>;
}) {
  if (!groups.length) return null;

  const select = (
    event: MouseEvent<HTMLAnchorElement>,
    group: FolioArticleArchiveGroup | null,
  ) => {
    if (!onSelect) return;
    // Modifier and non-primary clicks keep the browser's normal link behavior.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onSelect(group);
  };

  return (
    <nav ref={rowRef} className="folio-archive-row" aria-label={`${collection.title}分类归档`}>
      <ul className="folio-archive-row__list">
        <li>
          <Link
            className="folio-archive-chip"
            to={routeHref(collection.path)}
            aria-current={activeId ? undefined : "true"}
            onClick={onSelect ? (event) => select(event, null) : undefined}
          >
            全部
          </Link>
        </li>
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              className="folio-archive-chip"
              to={routeHref(
                folioArticleArchiveRoutePath(collection.path, "category", group.slug),
              )}
              aria-current={group.id === activeId ? "true" : undefined}
              onClick={onSelect ? (event) => select(event, group) : undefined}
            >
              {group.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Clickable tag row used by Article cards and the Article metadata area. */
export function FolioArticleTags({
  links,
  label = "标签",
}: {
  links: readonly FolioEntryTagLink[] | undefined;
  label?: string;
}) {
  if (!links?.length) return null;
  return (
    <nav className="folio-article-tags" aria-label="文章标签">
      <span className="folio-article-tags__label">{label}</span>
      {links.map((link) => (
        <Link className="folio-article-tag" to={routeHref(link.href)} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * One default archive page. It deliberately reuses the collection page shell
 * and entry list so the archive stays part of the existing reading surface
 * rather than becoming a second navigation system.
 */
export function FolioArticleArchivePage({
  collection,
  group,
  tagLinks,
}: {
  collection: FolioCollectionIndex;
  group: FolioArticleArchiveGroup;
  tagLinks: ReadonlyMap<string, readonly FolioEntryTagLink[]>;
}) {
  const category = group.kind === "category";
  return (
    <main className="folio-home folio-collection-page folio-archive-page">
      <header className="folio-journal-hero folio-collection-hero">
        <span className="folio-journal-kicker">
          {category ? "CATEGORY ARCHIVE" : "TAG ARCHIVE"} · {group.docs.length} ARTICLES
        </span>
        <h1>{group.title}</h1>
        <p>
          {collection.title} · {category ? "分类" : "标签"}归档 · 共 {group.docs.length} 篇文章
        </p>
        <Link className="folio-archive-back" to={routeHref(collection.path)}>
          返回{collection.title} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <FolioEntryList entries={group.docs} headingLevel="h2" tagLinks={tagLinks} />
    </main>
  );
}
