import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  folioTreeDisplayLabel,
  type FolioContentTree,
  type FolioContentTreeNode,
} from "../../core/content-tree";
import { FolioTreeBranch, type FolioTreeExpansionProps } from "./TreeBranch";
import { useFolioNavigationState } from "./NavigationState";

export type FolioTreeNavProps = FolioTreeExpansionProps & {
  tree: FolioContentTree;
  currentPath: string;
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
};

function selectedAncestors(tree: FolioContentTree, currentPath: string): string[] {
  function walk(node: FolioContentTreeNode): string[] | undefined {
    if (node.path === currentPath) return [node.path];
    for (const child of node.children) {
      const found = walk(child);
      if (found) return [node.path, ...found];
    }
    return undefined;
  }
  for (const root of tree.roots) {
    const found = walk(root);
    if (found) return found;
  }
  return [];
}

/** The only React sidebar renderer for project and collection navigation. */
export function FolioTreeNav({
  tree, currentPath, className, ariaLabel, onNavigate,
  collapsible = true, defaultExpanded = false, expandedPaths, onExpandChange,
}: FolioTreeNavProps) {
  const appState = useFolioNavigationState();
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({});
  const previousLocalRoute = useRef<string | null>(null);
  const selected = useMemo(
    () => selectedAncestors(tree, currentPath),
    [tree, currentPath],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const scope = tree.scopeId ?? tree.rootPath;
  const overrides = appState?.values ?? localOverrides;

  useEffect(() => {
    if (expandedPaths) return;
    if (appState) {
      appState.revealOnRoute(scope, currentPath, selected);
    } else if (previousLocalRoute.current !== currentPath) {
      previousLocalRoute.current = currentPath;
      setLocalOverrides((old) => {
        let next = old;
        for (const id of selected) {
          const key = scope + "::" + id;
          if (next[key] === true) continue;
          if (next === old) next = { ...old };
          next[key] = true;
        }
        return next;
      });
    }
  }, [appState, scope, currentPath, selected, expandedPaths]);

  const isExpanded = useCallback((node: FolioContentTreeNode) => {
    if (!node.children.length) return false;
    // Collection sections are taxonomy labels, not interactive branches.
    // Do not let controlled expansion accidentally hide their content.
    if (node.kind === "section") return true;
    // With no disclosure control, hiding descendants would make them unreachable.
    if (!collapsible) return true;
    if (expandedPaths !== undefined) return expandedPaths.includes(node.path);
    const override = overrides[scope + "::" + node.path];
    return override ?? (
      defaultExpanded || selectedSet.has(node.path) ||
      !node.doc
    );
  }, [collapsible, expandedPaths, overrides, scope, defaultExpanded, selectedSet]);

  const toggle = useCallback((node: FolioContentTreeNode, expanded: boolean) => {
    const key = scope + "::" + node.path;
    if (expandedPaths === undefined) {
      if (appState) appState.change(key, expanded);
      else setLocalOverrides((old) => ({ ...old, [key]: expanded }));
    }
    onExpandChange?.(node.path, expanded);
  }, [scope, expandedPaths, appState, onExpandChange]);

  if (!tree.roots.length) return null;
  const documentMode = tree.roots.some((root) => root.kind === "section");
  return (
    <nav
      className={["folio-tree-nav", documentMode && "folio-tree-nav--sections", className]
        .filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? (documentMode ? "文档目录" : "项目目录")}
    >
      <div className="folio-tree-nav__groups">
        {tree.roots.map((node) => {
          const display = documentMode ? null : folioTreeDisplayLabel(node.title);
          const name = display ? (
            <>
              {display.eyebrow ? (
                <span className="folio-tree-nav__eyebrow">{display.eyebrow}</span>
              ) : null}
              <span className="folio-tree-nav__title">{display.title}</span>
            </>
          ) : undefined;
          return (
            <FolioTreeBranch
              key={node.path}
              root
              node={node}
              label={name}
              currentPath={currentPath}
              onNavigate={onNavigate}
              collapsible={collapsible}
              isExpanded={isExpanded}
              onToggle={toggle}
            />
          );
        })}
      </div>
    </nav>
  );
}
