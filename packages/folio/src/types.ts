// Core content/config types. This module must stay free of React (and of every
// other UI runtime) so Core and Build code can depend on it directly.

export type FolioEntryType = "doc" | "article" | "project" | "page" | string;

export type FolioHeading = {
  depth: number;
  text: string;
  id: string;
};

/**
 * Provenance of a `FolioDoc` date. This is deliberately explicit: a Git first
 * commit only proves when the file entered the *current* repository, which can
 * be later than its original publication (for example after a migration).
 *
 * - `frontmatter`: an explicit `publishedAt` / `updatedAt` value.
 * - `legacy-date`: the legacy `date` field used as `publishedAt`.
 * - `git-first-commit`: earliest commit in the current repository containing
 *   the file (not necessarily the original publication date).
 * - `git-last-commit`: latest commit that changed the file.
 * - `unknown`: no trustworthy source; no value is emitted.
 */
export type FolioDateSource =
  | "frontmatter"
  | "legacy-date"
  | "git-first-commit"
  | "git-last-commit"
  | "unknown";

/**
 * Date provenance attached by `parseFolioDoc` and completed by the Vite
 * adapter. `historyComplete` is `false` for a shallow/incomplete clone, where
 * the earliest visible commit cannot be trusted as the first commit; `undefined`
 * means no Git history was consulted.
 */
export type FolioDateSources = {
  publishedAt: FolioDateSource;
  updatedAt: FolioDateSource;
  historyComplete?: boolean;
};

/**
 * One author for generated Article/TechArticle structured data. A string is a
 * display name; the object form adds an optional canonical profile URL to the
 * emitted Schema.org `Person`.
 */
export type FolioAuthor = string | { name: string; url?: string };

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
  /** Legacy frontmatter date, kept verbatim for existing display/sorting. */
  date?: string;
  /**
   * ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`), or `undefined` when no
   * trustworthy source exists. Explicit frontmatter wins; otherwise the Vite
   * adapter may fill it from local Git history.
   */
  publishedAt?: string;
  /** ISO 8601 UTC timestamp, or `undefined` when no trustworthy source exists. */
  updatedAt?: string;
  /** Provenance for `publishedAt` / `updatedAt`; set by `parseFolioDoc`. */
  dateSources?: FolioDateSources;
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

export type FolioHomeSectionType =
  | "intro"
  | "featured"
  | "recent"
  | "collections"
  | "about";

export type FolioHomeIntroSectionConfig = {
  type: "intro";
  /** Route collection shown by the intro link; defaults to the first collection. */
  collection?: string;
  title?: string;
  description?: string;
  kicker?: string;
};

export type FolioHomeFeaturedSectionConfig = {
  type: "featured";
  /** Route collection used to select the fallback story; defaults to the first collection. */
  collection?: string;
  /** Explicit document route. Overrides collection ordering. */
  path?: string;
  label?: string;
  readLabel?: string;
};

export type FolioHomeRecentSectionConfig = {
  type: "recent";
  /** Route collection used to select recent stories; defaults to the first collection. */
  collection?: string;
  /** Maximum number of entries after the featured story. Defaults to 4. */
  limit?: number;
  title?: string;
  label?: string;
  emptyMessage?: string;
  endMessage?: string;
};

export type FolioHomeCollectionsSectionConfig = {
  type: "collections";
  /** Configured collection routes to show. Defaults to every collection except the primary one. */
  paths?: string[];
  /** Maximum number of entries per collection. Defaults to 3. */
  limit?: number;
  emptyMessage?: string;
};

export type FolioHomeAboutSectionConfig = {
  type: "about";
  /** Explicit page route. Defaults to the first page-type entry. */
  path?: string;
  title?: string;
  description?: string;
  linkLabel?: string;
};

export type FolioHomeSectionConfig =
  | FolioHomeIntroSectionConfig
  | FolioHomeFeaturedSectionConfig
  | FolioHomeRecentSectionConfig
  | FolioHomeCollectionsSectionConfig
  | FolioHomeAboutSectionConfig;

export type FolioHomeMetaConfig = {
  left?: string;
  right?: string;
};

export type FolioHomeConfig = {
  /** Set to false to hide the editorial meta strip. */
  meta?: false | FolioHomeMetaConfig;
  /**
   * Ordered home blocks. Omitting this keeps the default editorial order:
   * intro, featured, recent, collections, about. An empty array renders no
   * blocks beyond the optional meta strip.
   */
  sections?: FolioHomeSectionConfig[];
};

export type FolioConfig = {
  title: string;
  description: string;
  /**
   * Default author(s) for generated Article/TechArticle structured data. A
   * document's explicit frontmatter `author` always wins. When neither exists
   * the JSON-LD `author` property is omitted; Folio never emits an empty list
   * or a fabricated person.
   */
  author?: FolioAuthor | FolioAuthor[];
  logo?: string;
  siteUrl?: string;
  base?: string;
  navigation?: FolioNavigationItem[];
  /** Optional route-based collection index pages. */
  collections?: FolioCollectionConfig[];
  /** Optional lightweight configuration for the built-in home page. */
  home?: FolioHomeConfig;
  footer?: string;
  github?: string;
};
