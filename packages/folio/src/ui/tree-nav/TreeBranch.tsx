import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { FolioContentTreeNode } from "../../core/content-tree";

export type FolioTreeExpansionProps = {
  /** Render an independent +/- disclosure button (default: true). */
  collapsible?: boolean;
  /** Initial state for non-active branches. */
  defaultExpanded?: boolean;
  /** Fully controlled expansion, using node paths and group ids. */
  expandedPaths?: readonly string[];
  /** Called by disclosure button, not by the page link. */
  onExpandChange?: (path: string, expanded: boolean) => void;
};

export type FolioTreeBranchProps = {
  node: FolioContentTreeNode;
  currentPath: string;
  onNavigate?: () => void;
  collapsible?: boolean;
  root?: boolean;
  label?: ReactNode;
  /** Driven by the entire navigation tree, never a state atom per node. */
  isExpanded: (node: FolioContentTreeNode) => boolean;
  onToggle: (node: FolioContentTreeNode, expanded: boolean) => void;
};

/**
 * Single renderer for groups, authored pages and route-derived directories.
 * Parent links navigate; the right-side +/- toggles the child subtree.
 */
export function FolioTreeBranch({
  node, currentPath, onNavigate, root = false, label,
  collapsible = true, isExpanded, onToggle,
}: FolioTreeBranchProps) {
  const descendantsId = useId();
  const hasChildren = node.children.length > 0;
  const expanded = isExpanded(node);
  const active = node.path === currentPath;
  const Element = root ? "section" : "li";
  const isGroup = node.kind === "section";
  const content = label ?? node.title;

  return (
    <Element className={root
      ? isGroup ? "folio-tree-nav__section" : "folio-tree-nav__group"
      : "folio-tree-nav__item"}>
      <div className={"folio-tree-nav__row" + (active ? " is-active" : "") +
        (isGroup ? " folio-tree-nav__row--section" : "")}>
        {node.doc ? (
          <Link
            to={node.doc.path}
            className={root && !isGroup
              ? "folio-tree-nav__overview" + (active ? " active" : "")
              : active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="folio-tree-nav__label">{content}</span>
          </Link>
        ) : isGroup ? (
          <h2>{content}</h2>
        ) : root ? (
          <div className="folio-tree-nav__overview folio-tree-nav__overview--directory">
            {content}
          </div>
        ) : (
          <span className="folio-tree-nav__directory">{content}</span>
        )}
        {hasChildren && collapsible && !isGroup ? (
          <button
            type="button"
            className="folio-tree-nav__toggle"
            aria-label={(expanded ? "收起" : "展开") + node.title + "的子页面"}
            aria-expanded={expanded}
            aria-controls={descendantsId}
            onClick={() => onToggle(node, !expanded)}
          >
            <span className="folio-tree-nav__symbol" aria-hidden="true">
              {expanded ? "−" : "+"}
            </span>
          </button>
        ) : null}
      </div>
      {hasChildren ? (
        <div
          id={descendantsId}
          className="folio-tree-nav__reveal"
          data-expanded={expanded ? "true" : "false"}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className="folio-tree-nav__reveal-inner">
            <ul className={"folio-tree-nav__children" +
              (isGroup ? " folio-tree-nav__children--section" : "")}>
              {node.children.map((child) => (
                <FolioTreeBranch
                  key={child.path}
                  node={child}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  collapsible={collapsible}
                  isExpanded={isExpanded}
                  onToggle={onToggle}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Element>
  );
}
