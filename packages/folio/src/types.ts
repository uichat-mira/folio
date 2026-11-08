// Core content/config types. This module must stay free of React (and of every
// other UI runtime) so Core and Build code can depend on it directly.

export type FolioEntryType = "doc" | "article" | "page" | string;

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
 * emitted Schema.org `Person`, plus an optional image for the byline avatar.
 */
export type FolioAuthor = string | { name: string; url?: string; avatar?: string };

/** Git records are file-history evidence, not editorial authorship or publication dates. */
export type FolioGitRevision = {
  committedAt: string;
  /** The Git commit's author name, used exactly as recorded (no email). */
  author?: string;
  /** GitHub commit-associated avatar (when verifiable at build time). */
  githubAvatarUrl?: string;
};

export type FolioGitHistory = {
  /** Omitted for shallow/incomplete history; earliest visible is not the first. */
  first?: FolioGitRevision;
  /** Latest available commit affecting this content path. */
  last?: FolioGitRevision;
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
  /** Legacy frontmatter date, kept verbatim for existing display/sorting. */
  date?: string;
  /**
   * ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`), or `undefined` when no
   * trustworthy source exists. Explicit frontmatter wins; otherwise the Vite
   * adapter may fill it from local Git history.
   */
  publishedAt?: string;
  /** Git first commit by default; frontmatter createdAt takes precedence. */
  createdAt?: string;
  /** ISO 8601 UTC timestamp, or undefined when no trustworthy source exists. */
  updatedAt?: string;
  /** Git first author by default; frontmatter createdBy takes precedence. */
  createdBy?: string;
  /** Git latest author by default; frontmatter updatedBy takes precedence. */
  updatedBy?: string;
  /** Provenance for `publishedAt` / `updatedAt`; set by `parseFolioDoc`. */
  dateSources?: FolioDateSources;
  /** Build-time Git provenance, omitted for untracked files or unavailable history. */
  gitHistory?: FolioGitHistory;
  tags: string[];
  status?: string;
  cover?: string;
  body: string;
  headings: FolioHeading[];
  data: Record<string, unknown>;
};

/** A page navigation target needs a route and a title, not an entire document. */
export type FolioPageNavTarget = Pick<FolioDoc, "path" | "title">;

/** The reading context calculates neighbors; presentation consumes them. */
export type FolioPageNavNeighbors = {
  previous?: FolioPageNavTarget;
  next?: FolioPageNavTarget;
};

/**
 * Built-in icon keys for structured navigation entries. This is a convenience
 * for editor autocomplete, not a closed set: `icon` accepts any other string
 * too and simply renders without an icon. Keeping the value a plain string is
 * what lets this module stay React-free for Core and Build consumers.
 */
export type FolioNavigationIconName =
  | "book"
  | "compass"
  | "layers"
  | "sparkles"
  | "code"
  | "file"
  | "archive"
  | "link"
  | "terminal"
  | "info"
  | "search";

/**
 * One link inside a structured navigation dropdown. The icon and description
 * are presentation hints for the default header only; they do not affect
 * routing.
 */
export type FolioNavigationChild = {
  label: string;
  href: string;
  /** Built-in icon key (`FolioNavigationIconName`) or any other string. */
  icon?: string;
  /** One short line under the label. */
  description?: string;
  /**
   * Optional reading-task group inside the dropdown. Entries sharing a group
   * render together under one small heading, in first-seen order. Entries
   * without a group render first, ungrouped. Leaving this out keeps the
   * previously flat panel exactly as it was.
   */
  group?: string;
};

/**
 * Optional chrome around a navigation dropdown. Every field is optional: an
 * item with `children` but no `panel` still renders a titled panel derived
 * from the navigation label.
 */
export type FolioNavigationPanel = {
  /** Small uppercase eyebrow above the title, for example "FOLIO HANDBOOK". */
  eyebrow?: string;
  /** Panel heading. Defaults to the navigation item label. */
  title?: string;
  /** Supporting sentence under the heading. */
  description?: string;
  /**
   * Label for the generated entry pointing at the navigation item's own
   * `href`. Defaults to `全部{label}`. The entry is skipped when a child
   * already links to that `href`.
   */
  overviewLabel?: string;
};

/**
 * One top-level navigation entry. `{ label, href }` keeps working exactly as
 * before and renders a plain link; adding `children` turns the entry into a
 * structured dropdown in the default header.
 */
export type FolioNavigationItem = {
  label: string;
  /**
   * Explicit destination. It wins over `collection` when both are present.
   * An item needs at least one of `href` or `collection`.
   */
  href?: string;
  /**
   * Route collection that supplies the section entry. The destination becomes
   * the first `type: doc` entry in read order (or the first entry overall when
   * the collection has no documents), falling back to the collection index
   * when empty. The collection root automatically marks the entry active.
   */
  collection?: string;
  /**
   * Extra route prefixes that should mark this entry as current, in addition to
   * `href` itself. A section whose pages live under more than one route
   * directory needs this: prefix matching alone would leave the entry
   * unhighlighted on the pages outside `href`.
   */
  activeMatch?: string[];
  /** Structured dropdown entries. Omitted or empty renders a plain link. */
  children?: FolioNavigationChild[];
  /** Optional dropdown panel heading and description. */
  panel?: FolioNavigationPanel;
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

/** A footer link. Internal routes use React Router; external URLs stay links. */
export type FolioFooterLink = {
  label: string;
  href: string;
  /** Open in a new tab. Defaults to false, including for external URLs. */
  newTab?: boolean;
};

/** Optional site identity in a structured portal footer. */
export type FolioFooterBrand = {
  /** Defaults to the site's config.title. */
  name?: string;
  description?: string;
  /** Defaults to the site root. */
  href?: string;
  /** Site-owned logo URL. Root-relative assets honor the runtime basename. */
  logo?: {
    src: string;
    /** Optional dark-theme asset; avoids filters and preserves brand artwork. */
    darkSrc?: string;
    alt?: string;
  };
};

export type FolioFooterGroup = {
  title: string;
  links: FolioFooterLink[];
};

export type FolioFooterLegal = {
  /** Plain text; no year or legal entity is invented automatically. */
  copyright?: string;
  /** e.g. jurisdiction-specific filing/registration links. */
  registrations?: FolioFooterLink[];
  /** Privacy, terms, accessibility or other legal destinations. */
  links?: FolioFooterLink[];
};

/** Common portal-footer composition without a custom React component. */
export type FolioFooterConfig = {
  brand?: FolioFooterBrand;
  groups?: FolioFooterGroup[];
  legal?: FolioFooterLegal;
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
  /** Legacy text, structured portal footer, or false to hide it entirely. */
  footer?: string | FolioFooterConfig | false;
  github?: string;
};
