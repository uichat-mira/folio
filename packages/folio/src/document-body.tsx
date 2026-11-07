import type { ReactNode } from "react";
import { FolioMarkdown } from "./markdown-react";
import { FolioDocMeta } from "./ui/doc-meta";
import type { FolioDoc } from "./types";

/**
 * Shared reading content; outer shells own navigation, toolbars and footers.
 * An explicit child replaces only the Markdown body, never document metadata.
 */
export function FolioDocumentBody({
  doc,
  children,
}: {
  doc: FolioDoc;
  children?: ReactNode;
}) {
  return (
    <>
      <h1>{doc.title}</h1>
      {doc.description ? <p className="folio-lede">{doc.description}</p> : null}
      <FolioDocMeta doc={doc} />
      {children ?? <FolioMarkdown source={doc.body} options={{ removeH1: true }} />}
    </>
  );
}
