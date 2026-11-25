import {
  folioCollectionIndexes,
  normalizeFolioCollectionPath,
  selectFolioCollectionDocs,
  type FolioCollectionIndex,
} from "./collection-index";
import type {
  FolioConfig,
  FolioDoc,
  FolioHomeAboutSectionConfig,
  FolioHomeCollectionsSectionConfig,
  FolioHomeConfig,
  FolioHomeFeaturedSectionConfig,
  FolioHomeIntroSectionConfig,
  FolioHomeRecentSectionConfig,
  FolioHomeSectionConfig,
  FolioHomeTemplate,
} from "../types";

export type FolioHomeIntroSection = {
  type: "intro";
  title: string;
  description: string;
  kicker: string;
  collection?: FolioCollectionIndex;
};

export type FolioHomeFeaturedSection = {
  type: "featured";
  doc: FolioDoc;
  collection?: FolioCollectionIndex;
  number: number;
  total: number;
  label: string;
  readLabel: string;
};

export type FolioHomeRecentSection = {
  type: "recent";
  docs: FolioDoc[];
  collection?: FolioCollectionIndex;
  title: string;
  label: string;
  emptyMessage: string;
  endMessage: string;
  hadEntries: boolean;
};

export type FolioHomeCollectionsSection = {
  type: "collections";
  collections: Array<{
    collection: FolioCollectionIndex;
    docs: FolioDoc[];
    emptyMessage: string;
  }>;
};

export type FolioHomeAboutSection = {
  type: "about";
  doc: FolioDoc;
  title: string;
  description: string;
  linkLabel: string;
};

export type FolioHomeSection =
  | FolioHomeIntroSection
  | FolioHomeFeaturedSection
  | FolioHomeRecentSection
  | FolioHomeCollectionsSection
  | FolioHomeAboutSection;

export type FolioHomeModel = {
  template: FolioHomeTemplate;
  meta?: {
    left: string;
    right: string;
  };
  sections: FolioHomeSection[];
};

type FolioHomeDefaults = {
  metaLeft?: string;
  metaRight?: string;
  kicker: string;
  featuredLabel: string;
  readLabel: string;
  recentTitle: string;
  recentLabel: string;
  endMessage: string;
  aboutLink: string;
};

const PORTAL_DEFAULTS: FolioHomeDefaults = {
  kicker: "",
  featuredLabel: "FEATURED",
  readLabel: "阅读全文",
  recentTitle: "近期内容",
  recentLabel: "RECENT",
  endMessage: "更多内容正在准备中。",
  aboutLink: "了解更多",
};

const EDITORIAL_DEFAULTS: FolioHomeDefaults = {
  metaLeft: "PERSONAL JOURNAL ✳",
  metaRight: "READ · COLLECT · REMEMBER",
  kicker: "写给生活的零碎记录",
  featuredLabel: "FEATURED STORY",
  readLabel: "开始阅读",
  recentTitle: "近期内容",
  recentLabel: "01 / READING",
  endMessage: "更多记录，正在慢慢写下。",
  aboutLink: "读读关于小站",
};

const DEFAULT_EMPTY_MESSAGE = "这里还没有内容。";
const DEFAULT_SECTION_TYPES = [
  "intro",
  "featured",
  "recent",
  "collections",
  "about",
] as const;

function normalizeHomeDocPath(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value === "/") {
    throw new Error("folio home " + field + " must be a non-root absolute route");
  }
  if (value.includes("?") || value.includes("#") || value.includes("\\") || value.includes("//")) {
    throw new Error("folio home " + field + " contains an invalid character: " + JSON.stringify(value));
  }
  const parts = value.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("folio home " + field + " contains an invalid segment: " + JSON.stringify(value));
  }
  return "/" + parts.join("/");
}

function homeDocPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
  return parts.length ? "/" + parts.join("/") : "/";
}

function homeLimit(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("folio home " + field + " must be a non-negative integer");
  }
  return value;
}

function homeText(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new Error("folio home " + field + " must be a string");
  }
  return value;
}

function collectionForPath(
  collections: FolioCollectionIndex[],
  path: string | undefined,
  fallback: FolioCollectionIndex | undefined,
): FolioCollectionIndex | undefined {
  if (path === undefined) return fallback;
  const normalized = normalizeFolioCollectionPath(path);
  const collection = collections.find((candidate) => candidate.path === normalized);
  if (!collection) {
    throw new Error("folio home collection " + JSON.stringify(normalized) + " is not a configured collection");
  }
  return collection;
}

