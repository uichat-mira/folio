// React-facing prop and slot types. Core/Build modules must not import this
// module; only UI modules (and the public barrel) may depend on React types.
import type { ReactNode } from "react";
import type { FolioConfig, FolioDoc } from "./types";
import type { FolioDocNavProps } from "./ui/doc-nav";
import type { FolioTocProps } from "./ui/toc";
import type { FolioTreeNavProps } from "./ui/tree-nav";

export type FolioSlots = {
  home?: ReactNode;
  headerActions?: ReactNode;
  articleFooter?: ReactNode;
  /** Current-document nav renderer; called for desktop and opened mobile menu. */
  docNav?: (props: FolioDocNavProps) => ReactNode;
  /** Override project hierarchy navigation without re-deriving its tree. */
  projectNav?: (props: FolioTreeNavProps) => ReactNode;
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
  /** Show the site footer and articleFooter slot on technical documents (default: true). */
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
