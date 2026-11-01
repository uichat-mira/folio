import type { FolioConfig, FolioDoc, FolioCollectionConfig } from "../types";

export type FolioCollectionIndex = Required<Pick<FolioCollectionConfig, "path" | "title" | "description" | "emptyMessage">>;

/** Treat the collection path as a URL directory, not as a document type. */
export function normalizeFolioCollectionPath(path: string): string {
  if (typeof path !== "string" || !path.startsWith("/") || path === "/") {
    throw new Error("folio collection path must be a non-root absolute route");
  }
  if (path.includes("?") || path.includes("#") || path.includes("\\") || path.includes("//")) {
    throw new Error("folio collection path contains an invalid character: " + JSON.stringify(path));
  }
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("folio collection path contains an invalid segment: " + JSON.stringify(path));
  }
  return "/" + parts.join("/");
}

/** Recursively returns full FolioDoc data under a route, excluding its own index. */
export function selectFolioCollectionDocs(
  docs: readonly FolioDoc[],
  routePrefix: string,
): FolioDoc[] {
  const prefix = normalizeFolioCollectionPath(routePrefix) + "/";
  return docs.filter((doc) => doc.path.startsWith(prefix)).sort((a, b) => {
    const byDate = String(b.date ?? "").localeCompare(String(a.date ?? ""));
    return byDate || a.order - b.order || a.path.localeCompare(b.path);
  });
}

export function folioCollectionIndexes(config: FolioConfig): FolioCollectionIndex[] {
  const seen = new Set<string>();
  return (config.collections ?? []).map((collection) => {
    const path = normalizeFolioCollectionPath(collection.path);
    if (seen.has(path)) throw new Error("folio duplicate collection route: " + JSON.stringify(path));
    seen.add(path);
    const title = collection.title ??
      config.navigation?.find((item) => item.href.replace(/\/+$/, "") === path)?.label ??
      path.split("/").at(-1)!;
    return {
      path,
      title,
      description: collection.description ?? "",
      emptyMessage: collection.emptyMessage ?? "这里还没有内容。",
    };
  });
}

export function assertNoFolioCollectionConflicts(
  docs: readonly FolioDoc[],
  config: FolioConfig,
): void {
  const indexes = folioCollectionIndexes(config);
  for (const doc of docs) {
    if (indexes.some((collection) => collection.path === doc.path.replace(/\/+$/, ""))) {
      throw new Error(
        "folio collection route conflict: content " + JSON.stringify(doc.path) +
        " overlaps configured index route",
      );
    }
  }
}
