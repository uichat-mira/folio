// FOL-014 type-consumption probe.
//
// One file exercises the three public entrypoints a default-UI consumer needs.
// It is compiled twice by `run.mjs`:
//   * tsconfig.types-baseline.json  -> no local declaration for the virtual
//     module, i.e. the type experience of a consumer who only installed the
//     tarball;
//   * tsconfig.types-declared.json  -> plus types/virtual-folio.d.ts, the
//     workaround documented in the report.
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
  title: "FOL-014 type probe",
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
