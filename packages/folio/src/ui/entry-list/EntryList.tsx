import { Link } from "react-router-dom";
import type { FolioDoc } from "../../types";

/** One clickable Article tag; its URL is an archive route derived from Core. */
export type FolioEntryTagLink = { label: string; href: string };

/**
 * One externally owned publication or project.
 * `href` is its real canonical URL; it does not create a fake local FolioDoc.
 */
export type FolioListEntry = {
  id?: string;
  href: string;
  title: string;
  description?: string;
  date?: string;
  category?: string;
  cover?: string;
  coverAlt?: string;
  /** Small publisher-owned text, e.g. "13 篇 · 最近更新 ..." */
  meta?: string;
  /** External links open in a new tab by default. */
  target?: "_blank" | "_self";
};

export type FolioListRow = FolioDoc | FolioListEntry;

export type FolioEntryListProps = {
  entries: readonly FolioListRow[];
  headingLevel?: "h2" | "h3";
  /** "editorial" preserves the existing Folio collection/home markup. */
  variant?: "editorial" | "shelf";
  showNumbers?: boolean;
  emptyMessage?: string;
  /** Optional archive-tag links keyed by original document route. */
  tagLinks?: ReadonlyMap<string, readonly FolioEntryTagLink[]>;
};

function destination(row: FolioListRow): { href: string; external: boolean; target?: "_blank" | "_self" } {
  const value = "href" in row ? row.href : row.path;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return { href: value === "/" ? "/" : value.replace(/\/$/, ""), external: false };
  }
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("Folio list entry: invalid href " + JSON.stringify(value)); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Folio list entry: unsupported href " + JSON.stringify(value));
  }
  return { href: parsed.href, external: true, target: "target" in row ? row.target : "_blank" };
}

export function FolioEntryList({
  entries,
  headingLevel = "h2",
  tagLinks,
  variant = "editorial",
  showNumbers = true,
  emptyMessage,
}: FolioEntryListProps) {
  const Heading = headingLevel;
  if (!entries.length) return emptyMessage ? <p className="folio-collection-empty">{emptyMessage}</p> : null;
  const hasCovers = variant === "shelf" && entries.some((entry) => Boolean(entry.cover));
  const classes = [
    "folio-entry-list",
    variant === "shelf" ? "folio-entry-list--shelf" : "",
    hasCovers ? "folio-entry-list--covers" : "",
    showNumbers ? "" : "folio-entry-list--unnumbered",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {entries.map((row, index) => {
        const link = destination(row);
        const key = "id" in row && row.id ? row.id : link.href;
        const tags = tagLinks?.get("path" in row ? row.path : row.href) ?? [];
        const meta = "meta" in row ? row.meta : undefined;
        const coverAlt = "coverAlt" in row && row.coverAlt ? row.coverAlt : row.title + " 封面";
        const number = showNumbers ? (
          <span className="folio-entry-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        ) : null;
        const cover = hasCovers ? (
          <span className="folio-entry-cover-slot">
            {row.cover ? <img className="folio-entry-cover" src={row.cover} alt={coverAlt}
              loading="lazy" decoding="async" /> : null}
          </span>
        ) : null;
        const titleLink = link.external ? (
          <a className="folio-entry-link" href={link.href} target={link.target}
            rel={link.target === "_blank" ? "noopener noreferrer" : undefined}>{row.title}</a>
        ) : <Link className="folio-entry-link" to={link.href}>{row.title}</Link>;
        const copy = (
          <div className="folio-entry-copy">
            {variant === "shelf" && row.category ? <span className="folio-entry-category">{row.category}</span> : null}
            {row.date ? <time className="folio-entry-date" dateTime={row.date}>{row.date}</time> : null}
            <Heading className="folio-entry-title">{tags.length ? titleLink : row.title}</Heading>
            {row.description ? <p className="folio-entry-description">{row.description}</p> : null}
            {meta ? <p className="folio-entry-meta">{meta}</p> : null}
            {tags.length ? (
              <span className="folio-entry-tags">
                {tags.map((tag) => <Link className="folio-entry-tag" to={tag.href} key={tag.href}>{tag.label}</Link>)}
              </span>
            ) : null}
          </div>
        );
        const arrow = <span className="folio-entry-arrow" aria-hidden="true">↗</span>;
        const inner = <>{number}{cover}{copy}{arrow}</>;

        // Preserve the whole-row internal Link for existing collection entries.
        if (!tags.length) {
          if (link.external) {
            return <a className="folio-entry" key={key} href={link.href} target={link.target}
              rel={link.target === "_blank" ? "noopener noreferrer" : undefined}>{inner}</a>;
          }
          return <Link className="folio-entry" key={key} to={link.href}>{inner}</Link>;
        }
        // Tag anchors and the stretched title link are siblings, never nested.
        return <div className="folio-entry" key={key}>{inner}</div>;
      })}
    </div>
  );
}
