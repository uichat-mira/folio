import type { ReactNode } from "react";

export type FolioEntryType = "doc" | "article" | "project" | "page" | string;

export type FolioHeading = {
  depth: number;
  text: string;
  id: string;
};

export type FolioDoc = {
  id: string;
  path: string;
  sourcePath: string;
  type: FolioEntryType;
  title: string;
  description: string;
  group: string;
  collection?: string;
  section?: string;
  order: number;
  date?: string;
  tags: string[];
  status?: string;
  cover?: string;
  body: string;
  headings: FolioHeading[];
  data: Record<string, unknown>;
};

export type FolioNavigationItem = {
  label: string;
  href: string;
};

export type FolioConfig = {
  title: string;
  description: string;
  logo?: string;
  siteUrl?: string;
  base?: string;
  navigation?: FolioNavigationItem[];
  footer?: string;
  github?: string;
};

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
