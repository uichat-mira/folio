import type { FolioDoc } from "./types";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function searchText(doc: FolioDoc): string {
  return [
    doc.title,
    doc.description,
    doc.group,
    doc.tags.join(" "),
    doc.body,
  ]
    .join("\n")
    .toLocaleLowerCase();
}

export function searchFolioDocs(
  docs: FolioDoc[],
  query: string,
  limit = 8,
): FolioDoc[] {
  const needle = normalized(query);
  if (!needle) {
    return docs
      .filter((doc) => doc.path !== "/")
      .slice(0, Math.max(0, limit));
  }

  return docs
    .filter((doc) => searchText(doc).includes(needle))
    .sort((left, right) => {
      const leftTitle = normalized(left.title);
      const rightTitle = normalized(right.title);
      const leftExact = leftTitle === needle ? 0 : leftTitle.startsWith(needle) ? 1 : 2;
      const rightExact = rightTitle === needle ? 0 : rightTitle.startsWith(needle) ? 1 : 2;
      return leftExact - rightExact || left.order - right.order;
    })
    .slice(0, Math.max(0, limit));
}
