// Core content/config types. This module must stay free of React (and of every
// other UI runtime) so Core and Build code can depend on it directly.

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

export type FolioCollectionConfig = {
  /** Route directory; descendants at any depth are indexed. */
  path: string;
  /** The collection heading. Defaults to navigation label or route segment. */
  title?: string;
  description?: string;
  emptyMessage?: string;
};

export type FolioConfig = {
  title: string;
  description: string;
  logo?: string;
  siteUrl?: string;
  base?: string;
  navigation?: FolioNavigationItem[];
  /** Optional route-based collection index pages. */
  collections?: FolioCollectionConfig[];
  footer?: string;
  github?: string;
};
