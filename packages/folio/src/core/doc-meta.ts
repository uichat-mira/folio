import type { FolioDoc } from "../types";

export type FolioDocMetaField = {
  key: "createdAt" | "updatedAt" | "createdBy" | "updatedBy";
  label: string;
  value: string;
  dateTime?: string;
};

/** Full provenance remains available to consumers, even when the UI is compact. */
export function getFolioDocMeta(
  doc: Pick<FolioDoc, "createdAt" | "updatedAt" | "createdBy" | "updatedBy">,
): FolioDocMetaField[] {
  const items: FolioDocMetaField[] = [];
  const date = (key: "createdAt" | "updatedAt", label: string) => {
    const value = doc[key];
    if (value && !Number.isNaN(Date.parse(value))) {
      items.push({ key, label, value: value.slice(0, 10), dateTime: value });
    }
  };
  const person = (key: "createdBy" | "updatedBy", label: string) => {
    const value = doc[key]?.trim();
    if (value) items.push({ key, label, value });
  };
  date("createdAt", "创建时间");
  date("updatedAt", "更新时间");
  person("createdBy", "创建者");
  person("updatedBy", "修改者");
  return items;
}

export type FolioDocByline = {
  author?: { name: string; initial: string; avatar?: string };
  date?: { value: string; dateTime: string };
  readingMinutes?: number;
};

type BylineDoc = Pick<
  FolioDoc,
  "data" | "createdBy" | "createdAt" | "publishedAt" | "body" | "gitHistory"
>;

function authorFromFrontmatter(value: unknown): { name: string; avatar?: string } | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") {
    const name = first.trim();
    return name ? { name } : undefined;
  }
  if (!first || typeof first !== "object") return undefined;
  const record = first as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) return undefined;
  const rawAvatar = typeof record.avatar === "string" ? record.avatar.trim() : "";
  // Explicit image sources only: never infer a Gravatar/GitHub URL or accept script/data schemes.
  const avatar = /^(https?:\/\/|\/(?!\/))/i.test(rawAvatar) ? rawAvatar : undefined;
  return { name, avatar };
}

function readingMinutes(source: string): number | undefined {
  // Reading time measures prose, not fenced source code or Markdown syntax.
  const prose = source
    .replace(/(^|\n)\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\s*(?:`{3,}|~{3,})[^\n]*(?=\n|$)/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[#>*_|~]/g, " ");
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const chars = prose.match(cjk)?.length ?? 0;
  const words = prose.replace(cjk, " ").match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu)?.length ?? 0;
  if (!chars && !words) return undefined;
  return Math.max(1, Math.ceil(chars / 350 + words / 225));
}

/** Shared, deliberately small author/date/reading-time projection for React and static HTML. */
export function getFolioDocByline(doc: BylineDoc): FolioDocByline | undefined {
  const explicit = authorFromFrontmatter(doc.data?.author);
  const name = explicit?.name ?? doc.createdBy?.trim();
  // GitHub identity belongs to the Git commit author, not to an unrelated
  // editorial byline. An explicit avatar always takes precedence.
  const gitFirst = doc.gitHistory?.first;
  const gitAvatar = gitFirst?.author?.trim() === name ? gitFirst?.githubAvatarUrl : undefined;
  const author = name
    ? { name, initial: Array.from(name)[0].toLocaleUpperCase(), avatar: explicit?.avatar ?? gitAvatar }
    : undefined;
  const rawDate = [doc.publishedAt, doc.createdAt]
    .find((value) => value && !Number.isNaN(Date.parse(value)));
  let date: FolioDocByline["date"];
  if (rawDate) {
    const parsed = new Date(rawDate);
    date = {
      dateTime: rawDate,
      value: `${parsed.getUTCFullYear()} 年 ${parsed.getUTCMonth() + 1} 月 ${parsed.getUTCDate()} 日`,
    };
  }

  // Don't show a lonely reading-time fragment when no article identity is known.
  if (!author && !date) return undefined;
  return { author, date, readingMinutes: readingMinutes(doc.body) };
}
