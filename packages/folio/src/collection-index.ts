import type { FolioConfig, FolioDoc } from "./types";

export type FolioCollectionKind = "article" | "project";

export type FolioCollectionIndex = {
  readonly path: "/blogs" | "/projects";
  readonly kind: FolioCollectionKind;
  readonly title: string;
  readonly description: string;
  readonly emptyMessage: string;
};

export const FOLIO_COLLECTION_INDEXES: readonly FolioCollectionIndex[] = [
  {
    path: "/blogs",
    kind: "article",
    title: "博客",
    description: "所有文章与随想",
    emptyMessage: "还没有发布文章。",
  },
  {
    path: "/projects",
    kind: "project",
    title: "项目",
    description: "项目与好物记录",
    emptyMessage: "这里暂时还没有内容。",
  },
];

// Keep React and static publication in agreement on which documents to show.
export function selectFolioCollectionDocs(
  docs: readonly FolioDoc[],
  kind: FolioCollectionKind,
): FolioDoc[] {
  return docs.filter((doc) => doc.type === kind).sort((a, b) => {
    if (kind === "article") {
      const byDate = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      if (byDate) return byDate;
    }
    return a.order - b.order || a.path.localeCompare(b.path);
  });
}

export function folioCollectionTitle(
  config: FolioConfig,
  collection: FolioCollectionIndex,
): string {
  return config.navigation?.find(
    (item) => item.href.replace(/\/+$/, "") === collection.path,
  )?.label || collection.title;
}

export function assertNoFolioCollectionConflicts(docs: readonly FolioDoc[]): void {
  for (const doc of docs) {
    if (FOLIO_COLLECTION_INDEXES.some((index) =>
      index.path === doc.path.replace(/\/+$/, "")
    )) {
      throw new Error(
        "folio collection route conflict: content " + JSON.stringify(doc.path) +
        " overlaps a built-in collection index",
      );
    }
  }
}
