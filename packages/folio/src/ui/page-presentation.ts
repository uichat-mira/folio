import type { FolioDoc } from "../types";

export type FolioReaderKind = "document" | "project" | null;

/** Classify the actual page reader before applying any footer policy. */
export function resolveFolioReaderKind(
  doc: Pick<FolioDoc, "type"> | undefined,
  docsShellEnabled: boolean,
): FolioReaderKind {
  if (!doc || !docsShellEnabled) return null;
  if (doc.type === "doc") return "document";
  if (doc.type === "project") return "project";
  return null;
}

/** A single layout-level policy for both footer surfaces. */
export function shouldShowFolioPageFooter(
  reader: FolioReaderKind,
  footerOnDocs: boolean | undefined,
): boolean {
  return reader === null || footerOnDocs !== false;
}
