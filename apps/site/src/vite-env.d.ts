/// <reference types="vite/client" />

declare module "virtual:folio/content" {
  import type { FolioDoc } from "@uichat-mira/folio";
  const docs: FolioDoc[];
  export default docs;
}
