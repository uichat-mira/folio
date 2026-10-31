// Minimal consumer-side declaration for `virtual:folio/content`.
//
// The published tarball does not ship a declaration for the virtual module, so
// an independent TypeScript consumer has to write one itself (the official
// `apps/site` does exactly this in `apps/site/src/vite-env.d.ts`). FOL-014
// records the resulting `tsc` diagnostic separately; this file is the
// documented workaround, not a claim that the package types are complete.
declare module "virtual:folio/content" {
  import type { FolioDoc } from "@uichat-mira/folio";

  const docs: FolioDoc[];
  export default docs;

  export const roots: string[];
}
