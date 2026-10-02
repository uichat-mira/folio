import type { FolioDoc } from "./types";

function contentRoot(doc: FolioDoc): string {
  return doc.sourcePath.split("/").filter(Boolean)[0] ?? "";
}

export function getFolioDocNeighbors(
  docs: FolioDoc[],
  current: FolioDoc,
): { previous?: FolioDoc; next?: FolioDoc } {
  const root = contentRoot(current);
  const scoped = docs.filter(
    (doc) => doc.path !== "/" && contentRoot(doc) === root,
  );
  const index = scoped.findIndex((doc) => doc.path === current.path);
  if (index < 0) return {};
  return {
    previous: index > 0 ? scoped[index - 1] : undefined,
    next: index + 1 < scoped.length ? scoped[index + 1] : undefined,
  };
}
