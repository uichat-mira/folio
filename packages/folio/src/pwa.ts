// Public `@uichat-mira/folio/pwa` entry and one of the tsup inputs.
//
// This is the *explicit opt-in* for the optional PWA integration: a consumer
// that never imports this entry gets no manifest, no service worker and no
// additional bundle weight from it. The implementation lives in
// src/build/pwa.ts (Build/Adapter layer); this module only owns the published
// entry path and the export surface, the same split `src/vite.ts` uses for
// `folio()`.
export {
  FOLIO_PWA_CONTENT_VERSION_FILE,
  computeFolioContentVersion,
  folioPwa,
} from "./build/pwa";
export type {
  FolioPwaContentVersion,
  FolioPwaIcon,
  FolioPwaOptions,
  FolioPwaUpdateMode,
} from "./build/pwa";
