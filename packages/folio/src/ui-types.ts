// React-facing prop and slot types. Core/Build modules must not import this
// module; only UI modules (and the public barrel) may depend on React types.
import type { ReactNode } from "react";
import type { FolioConfig, FolioDoc } from "./types";

export type FolioSlots = {
  home?: ReactNode;
  headerActions?: ReactNode;
  articleFooter?: ReactNode;
};

export type FolioThemePreference = "light" | "dark" | "system";

export type FolioUiOptions = {
  search?: boolean;
  theme?: boolean;
  share?: boolean;
  docsShell?: boolean;
  defaultTheme?: FolioThemePreference;
};

export type FolioAppProps = {
  config: FolioConfig;
  docs: FolioDoc[];
  basePath?: string;
  slots?: FolioSlots;
  ui?: FolioUiOptions;
};
