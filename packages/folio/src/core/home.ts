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
  meta?: {
    left: string;
    right: string;
  };
  sections: FolioHomeSection[];
};

const DEFAULT_META_LEFT = "PERSONAL JOURNAL ✳";
const DEFAULT_META_RIGHT = "READ · COLLECT · REMEMBER";
const DEFAULT_KICKER = "写给生活的零碎记录";
const DEFAULT_FEATURED_LABEL = "FEATURED STORY";
const DEFAULT_READ_LABEL = "开始阅读";
const DEFAULT_RECENT_TITLE = "近期内容";
const DEFAULT_RECENT_LABEL = "01 / READING";
const DEFAULT_EMPTY_MESSAGE = "这里还没有内容。";
const DEFAULT_END_MESSAGE = "更多记录，正在慢慢写下。";
const DEFAULT_ABOUT_LINK = "读读关于小站";
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
  if (!path) return fallback;
  const normalized = normalizeFolioCollectionPath(path);
  return collections.find((collection) => collection.path === normalized);
}

function sourceDocs(
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  path: string | undefined,
  fallback: FolioCollectionIndex | undefined,
): { collection?: FolioCollectionIndex; docs: FolioDoc[] } {
  const collection = collectionForPath(collections, path, fallback);
  if (path) {
    return {
      collection,
      docs: selectFolioCollectionDocs(docs, path),
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
    label: homeText(section.label, DEFAULT_FEATURED_LABEL, "featured label"),
    readLabel: homeText(section.readLabel, DEFAULT_READ_LABEL, "featured readLabel"),
  };
}

function resolveIntro(
  section: FolioHomeIntroSectionConfig,
  config: FolioConfig,
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
): FolioHomeIntroSection {
  const collection = collectionForPath(collections, section.collection, primary);
  return {
    type: "intro",
    title: homeText(section.title, config.title, "intro title"),
    description: homeText(section.description, config.description, "intro description"),
    kicker: homeText(section.kicker, DEFAULT_KICKER, "intro kicker"),
    collection,
  };
}

function resolveRecent(
  section: FolioHomeRecentSectionConfig,
  docs: readonly FolioDoc[],
  collections: FolioCollectionIndex[],
  primary: FolioCollectionIndex | undefined,
  featuredPaths: Set<string>,
): FolioHomeRecentSection {
  const source = sourceDocs(docs, collections, section.collection, primary);
  const available = source.docs.filter((doc) => !featuredPaths.has(doc.path));
  const limit = homeLimit(section.limit, 4, "recent limit");
  return {
    type: "recent",
    docs: available.slice(0, limit),
    collection: source.collection,
    title: homeText(section.title, source.collection?.title ?? DEFAULT_RECENT_TITLE, "recent title"),
    label: homeText(section.label, DEFAULT_RECENT_LABEL, "recent label"),
    emptyMessage: homeText(section.emptyMessage, DEFAULT_EMPTY_MESSAGE, "recent emptyMessage"),
    endMessage: homeText(section.endMessage, DEFAULT_END_MESSAGE, "recent endMessage"),
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
    linkLabel: homeText(section.linkLabel, DEFAULT_ABOUT_LINK, "about linkLabel"),
  };
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
 * static rendering both consume this function so their selection, ordering and
 * links cannot drift. Passing a config without `home` returns the current
 * default editorial model.
 */
export function resolveFolioHome(
  config: FolioConfig,
  docs: readonly FolioDoc[],
): FolioHomeModel {
  const home = homeConfig(config);
  const collections = folioCollectionIndexes(config);
  const primary = collections[0];
  const configs = sectionConfigs(home);

  const featuredPaths = new Set<string>();
  for (const section of configs) {
    if (section.type !== "featured") continue;
    const featured = resolveFeatured(section, docs, collections, primary);
    if (featured) featuredPaths.add(featured.doc.path);
  }

  const sections: FolioHomeSection[] = [];
  for (const section of configs) {
    switch (section.type) {
      case "intro":
        sections.push(resolveIntro(section, config, collections, primary));
        break;
      case "featured": {
        const featured = resolveFeatured(section, docs, collections, primary);
        if (featured) sections.push(featured);
        break;
      }
      case "recent":
        sections.push(resolveRecent(section, docs, collections, primary, featuredPaths));
        break;
      case "collections": {
        const resolved = resolveCollections(section, docs, collections, primary);
        if (resolved) sections.push(resolved);
        break;
      }
      case "about": {
        const resolved = resolveAbout(section, config, docs);
        if (resolved) sections.push(resolved);
        break;
      }
    }
  }

  const meta = home.meta === false
    ? undefined
    : {
        left: homeText(home.meta?.left, DEFAULT_META_LEFT, "meta left"),
        right: homeText(home.meta?.right, DEFAULT_META_RIGHT, "meta right"),
      };

  return { meta, sections };
}
