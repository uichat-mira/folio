import { parse as parseYaml } from "yaml";
import { marked } from "marked";
import type { FolioDateSource, FolioDoc, FolioHeading } from "../types";
import { createHeadingIdAllocator } from "./heading-ids";
import { normalizeFolioDate } from "./dates";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function slugify(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseLooseFrontmatter(source: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let currentKey = "";

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey) {
      const current = data[currentKey];
      const next = listItem[1].trim();
      data[currentKey] = Array.isArray(current)
        ? [...current, next]
        : current == null || current === ""
          ? [next]
          : [String(current), next];
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim();
    if (!key) continue;

    currentKey = key;
    data[key] = line.slice(separator + 1).trim();
  }

  return data;
}

export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(FRONTMATTER);
  if (!match) return { data: {}, body: raw };

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch {
    parsed = parseLooseFrontmatter(match[1]);
  }

  return {
    data:
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {},
    body: match[2],
  };
}

type HeadingCandidate = {
  index: number;
  depth: number;
  text: string;
  idBase: string;
  explicitId?: string;
};

function cleanHeadingText(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(?:x[0-9a-f]+|[0-9]+));/gi, (entity) => {
      const name = entity.slice(1, -1).toLowerCase();
      if (!name.startsWith("#")) return entities[name] ?? entity;
      const hex = name.startsWith("#x");
      const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/[*_`]/g, "")
    .trim();
}

function withoutFencedCode(source: string): string {
  let fenceCharacter = "";
  let fenceLength = 0;

  return source
    .split(/\r?\n/)
    .map((line) => {
      if (!fenceCharacter) {
        const opening = line.match(/^\s*(`{3,}|~{3,})/);
        if (!opening) return line;
        fenceCharacter = opening[1][0];
        fenceLength = opening[1].length;
        return "";
      }

      const closing = line.match(/^\s*(`+|~+)\s*$/);
      if (
        closing &&
        closing[1][0] === fenceCharacter &&
        closing[1].length >= fenceLength
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      return "";
    })
    .join("\n");
}

export function extractHeadings(body: string): FolioHeading[] {
  const candidates: HeadingCandidate[] = [];
  const source = withoutFencedCode(body);

  for (const match of source.matchAll(/^(#{2,4})\s+(.+)$/gm)) {
    // The Markdown renderer assigns IDs from Marked's HTML, not raw Markdown.
    // Reuse that input here to avoid links and entities producing different slugs.
    const inlineHtml = marked.parseInline(match[2], { gfm: true }) as string;
    candidates.push({
      index: match.index ?? 0,
      depth: match[1].length,
      text: cleanHeadingText(inlineHtml),
      idBase: slugify(inlineHtml),
    });
  }

  for (const match of source.matchAll(
    /<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
  )) {
    const idMatch = match[2].match(/\bid\s*=\s*["']([^"']+)["']/i);
    candidates.push({
      index: match.index ?? 0,
      depth: Number(match[1]),
      text: cleanHeadingText(match[3]),
      idBase: slugify(match[3]),
      explicitId: idMatch?.[1],
    });
  }

  const orderedCandidates = candidates
    .filter((candidate) => candidate.text)
    .sort((left, right) => left.index - right.index);
  const headingIds = createHeadingIdAllocator(
    orderedCandidates.flatMap((candidate) =>
      candidate.explicitId ? [candidate.explicitId] : [],
    ),
  );

  return orderedCandidates.map((candidate) => {
    if (candidate.explicitId) {
      return {
        depth: candidate.depth,
        text: candidate.text,
        id: headingIds.useExplicit(candidate.explicitId),
      };
    }

    const base = candidate.idBase || "section";
    return {
      depth: candidate.depth,
      text: candidate.text,
      id: headingIds.allocate(base),
    };
  });
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[|,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function text(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

/**
 * A single optional scalar field. Only a non-empty string is a valid value:
 * arrays, objects, numbers and booleans are an invalid shape and resolve to
 * "unset" deterministically instead of being stringified into a guessed label.
 */
function singleText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function sourcePathToRoute(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const withoutExt = normalized.replace(/\.md$/i, "");
  const withoutIndex = withoutExt.replace(/\/index$/i, "");
  return `/${withoutIndex}`.replace(/\/{2,}/g, "/") || "/";
}

export function parseFolioDoc(sourcePath: string, raw: string): FolioDoc {
  const { data, body } = parseFrontmatter(raw);
  const path = text(data.path) || sourcePathToRoute(sourcePath);
  const root = sourcePath.split(/[\\/]/)[0];
  const inferredType =
    root === "blogs" ? "article" : "doc";

  // Priority is frozen here and completed by the Build layer:
  //   explicit publishedAt > valid legacy date > Git first commit > unknown
  // Explicit updatedAt > Git last commit > unknown.
  // Invalid explicit values are not "explicit" for priority purposes: they are
  // ignored so a trustworthy lower-priority source can still fill the field.
  const explicitPublishedAt = normalizeFolioDate(data.publishedAt);
  const legacyPublishedAt = normalizeFolioDate(data.date);
  const explicitUpdatedAt = normalizeFolioDate(data.updatedAt);
  const explicitCreatedAt = normalizeFolioDate(data.createdAt);
  const explicitPerson = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  const publishedAt = explicitPublishedAt ?? legacyPublishedAt;
  const publishedAtSource: FolioDateSource = explicitPublishedAt
    ? "frontmatter"
    : legacyPublishedAt
      ? "legacy-date"
      : "unknown";
  const updatedAtSource: FolioDateSource = explicitUpdatedAt
    ? "frontmatter"
    : "unknown";

  return {
    id: text(data.id) || slugify(path) || "home",
    path: path.startsWith("/") ? path : `/${path}`,
    sourcePath: sourcePath.replace(/\\/g, "/"),
    type: text(data.type, inferredType),
    title: text(data.title, path),
    description: text(data.description),
    group: text(
      data.group,
      inferredType === "article" ? "博客" : "文档",
    ),
    collection: data.collection ? text(data.collection) : undefined,
    section: data.section ? text(data.section) : undefined,
    order: Number(data.order ?? 99),
    date: data.date ? text(data.date) : undefined,
    publishedAt,
    createdAt: explicitCreatedAt,
    updatedAt: explicitUpdatedAt,
    createdBy: explicitPerson(data.createdBy),
    updatedBy: explicitPerson(data.updatedBy),
    dateSources: {
      publishedAt: publishedAtSource,
      updatedAt: updatedAtSource,
    },
    category: singleText(data.category),
    tags: list(data.tags),
    status: data.status ? text(data.status) : undefined,
    cover: data.cover ? text(data.cover) : undefined,
    body,
    headings: extractHeadings(body),
    data,
  };
}

export function compareFolioDocs(a: FolioDoc, b: FolioDoc): number {
  if (a.type === "article" && b.type === "article") {
    return (
      String(b.date ?? "").localeCompare(String(a.date ?? "")) ||
      a.order - b.order
    );
  }
  return a.order - b.order || a.path.localeCompare(b.path);
}