function sourceDocs(
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  path: string | undefined,
  fallback: FolioCollectionIndex | undefined,
): { collection?: FolioCollectionIndex; docs: FolioDoc[] } {
  const collection = collectionForPath(collections, path, fallback);
  if (path !== undefined) {
    return {
      collection,
      docs: selectFolioCollectionDocs(docs, collection!.path),
    };
  }
  return {
    collection: fallback,
    docs: fallback
      ? selectFolioCollectionDocs(docs, fallback.path)
      : docs.filter((doc) => doc.type !== "page"),
  };
}

function resolveFeatured(
  section: FolioHomeFeaturedSectionConfig,
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
  defaults: FolioHomeDefaults,
): FolioHomeFeaturedSection | undefined {
  const source = sourceDocs(docs, collections, section.collection, primary);
  const explicitPath = section.path === undefined
    ? undefined
    : normalizeHomeDocPath(section.path, "featured path");
  const doc = explicitPath
    ? docs.find((item) => homeDocPath(item.path) === explicitPath)
    : source.docs[0];
  if (!doc) {
    if (explicitPath) {
      throw new Error("folio home featured path " + JSON.stringify(explicitPath) + " does not match any document");
    }
    return undefined;
  }
  const position = source.docs.findIndex((item) => item.path === doc.path);
  const number = position >= 0 ? position + 1 : 1;
  return {
    type: "featured",
    doc,
    collection: source.collection,
    number,
    total: Math.max(source.docs.length, number),
    label: homeText(section.label, defaults.featuredLabel, "featured label"),
    readLabel: homeText(section.readLabel, defaults.readLabel, "featured readLabel"),
  };
}

function resolveIntro(
  section: FolioHomeIntroSectionConfig,
  config: FolioConfig,
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
  defaults: FolioHomeDefaults,
): FolioHomeIntroSection {
  const collection = collectionForPath(collections, section.collection, primary);
  return {
    type: "intro",
    title: homeText(section.title, config.title, "intro title"),
    description: homeText(section.description, config.description, "intro description"),
    kicker: homeText(section.kicker, defaults.kicker, "intro kicker"),
    collection,
  };
}

function resolveRecent(
  section: FolioHomeRecentSectionConfig,
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
  featuredPaths: Set<string>,
  defaults: FolioHomeDefaults,
): FolioHomeRecentSection {
  const source = sourceDocs(docs, collections, section.collection, primary);
  const available = source.docs.filter((doc) => !featuredPaths.has(doc.path));
  const limit = homeLimit(section.limit, 4, "recent limit");
  return {
    type: "recent",
    docs: available.slice(0, limit),
    collection: source.collection,
    title: homeText(section.title, source.collection?.title ?? defaults.recentTitle, "recent title"),
    label: homeText(section.label, defaults.recentLabel, "recent label"),
    emptyMessage: homeText(section.emptyMessage, DEFAULT_EMPTY_MESSAGE, "recent emptyMessage"),
    endMessage: homeText(section.endMessage, defaults.endMessage, "recent endMessage"),
    hadEntries: source.docs.length > 0,
  };
}

function resolveCollections(
  section: FolioHomeCollectionsSectionConfig,
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
): FolioHomeCollectionsSection | undefined {
  const limit = homeLimit(section.limit, 3, "collections limit");
  const emptyMessage = homeText(section.emptyMessage, DEFAULT_EMPTY_MESSAGE, "collections emptyMessage");
  let paths: string[];
  if (section.paths !== undefined) {
    if (!Array.isArray(section.paths)) {
      throw new Error("folio home collections paths must be an array");
    }
    paths = section.paths.map((path) => normalizeFolioCollectionPath(path));
    if (new Set(paths).size !== paths.length) {
      throw new Error("folio home collections paths must not contain duplicates");
    }
  } else {
    paths = collections
      .filter((collection) => collection.path !== primary?.path)
      .map((collection) => collection.path);
  }

  const entries = paths.map((path) => {
    const collection = collections.find((candidate) => candidate.path === path);
    if (!collection) {
      throw new Error("folio home collections path " + JSON.stringify(path) + " is not a configured collection");
    }
    return {
      collection,
      docs: selectFolioCollectionDocs(docs, collection.path).slice(0, limit),
      emptyMessage,
    };
  });
  if (!entries.length) return undefined;
  return {
    type: "collections",
    collections: entries,
  };
}

