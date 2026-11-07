import { getFolioDocByline } from "../../core/doc-meta";
import type { FolioDoc } from "../../types";

export type FolioDocMetaProps = {
  doc: Pick<FolioDoc, "data" | "body" | "createdBy" | "createdAt" | "publishedAt">;
  className?: string;
};

/** Compact editorial byline; full Git provenance remains on FolioDoc. */
export function FolioDocMeta({ doc, className }: FolioDocMetaProps) {
  const byline = getFolioDocByline(doc);
  if (!byline) return null;

  return (
    <div className={["folio-doc-meta", className].filter(Boolean).join(" ")} role="group" aria-label="文章信息">
      {byline.author ? (
        <span className="folio-doc-meta__author">
          <span className="folio-doc-meta__avatar" aria-hidden="true">
            {byline.author.initial}
            {byline.author.avatar ? <img src={byline.author.avatar} alt="" loading="lazy" /> : null}
          </span>
          <span className="folio-doc-meta__name">{byline.author.name}</span>
        </span>
      ) : null}
      {byline.date ? (
        <span className="folio-doc-meta__detail">
          {byline.author ? <span className="folio-doc-meta__separator" aria-hidden="true">/</span> : null}
          <time dateTime={byline.date.dateTime}>{byline.date.value}</time>
        </span>
      ) : null}
      {byline.readingMinutes ? (
        <span className="folio-doc-meta__detail">
          <span className="folio-doc-meta__separator" aria-hidden="true">/</span>
          <span>约 {byline.readingMinutes} 分钟</span>
        </span>
      ) : null}
    </div>
  );
}
