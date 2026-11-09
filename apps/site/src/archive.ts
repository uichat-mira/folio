import {
  buildFolioArticleArchiveIndex,
  folioCollectionIndexes,
  normalizeFolioCollectionPath,
  selectFolioCollectionDocs,
  type FolioArticleArchiveConfig,
  type FolioArticleArchiveGroup,
  type FolioArticleArchiveIndex,
  type FolioCollectionIndex,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";

/**
 * FOL-041: the official site consumes the same FOL-040 Core archive index as
 * `FolioApp`. Grouping, filtering, ordering and label identity stay in Core;
 * this module only derives the site's static route set from each opted-in
 * collection path and builds base-aware tag links.
 */

export type SiteArchiveCollection = {
  collection: FolioCollectionIndex;
  index: FolioArticleArchiveIndex;
};

export type SiteArchiveRoute = {
  path: string;
  collection: FolioCollectionIndex;
  group: FolioArticleArchiveGroup;
};

export type SiteArchiveTagLink = {
  label: string;
  href: string;
};

export type SiteArchiveModel = {
  byCollection: Map<string, SiteArchiveCollection>;
  routes: SiteArchiveRoute[];
  tagsByDoc: Map<string, SiteArchiveTagLink[]>;
};

export function siteArchivePath(
  collectionPath: string,
  kind: FolioArticleArchiveGroup["kind"],
  slug: string,
): string {
  return `${collectionPath}/${kind}/${slug}`;
}

export function buildSiteArchiveModel(
  config: FolioConfig,
  docs: readonly FolioDoc[],
  routeHref: (path: string) => string,
): SiteArchiveModel {
  const byCollection = new Map<string, SiteArchiveCollection>();
  const routes: SiteArchiveRoute[] = [];
  const tagsByDoc = new Map<string, SiteArchiveTagLink[]>();

  for (const collection of folioCollectionIndexes(config)) {
    const configured = (config.collections ?? []).find(
      (entry) => normalizeFolioCollectionPath(entry.path) === collection.path,
    );
    const archive: boolean | FolioArticleArchiveConfig | undefined =
      configured?.archive;
    if (!archive) continue;

    const index = buildFolioArticleArchiveIndex(
      selectFolioCollectionDocs(docs, collection.path),
      archive,
    );
    byCollection.set(collection.path, { collection, index });

    for (const group of [...index.categories, ...index.tags]) {
      const path = siteArchivePath(collection.path, group.kind, group.slug);
      routes.push({ path, collection, group });

      if (group.kind !== "tag") continue;
      for (const doc of group.docs) {
        const links = tagsByDoc.get(doc.path) ?? [];
        links.push({ label: group.title, href: routeHref(path) });
        tagsByDoc.set(doc.path, links);
      }
    }
  }

  return { byCollection, routes, tagsByDoc };
}

export function siteArchiveDescription(
  collection: FolioCollectionIndex,
  group: FolioArticleArchiveGroup,
): string {
  return `${collection.title} · ${group.kind === "category" ? "分类" : "标签"}归档，共 ${group.docs.length} 篇文章。`;
}