function resolveAbout(
  section: FolioHomeAboutSectionConfig,
  config: FolioConfig,
  docs: readonly FolioDoc[],
  defaults: FolioHomeDefaults,
): FolioHomeAboutSection | undefined {
  const explicitPath = section.path === undefined
    ? undefined
    : normalizeHomeDocPath(section.path, "about path");
  const doc = explicitPath
    ? docs.find((item) => homeDocPath(item.path) === explicitPath)
    : docs.find((item) => item.type === "page");
  if (!doc) {
    if (explicitPath) {
      throw new Error("folio home about path " + JSON.stringify(explicitPath) + " does not match any document");
    }
    return undefined;
  }
  return {
    type: "about",
    doc,
    title: homeText(section.title, doc.title, "about title"),
    description: homeText(section.description, doc.description || config.description, "about description"),
    linkLabel: homeText(section.linkLabel, defaults.aboutLink, "about linkLabel"),
  };
}

function homeTemplate(home: FolioHomeConfig): FolioHomeTemplate {
  const value = home.template;
  if (value === undefined) return "portal";
  if (value !== "portal" && value !== "editorial") {
    throw new Error('folio home template must be "portal" or "editorial"');
  }
  return value;
}

function homeConfig(config: FolioConfig): FolioHomeConfig {
  const value = config.home;
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("folio home config must be an object");
  }
  return value;
}

function sectionConfigs(home: FolioHomeConfig): FolioHomeSectionConfig[] {
  if (home.sections === undefined) {
    return DEFAULT_SECTION_TYPES.map((type) => ({ type }));
  }
  if (!Array.isArray(home.sections)) {
    throw new Error("folio home sections must be an array");
  }
  return home.sections.map((section, index) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) {
      throw new Error("folio home section " + index + " must be an object");
    }
    if (!DEFAULT_SECTION_TYPES.includes(section.type as never)) {
      throw new Error("folio home section " + index + " has an unknown type: " + JSON.stringify((section as { type?: unknown }).type));
    }
    return section;
  });
}

/**
 * Resolves the built-in home page into a platform-neutral model. React and
 * static rendering both consume this function so their template selection,
 * content, ordering and links cannot drift. Omitting `home` (or
 * `home.template`) selects the neutral Portal template; `editorial` must be
 * requested explicitly.
 */
export function resolveFolioHome(
  config: FolioConfig,
  docs: readonly FolioDoc[],
): FolioHomeModel {
  const home = homeConfig(config);
  const template = homeTemplate(home);
  const defaults = template === "editorial" ? EDITORIAL_DEFAULTS : PORTAL_DEFAULTS;
  const collections = folioCollectionIndexes(config);
  const primary = collections[0];
  const configs = sectionConfigs(home);

  const featuredPaths = new Set<string>();
  for (const section of configs) {
    if (section.type !== "featured") continue;
    const featured = resolveFeatured(section, docs, collections, primary, defaults);
    if (featured) featuredPaths.add(featured.doc.path);
  }

  const sections: FolioHomeSection[] = [];
  for (const section of configs) {
    switch (section.type) {
      case "intro":
        sections.push(resolveIntro(section, config, collections, primary, defaults));
        break;
      case "featured": {
        const featured = resolveFeatured(section, docs, collections, primary, defaults);
        if (featured) sections.push(featured);
        break;
      }
      case "recent":
        sections.push(resolveRecent(section, docs, collections, primary, featuredPaths, defaults));
        break;
      case "collections": {
        const resolved = resolveCollections(section, docs, collections, primary);
        if (resolved) sections.push(resolved);
        break;
      }
      case "about": {
        const resolved = resolveAbout(section, config, docs, defaults);
        if (resolved) sections.push(resolved);
        break;
      }
    }
  }

  const resolvedMeta = home.meta === false
    ? undefined
    : home.meta === undefined
      ? defaults.metaLeft === undefined
        ? undefined
        : { left: defaults.metaLeft, right: defaults.metaRight ?? "" }
      : {
          left: homeText(home.meta.left, defaults.metaLeft ?? "", "meta left"),
          right: homeText(home.meta.right, defaults.metaRight ?? "", "meta right"),
        };
  const meta = resolvedMeta && (resolvedMeta.left || resolvedMeta.right)
    ? resolvedMeta
    : undefined;

  return { template, meta, sections };
}
