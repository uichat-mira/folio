// Root entrypoint probe: only `@uichat-mira/folio` is imported, so a red run
// here means the package's own declaration for the root entry is unusable from
// an independent install.
import {
  defineFolioConfig,
  FolioApp,
  type FolioAppProps,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";

const config = defineFolioConfig({
  title: "FOL-014 root entry probe",
  description: "Type-only consumer of the root entrypoint.",
});

const typedConfig: FolioConfig = config;
const docs: FolioDoc[] = [];

export const appProps: FolioAppProps = { config: typedConfig, docs, basePath: "/" };
export const appComponent = FolioApp;
