import type { FolioDoc } from "../types";
import {
  buildFolioContentTree,
  folioTreeNodeOrder,
  type FolioContentTree,
  type FolioContentTreeNode,
} from "./content-tree";
import { buildFolioDocStructure, type FolioDocCollection } from "./docs-structure";

export type FolioNavigationNode = FolioContentTreeNode;

export type FolioNavigationTree = FolioContentTree & {
  roots: FolioNavigationNode[];
  /** Navigation identity independent of its route prefix, for expansion state. */
  scopeId?: string;
};

export type FolioNavigationTreeOptions = {
  /** Explicitly combine navigation across an authored route scope. */
  scopePath?: string;
};

const pathSegments = (path: string): string[] => path.split("/").filter(Boolean);

function normalizedPath(path: string): string {
  const parts = pathSegments(path);
  return parts.length ? "/" + parts.join("/") : "/";
}

function isWithin(path: string, root: string): boolean {
  return root === "/" || path === root || path.startsWith(root + "/");
}

function parentDirectory(path: string): string {
  return normalizedPath("/" + pathSegments(path).slice(0, -1).join("/"));
}

function collectionScope(collection: FolioDocCollection): string {
  const directories = [...new Set(collection.docs.map((doc) => parentDirectory(doc.path)))]
    .map(pathSegments);
  if (!directories.length) return "/";
  const shared = [...directories[0]];
  for (const directory of directories.slice(1)) {
    while (shared.length && shared.some((part, index) => directory[index] !== part)) {
      shared.pop();
    }
  }
  return normalizedPath("/" + shared.join("/"));
}

function sortNodes(nodes: FolioNavigationNode[]): void {
  for (const node of nodes) sortNodes(node.children);
  nodes.sort((left, right) =>
    folioTreeNodeOrder(left) - folioTreeNodeOrder(right) ||
    left.path.localeCompare(right.path),
  );
}

function sectionNode(id: string, title: string, children: FolioNavigationNode[]): FolioNavigationNode {
  sortNodes(children);
  return { path: "folio:section:" + id, title, kind: "section", children };
}

/**
 * Authored document routes create navigation ancestry within their own section.
 * A missing route segment never becomes a fake document or clickable parent.
 *
 * Nesting is a property of the route tree, not a special "project" content type.
 * Grouping and ordering remain owned by the existing collection/section contract.
 */
function sectionPages(docs: readonly FolioDoc[], rootPath: string): FolioNavigationNode[] {
  // Preserve the shared content-tree contract: missing overviews are visible
  // directories, but never fabricated as clickable pages.
  const includesRoot = docs.some((doc) => normalizedPath(doc.path) === rootPath);
  const scope = includesRoot ? parentDirectory(rootPath) : rootPath;
  return buildFolioContentTree(docs, { rootPath: scope }).roots;
}

/**
 * One hierarchy for authored document collections and their nested routes.
 * Unrelated page, article and custom types do not acquire a document sidebar.
 */
export function buildFolioNavigationTree(
  docs: readonly FolioDoc[],
  current: FolioDoc,
  options: FolioNavigationTreeOptions = {},
): FolioNavigationTree {
  if (current.type !== "doc") return { rootPath: "/", roots: [] };

  const collections = buildFolioDocStructure([...docs]).collections;
  const selected = collections.find((collection) =>
    collection.docs.some((doc) => doc.path === current.path));
  const explicitlyScoped = options.scopePath !== undefined;

  if (!selected && !explicitlyScoped) return { rootPath: "/", roots: [] };

  const scopePath = normalizedPath(
    options.scopePath ?? (selected ? collectionScope(selected) : "/"),
  );
  const scopeCollections = explicitlyScoped
    ? collections.filter((collection) =>
        collection.docs.some((doc) => isWithin(normalizedPath(doc.path), scopePath)))
    : selected ? [selected] : [];

  const roots: FolioNavigationNode[] = [];
  for (const collection of scopeCollections) {
    for (const section of collection.sections) {
      const documents = section.docs.filter((doc) =>
        !explicitlyScoped || isWithin(normalizedPath(doc.path), scopePath));
      if (!documents.length) continue;
      const id = "collection:" + collection.id + "/" + section.id;
      roots.push(sectionNode(id, section.title, sectionPages(documents, scopePath)));
    }
  }
  sortNodes(roots);
  return {
    rootPath: scopePath,
    scopeId: explicitlyScoped ? "scope:" + scopePath : "collection:" + selected?.id,
    roots,
  };
}

/** Reading neighbors follow the visible document sections in tree preorder. */
export function getFolioNavigationNeighbors(
  tree: FolioNavigationTree,
  path: string,
): { previous?: FolioDoc; next?: FolioDoc } {
  const ordered: FolioDoc[] = [];
  const walk = (node: FolioNavigationNode): void => {
    if (node.doc) ordered.push(node.doc);
    for (const child of node.children) walk(child);
  };
  for (const node of tree.roots) walk(node);

  const index = ordered.findIndex((doc) => normalizedPath(doc.path) === normalizedPath(path));
  if (index < 0) return {};
  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index + 1 < ordered.length ? ordered[index + 1] : undefined,
  };
}
