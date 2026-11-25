/// <reference types="vite/client" />

declare module "virtual:folio/content" {
  const docs: import("@uichat-mira/folio").FolioDoc[];
  export default docs;
}
