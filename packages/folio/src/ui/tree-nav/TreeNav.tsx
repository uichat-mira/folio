import { Link } from "react-router-dom";
import {
  folioTreeDisplayLabel,
  type FolioContentTree,
  type FolioContentTreeNode,
} from "../../core/content-tree";

export type FolioTreeNavProps = {
  tree: FolioContentTree;
  currentPath: string;
  className?: string;
  ariaLabel?: string;
  /** Passed through to every navigable leaf/overview. */
  onNavigate?: () => void;
};

function TreeChildren({
  children,
  currentPath,
  onNavigate,
}: {
  children: readonly FolioContentTreeNode[];
  currentPath: string;
  onNavigate?: () => void;
}) {
  if (!children.length) return null;
  return (
    <ul className="folio-tree-nav__children">
      {children.map((node) => (
        <li key={node.path}>
          {node.doc ? (
            <Link
              to={node.doc.path}
              className={node.path === currentPath ? "active" : ""}
              aria-current={node.path === currentPath ? "page" : undefined}
              onClick={onNavigate}
            >{node.title}</Link>
          ) : (
            <span className="folio-tree-nav__directory">{node.title}</span>
          )}
          <TreeChildren
            children={node.children}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  );
}

/** General-purpose, path-derived hierarchy for projects and portal sections. */
export function FolioTreeNav({
  tree,
  currentPath,
  className,
  ariaLabel = "项目目录",
  onNavigate,
}: FolioTreeNavProps) {
  if (!tree.roots.length) return null;
  return (
    <nav
      className={["folio-docnav", "folio-tree-nav", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      <div className="folio-tree-nav__groups">
        {tree.roots.map((node) => {
          const label = folioTreeDisplayLabel(node.title);
          const name = (
            <>
              {label.eyebrow ? (
                <span className="folio-tree-nav__eyebrow">{label.eyebrow}</span>
              ) : null}
              <span className="folio-tree-nav__title">{label.title}</span>
            </>
          );
          return (
            <section className="folio-tree-nav__group" key={node.path}>
              {node.doc ? (
                <Link
                  to={node.doc.path}
                  className={
                    "folio-tree-nav__overview" +
                    (node.path === currentPath ? " active" : "")
                  }
                  aria-current={node.path === currentPath ? "page" : undefined}
                  onClick={onNavigate}
                >{name}</Link>
              ) : (
                <div className="folio-tree-nav__overview folio-tree-nav__overview--directory">
                  {name}
                </div>
              )}
              <TreeChildren
                children={node.children}
                currentPath={currentPath}
                onNavigate={onNavigate}
              />
            </section>
          );
        })}
      </div>
    </nav>
  );
}
