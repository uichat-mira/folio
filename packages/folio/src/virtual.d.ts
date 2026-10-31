// Ambient declaration for the virtual module emitted by the Folio Vite plugin.
// This is a global declaration: do not add a top-level import/export.
declare module "virtual:folio/content" {
  import type { FolioDoc } from "@uichat-mira/folio";

  const docs: FolioDoc[];
  export default docs;
  export const roots: string[];
}
