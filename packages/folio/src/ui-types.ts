// React-facing prop and slot types. Core/Build modules must not import this
// module; only UI modules (and the public barrel) may depend on React types.
import type { ReactNode } from "react";
import type { FolioConfig, FolioDoc } from "./types";
import type { FolioTocProps } from "./ui/toc";
import type { FolioTreeNavProps } from "./ui/tree-nav";

export type FolioSlots = {
  home?: ReactNode;
  headerActions?: ReactNode;
  articleFooter?: ReactNode;
  /** One navigation override for both docs and projects, desktop and mobile. */
  navigation?: (props: FolioTreeNavProps) => ReactNode;
  /** Current-document TOC renderer; called for desktop and opened mobile TOC. */
  docToc?: (props: FolioTocProps) => ReactNode;
  /** Replaces the entire site footer; the consumer owns the landmark markup. */
  footer?: ReactNode;
};

export type FolioThemePreference = "light" | "dark" | "system";

export type FolioUiOptions = {
  search?: boolean;
  theme?: boolean;
  share?: boolean;
  docsShell?: boolean;
  /**
   * Show site Footer and articleFooter in the shared documentation reading
   * layout (including project pages; default: true). Kept under its existing
   * name for consumer compatibility.
   */
  footerOnDocs?: boolean;
  defaultTheme?: FolioThemePreference;
};

export type FolioAppProps = {
  config: FolioConfig;
  docs: FolioDoc[];
  basePath?: string;
  slots?: FolioSlots;
  ui?: FolioUiOptions;
};
