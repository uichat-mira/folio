// Plugin entrypoint probe: only `@uichat-mira/folio/vite` is imported, so a red
// run here means the package's own declaration for the `/vite` entry is
// unusable from an independent install.
import {
  folio,
  folioVirtualModule,
  type FolioContentManifest,
  type FolioPluginOptions,
} from "@uichat-mira/folio/vite";
import type { FolioDoc } from "@uichat-mira/folio";

const options: FolioPluginOptions = {
  contentDir: "content",
  config: { title: "FOL-014 vite entry probe", description: "Plugin entrypoint only." },
  staticRoutes: false,
};

const docs: FolioDoc[] = [];

export const plugin = folio(options);
export const virtualModuleId: string = folioVirtualModule;
export const manifest: FolioContentManifest = { docs, roots: [] };
