import type { FolioConfig } from "./types";

export function defineFolioConfig<T extends FolioConfig>(config: T): T {
  return config;
}

export function normalizeBasePath(base = "/"): string {
  if (!base || base === "/") return "/";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}

export function resolveGithubPagesBase(repository?: string): string {
  if (!repository) return "/";
  const [, name = ""] = repository.split("/");
  if (!name || name.endsWith(".github.io")) return "/";
  return normalizeBasePath(name);
}
