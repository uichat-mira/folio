import type { FolioDoc } from "../types";
import { slugify } from "./content";
import {
  buildFolioContentTree,
  folioTreeNodeOrder,
  getFolioTreeNeighbors,
  resolveFolioProjectTree,
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

function collectionDirectories(collection: FolioDocCollection): string[] {
  return [...new Set(collection.docs.map((doc) => parentDirectory(doc.path)))];
}

/** Common directory ancestor for a collection, which may legitimately be /. */
function collectionScope(collection: FolioDocCollection): string {
  const directories = collectionDirectories(collection).map(pathSegments);
  if (!directories.length) return "/";
  const shared = [...directories[0]];
  for (const directory of directories.slice(1)) {
    while (shared.length && shared.some((part, index) => directory[index] !== part)) {
      shared.pop();
    }
  }
  return normalizedPath("/" + shared.join("/"));
}

/**
 * A project is owned by a collection only when its route falls in one of the
 * collection's authored directories. A tie is ambiguous, not permission to
 * attach it to an arbitrary identically named section.
 */
function owningCollection(
  collections: readonly FolioDocCollection[],
  path: string,
): FolioDocCollection | undefined {
  const matches = collections.map((collection) => ({
    collection,
    depth: Math.max(
      -1,
      ...collectionDirectories(collection)
        .filter((directory) => directory !== "/" && isWithin(path, directory))
        .map((directory) => pathSegments(directory).length),
    ),
  })).filter(({ depth }) => depth >= 0);
  if (!matches.length) return undefined;
  const maxDepth = Math.max(...matches.map(({ depth }) => depth));
  const deepest = matches.filter(({ depth }) => depth === maxDepth);
  return deepest.length === 1 ? deepest[0].collection : undefined;
}

function firstAuthored(node: FolioContentTreeNode): FolioDoc | undefined {
  if (node.doc) return node.doc;
  for (const child of node.children) {
    const found = firstAuthored(child);
    if (found) return found;
  }
  return undefined;
}

function sortNodes(nodes: FolioContentTreeNode[]): void {
  nodes.sort((left, right) =>
    folioTreeNodeOrder(left) - folioTreeNodeOrder(right) ||
    left.path.localeCompare(right.path),
  );
}

function sectionNode(
  id: string,
  title: string,
  children: FolioContentTreeNode[],
): FolioNavigationNode {
  sortNodes(children);
  return { path: "folio:section:" + id, title, kind: "section", children };
}

/**
 * Produce one tree for authored collections, sections and nested project pages.
 * Explicit scopePath intentionally widens the route domain. Implicit scoping
 * only includes projects owned by the selected collection's actual directories:
 * a collection spanning /guide and /misc is not a license to import /projects.
 */
export function buildFolioNavigationTree(
  docs: readonly FolioDoc[],
  current: FolioDoc,
  options: FolioNavigationTreeOptions = {},
): FolioNavigationTree {
  if (current.type !== "doc" && current.type !== "project") {
    return { rootPath: "/", roots: [] };
  }

  const collections = buildFolioDocStructure([...docs]).collections;
  const explicitlyScoped = options.scopePath !== undefined;
  const selected = current.type === "doc"
    ? collections.find((collection) =>
        collection.docs.some((doc) => doc.path === current.path))
    : owningCollection(collections, normalizedPath(current.path));

  if (!selected && !explicitlyScoped) {
    const projects = resolveFolioProjectTree(docs, current);
    return { ...projects, scopeId: "project:" + projects.rootPath };
  }

  const scopePath = normalizedPath(
    options.scopePath ?? (selected ? collectionScope(selected) : "/"),
  );
  const scopeCollections = explicitlyScoped
    ? collections.filter((collection) =>
        collection.docs.some((doc) => isWithin(normalizedPath(doc.path), scopePath)))
    : selected ? [selected] : [];

  const groups = new Map<string, FolioNavigationNode>();
  for (const collection of scopeCollections) {
    for (const section of collection.sections) {
      const key = "collection:" + collection.id + "/" + section.id;
      const children = section.docs
        .filter((doc) => !explicitlyScoped || isWithin(normalizedPath(doc.path), scopePath))
        .map((doc): FolioNavigationNode => ({
          path: normalizedPath(doc.path),
          title: doc.title,
          kind: "page",
          doc,
          children: [],
        }));
      if (children.length) groups.set(key, sectionNode(key, section.title, children));
    }
  }

  // For implicit collection scoping, only paths demonstrably belonging to that
  // collection can become project branches. Explicit scopePath is intentional.
  const projectDocs = docs.filter((doc) => {
    if (doc.type !== "project") return false;
    const path = normalizedPath(doc.path);
    if (!isWithin(path, scopePath)) return false;
    return explicitlyScoped ||
      owningCollection(scopeCollections, path)?.id === selected?.id;
  });

  const projects = buildFolioContentTree(projectDocs, { rootPath: scopePath });
  for (const node of projects.roots) {
    const authored = firstAuthored(node);
    const title = authored?.section?.trim() || authored?.group?.trim() || "项目";
    const sectionId = slugify(title) || "projects";
    const owner = owningCollection(scopeCollections, authored?.path ?? node.path);
    const collectionKey = owner ? "collection:" + owner.id + "/" + sectionId : "";
    // Metadata selects a section only inside the owning collection. Labels
    // shared by different collections cannot create a cross-collection join.
    const key = collectionKey && groups.has(collectionKey)
      ? collectionKey : "project:" + (owner?.id ?? scopePath) + "/" + sectionId;
    let group = groups.get(key);
    if (!group) {
      group = sectionNode(key, title, []);
      groups.set(key, group);
    }
    group.children.push(node);
  }

  for (const group of groups.values()) sortNodes(group.children);
  const roots = [...groups.values()].filter((group) => group.children.length);
  sortNodes(roots);
  return {
    rootPath: scopePath,
    scopeId: explicitlyScoped
      ? "scope:" + scopePath
      : "collection:" + selected?.id,
    roots,
  };
}


/**
 * Reading neighbors follow the same visible node order as FolioTreeNav.
 * Collections may contain embedded project trees, so their final project page
 * continues to the next document in the collection rather than stopping.
 *
 * Standalone project trees retain their existing top-level project boundary.
 */
export function getFolioNavigationNeighbors(
  tree: FolioNavigationTree,
  path: string,
): { previous?: FolioDoc; next?: FolioDoc } {
  if (!tree.roots.some((root) => root.kind === "section")) {
    return getFolioTreeNeighbors(tree, path);
  }

  const ordered: FolioDoc[] = [];
  const walk = (node: FolioContentTreeNode): void => {
    if (node.doc) ordered.push(node.doc);
    for (const child of node.children) walk(child);
  };
  for (const root of tree.roots) walk(root);

  const currentPath = normalizedPath(path);
  const index = ordered.findIndex((doc) => normalizedPath(doc.path) === currentPath);
  if (index < 0) return {};
  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index + 1 < ordered.length ? ordered[index + 1] : undefined,
  };
}
