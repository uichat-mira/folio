import { Link } from "react-router-dom";
import { findFolioDocCollection } from "../../core/docs-structure";
import type { FolioDoc } from "../../types";

/** A navigation tree for the current document's collection. */
export type FolioDocNavProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  className?: string;
  ariaLabel?: string;
  /** Called when an entry is activated; useful for closing mobile drawers. */
  onNavigate?: () => void;
};

/**
 * Collection/section navigation derived from Folio document metadata.
 * Consumers can render it directly inside their own router and layouts.
 */
export function FolioDocNav({
  doc,
  docs,
  className,
  ariaLabel = "文档目录",
  onNavigate,
}: FolioDocNavProps) {
  const collection = findFolioDocCollection(docs, doc);
  if (!collection) return null;

  return (
    <nav
      className={["folio-docnav", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      {collection.sections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          <ul>
            {section.docs.map((item) => (
              <li key={item.path}>
                <Link
                  className={item.path === doc.path ? "active" : ""}
                  aria-current={item.path === doc.path ? "page" : undefined}
                  to={item.path}
                  onClick={onNavigate}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
