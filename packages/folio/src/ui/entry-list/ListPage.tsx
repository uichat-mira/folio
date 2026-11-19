import { FolioEntryList, type FolioEntryListProps } from "./EntryList";

export type FolioListPageProps = FolioEntryListProps & {
  title: string;
  description?: string;
  /** Optional section marker, e.g. "BOOKS / 书架". */
  eyebrow?: string;
  className?: string;
};

/**
 * Public, theme-aware list page that can render internal Folio documents
 * or external publications. Consumers own the data and route; Folio owns
 * the consistent page composition and CSS tokens.
 */
export function FolioListPage({
  title,
  description,
  eyebrow,
  className,
  ...list
}: FolioListPageProps) {
  return (
    <main className={["folio-home folio-collection-page folio-list-page", className].filter(Boolean).join(" ")}>
      <header className="folio-journal-hero folio-collection-hero folio-list-page-heading">
        {eyebrow ? <span className="folio-journal-kicker">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      <FolioEntryList {...list} />
    </main>
  );
}
