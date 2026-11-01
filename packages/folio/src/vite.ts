// Public `@uichat-mira/folio/vite` entry and one of the two tsup inputs.
//
// The implementation lives in src/build/vite-adapter.ts (Build/Adapter layer).
// This module exists only to keep the published entry path, the runtime/type
// export surface and dist/vite.d.ts stable while the adapter owns the code
// (FOL-031 / Issue #130). Do not add behavior here: a second implementation
// would let the tested adapter drift from the published one.
export {
  folio,
  folioAbsoluteAssetUrl,
  folioAbsoluteRouteUrl,
  folioEscapeHtml,
  folioVirtualModule,
  renderFolioStaticHome,
  renderFolioStaticHtml,
  writeFolioStaticSite,
} from "./build/vite-adapter";
export type {
  FolioContentManifest,
  FolioPluginOptions,
  FolioStaticBuildContext,
  FolioStaticBuildOptions,
  FolioStaticHomeOverride,
  FolioStaticImageMetadata,
  FolioStaticRoute,
} from "./build/vite-adapter";