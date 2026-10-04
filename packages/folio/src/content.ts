import { parse as parseYaml } from "yaml";
import type { FolioDoc, FolioHeading } from "./types";

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
  explicitId?: string;
};

function cleanHeadingText(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/[*_`]/g, "").trim();
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
    candidates.push({
      index: match.index ?? 0,
      depth: match[1].length,
      text: cleanHeadingText(match[2]),
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
      explicitId: idMatch?.[1],
    });
  }

  const seen = new Map<string, number>();
  return candidates
    .filter((candidate) => candidate.text)
    .sort((left, right) => left.index - right.index)
    .map((candidate) => {
      if (candidate.explicitId) {
        const count = seen.get(candidate.explicitId) ?? 0;
        seen.set(candidate.explicitId, count + 1);
        return {
          depth: candidate.depth,
          text: candidate.text,
          id: candidate.explicitId,
        };
      }

      const base = slugify(candidate.text) || "section";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return {
        depth: candidate.depth,
        text: candidate.text,
        id: count === 0 ? base : `${base}-${count + 1}`,
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
    root === "blogs" ? "article" : root === "projects" ? "project" : "doc";

  return {
    id: text(data.id) || slugify(path) || "home",
    path: path.startsWith("/") ? path : `/${path}`,
    sourcePath: sourcePath.replace(/\\/g, "/"),
    type: text(data.type, inferredType),
    title: text(data.title, path),
    description: text(data.description),
    group: text(
      data.group,
      inferredType === "article"
        ? "博客"
        : inferredType === "project"
          ? "项目"
          : "文档",
    ),
    collection: data.collection ? text(data.collection) : undefined,
    section: data.section ? text(data.section) : undefined,
    order: Number(data.order ?? 99),
    date: data.date ? text(data.date) : undefined,
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
