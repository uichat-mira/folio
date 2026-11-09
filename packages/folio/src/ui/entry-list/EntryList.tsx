import { Link } from "react-router-dom";
import type { FolioDoc } from "../../types";

/** One clickable Article tag; the href is the archive route derived from Core. */
export type FolioEntryTagLink = {
  label: string;
  href: string;
};

export type FolioEntryListProps = {
  entries: FolioDoc[];
  headingLevel: "h2" | "h3";
  /**
   * Optional tag links keyed by document route. Only archive-enabled
   * collections supply this map, so consumers that never opt in keep the
   * previous entry markup exactly.
   */
  tagLinks?: ReadonlyMap<string, readonly FolioEntryTagLink[]>;
};

function entryHref(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

/**
 * Shared editorial entry list for the collection index, archive pages and the
 * built-in home. Entries without tag links render one whole-row link; entries
 * with tags use a stretched title link so the tag anchors stay separate and
 * keyboard reachable instead of nesting interactive elements.
 */
export function FolioEntryList({
  entries,
  headingLevel,
  tagLinks,
}: FolioEntryListProps) {
  const Heading = headingLevel;
  return (
    <div className="folio-entry-list">
      {entries.map((doc, index) => {
        const tags = tagLinks?.get(doc.path) ?? [];
        const number = (
          <span className="folio-entry-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        );
        const copy = (
          <div className="folio-entry-copy">
            {doc.date ? <time className="folio-entry-date" dateTime={doc.date}>{doc.date}</time> : null}
            {tags.length ? (
              <Heading className="folio-entry-title">
                <Link className="folio-entry-link" to={entryHref(doc.path)}>{doc.title}</Link>
              </Heading>
            ) : (
              <Heading className="folio-entry-title">{doc.title}</Heading>
            )}
            {doc.description ? <p className="folio-entry-description">{doc.description}</p> : null}
            {tags.length ? (
              <span className="folio-entry-tags">
                {tags.map((tag) => (
                  <Link className="folio-entry-tag" to={entryHref(tag.href)} key={tag.href}>
                    {tag.label}
                  </Link>
                ))}
              </span>
            ) : null}
          </div>
        );
        const arrow = <span className="folio-entry-arrow" aria-hidden="true">↗</span>;

        if (!tags.length) {
          return (
            <Link to={entryHref(doc.path)} className="folio-entry" key={doc.path}>
              {number}
              {copy}
              {arrow}
            </Link>
          );
        }

        return (
          <div className="folio-entry" key={doc.path}>
            {number}
            {copy}
            {arrow}
          </div>
        );
      })}
    </div>
  );
}
