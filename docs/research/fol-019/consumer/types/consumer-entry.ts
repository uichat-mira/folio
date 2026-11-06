// FOL-019 type-consumption probe.
//
// One file exercises the three public entrypoints a default-UI consumer needs.
// The strict tsconfig.types-baseline.json deliberately does not include
// consumer-side ambient declarations. It must pass from the installed tarball.
import {
  defineFolioConfig,
  FolioApp,
  type FolioAppProps,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";
import {
  folio,
  folioVirtualModule,
  type FolioContentManifest,
  type FolioPluginOptions,
} from "@uichat-mira/folio/vite";
import docs, { roots } from "virtual:folio/content";

const config = defineFolioConfig({
  title: "FOL-019 type probe",
  description: "Type-only consumer of the published entrypoints.",
});

const typedConfig: FolioConfig = config;
export const pluginOptions: FolioPluginOptions = {
  contentDir: "content",
  config: typedConfig,
  staticRoutes: false,
};
export const plugin = folio(pluginOptions);

export const docsValue: FolioDoc[] = docs;
export const rootsValue: string[] = roots;
export const manifest: FolioContentManifest = { docs: docsValue, roots: rootsValue };
export const virtualModuleId: string = folioVirtualModule;
export const appProps: FolioAppProps = {
  config: typedConfig,
  docs: docsValue,
  basePath: "/",
};
export const appComponent = FolioApp;
