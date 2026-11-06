import type { FolioDoc } from "../types";

/** A hierarchy derived from content routes. No doc means a directory with
 * no authored overview. Such nodes never render as broken links.
 */
export type FolioContentTreeNode = {
  path: string;
  title: string;
  doc?: FolioDoc;
  children: FolioContentTreeNode[];
};

export type FolioContentTree = {
  rootPath: string;
  roots: FolioContentTreeNode[];
};

export type FolioContentTreeOptions = {
  /** Only include descendants of this route (defaults to /). */
  rootPath?: string;
};

function normalizedPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length ? "/" + parts.join("/") : "/";
}

function segmentTitle(segment: string): string {
  let decoded = segment;
  try { decoded = decodeURIComponent(segment); } catch { /* keep original */ }
  return decoded.replace(/[-_]+/g, " ");
}

function nodeOrder(node: FolioContentTreeNode): number {
  if (node.doc) return node.doc.order;
  return Math.min(99, ...node.children.map(nodeOrder));
}

/**
 * Derive a hierarchy from content routes. Source paths of index.md files
 * naturally produce parent routes, and nested index.md files produce children.
 * Explicit frontmatter routes remain authoritative for navigation placement.
 * Segment-aware prefix checking prevents accidental sibling grouping.
 */
export function buildFolioContentTree(
  docs: readonly FolioDoc[],
  options: FolioContentTreeOptions = {},
): FolioContentTree {
  const rootPath = normalizedPath(options.rootPath ?? "/");
  const nodes = new Map<string, FolioContentTreeNode>();
  const roots: FolioContentTreeNode[] = [];

  for (const doc of docs) {
    const path = normalizedPath(doc.path);
    const prefix = rootPath === "/" ? "/" : rootPath + "/";
    if (path === rootPath || !path.startsWith(prefix)) continue;
    const segments = path.slice(prefix.length).split("/").filter(Boolean);
    let parent: FolioContentTreeNode | undefined;
    let cursor = rootPath === "/" ? "" : rootPath;

    for (const segment of segments) {
      cursor += "/" + segment;
      let node = nodes.get(cursor);
      if (!node) {
        node = { path: cursor, title: segmentTitle(segment), children: [] };
        nodes.set(cursor, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      parent = node;
    }

    if (!parent) continue;
    if (parent.doc) {
      throw new Error("Folio content tree: duplicate route " + path);
    }
    parent.doc = doc;
    parent.title = doc.title;
  }

  function sort(items: FolioContentTreeNode[]) {
    for (const node of items) sort(node.children);
    items.sort((a, b) => nodeOrder(a) - nodeOrder(b) || a.path.localeCompare(b.path));
  }
  sort(roots);
  return { rootPath, roots };
}

/** Project content is scoped automatically to the first route segment. */
export function resolveFolioProjectTree(
  docs: readonly FolioDoc[],
  current: FolioDoc,
): FolioContentTree {
  const firstSegment = normalizedPath(current.path).split("/")[1];
  const projectDocs = docs.filter((doc) => doc.type === "project");
  const firstRoute = firstSegment ? "/" + firstSegment : "/";
  // A consumer may override the overview route to /mira rather than
  // /projects/mira. Include the authored top-level overview as the parent,
  // instead of accidentally discarding it by treating /mira as the root.
  const rootPath = projectDocs.some(
    (doc) => normalizedPath(doc.path) === firstRoute,
  ) ? "/" : firstRoute;
  return buildFolioContentTree(projectDocs, { rootPath });
}

/**
 * Presentation label for a top-level overview. A title such as
 * "ComDesign：AI 时代的设计系统实验" becomes a two-line navigation label
 * without introducing a second source of title metadata.
 */
export function folioTreeDisplayLabel(title: string): {
  eyebrow?: string;
  title: string;
} {
  const match = title.match(/^([^：:]+)[：:]\s*(.+)$/);
  return match
    ? { eyebrow: match[1].trim(), title: match[2].trim() }
    : { title };
}

/** Previous/next follows tree preorder, bounded to a single top-level group. */
export function getFolioTreeNeighbors(
  tree: FolioContentTree,
  path: string,
): { previous?: FolioDoc; next?: FolioDoc } {
  const currentPath = normalizedPath(path);
  const root = tree.roots.find((item) =>
    item.path === currentPath || currentPath.startsWith(item.path + "/"),
  );
  if (!root) return {};

  const ordered: FolioDoc[] = [];
  function walk(node: FolioContentTreeNode) {
    if (node.doc) ordered.push(node.doc);
    for (const child of node.children) walk(child);
  }
  walk(root);
  const index = ordered.findIndex((doc) => normalizedPath(doc.path) === currentPath);
  if (index < 0) return {};
  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index + 1 < ordered.length ? ordered[index + 1] : undefined,
  };
}
