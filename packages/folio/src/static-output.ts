import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

// The static writer owns the single "route -> file" safety invariant: every
// output target is derived from a normalized route, validated lexically, then
// validated against the real filesystem (symlinks / Windows junctions), and
// only then written. Page rendering, document navigation, SEO and sitemap
// content stay in static.ts; nothing here renders HTML.
//
// This module deliberately depends on a structural route shape instead of the
// public FolioStaticRoute type: the page generator imports this module, and a
// type import back from it would make the safety layer depend on the content
// layer it is supposed to guard.

export type FolioStaticOutputRoute = {
  path: string;
  title: string;
};

export function normalizeStaticRoute(path: string): string {
  const normalized = `/${path}`.replace(/\/{2,}/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function routePathError(path: string, outDir: string, reason: string): Error {
  return new Error(
    `folio static route ${JSON.stringify(path)} cannot be written inside outDir ${JSON.stringify(outDir)}: ${reason}`,
  );
}

function outputFileError(name: string, outDir: string, reason: string): Error {
  return new Error(
    `folio static output ${JSON.stringify(name)} cannot be written inside outDir ${JSON.stringify(outDir)}: ${reason}`,
  );
}

// Windows 会静默丢弃路径片段末尾的空格和点，因此 ".. "、"..." 可能被解释为目录上跳。
function isTraversalSegment(segment: string): boolean {
  if (segment === ".") return false;
  const withoutTrailingDotsOrSpaces = segment.replace(/[. ]+$/, "");
  if (withoutTrailingDotsOrSpaces === "..") return true;
  return withoutTrailingDotsOrSpaces === "" && segment.includes(".");
}

// Windows 路径大小写不敏感，比较真实路径前先统一大小写，避免误判越界。
function comparablePath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function isInsideOutDir(root: string, candidate: string): boolean {
  const relativeCandidate = relative(
    comparablePath(root),
    comparablePath(candidate),
  );
  return (
    relativeCandidate !== "" &&
    !isAbsolute(relativeCandidate) &&
    relativeCandidate !== ".." &&
    !relativeCandidate.startsWith(`..${sep}`)
  );
}

// 词法校验只保证字符串不越界；已存在的 symlink / Windows junction 会让后续
// mkdirSync / writeFileSync 实际写到 outDir 之外，因此再按真实路径校验一次。
// 尚不存在的层级由随后的写入新建，不会跟随旧链接。
function assertRealTargetInsideOutDir(
  fail: (reason: string) => Error,
  root: string,
  target: string,
): void {
  if (!existsSync(root)) return;

  const realRoot = realpathSync(root);
  const segments = relative(root, target).split(sep);
  let current = root;

  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);

    let stats;
    try {
      stats = lstatSync(current);
    } catch {
      return;
    }

    if (!stats.isSymbolicLink()) continue;

    if (index === segments.length - 1) {
      throw fail(
        `existing target ${JSON.stringify(current)} is a symbolic link`,
      );
    }

    let linked: string;
    try {
      linked = realpathSync(current);
    } catch {
      throw fail(
        `existing path ${JSON.stringify(current)} is a dangling symbolic link`,
      );
    }

    if (!isInsideOutDir(realRoot, linked)) {
      throw fail(
        `existing path ${JSON.stringify(current)} resolves outside of the output directory to ${JSON.stringify(linked)}`,
      );
    }

    current = linked;
  }
}

// Resolves one relative output file inside outDir, rejecting traversal,
// Windows-ambiguous segments and existing links that point outside outDir.
function resolveStaticTarget(
  fail: (reason: string) => Error,
  root: string,
  relativeTarget: string,
): string {
  for (const segment of relativeTarget.split("/")) {
    if (segment.includes("\\") || segment.includes("\0")) {
      throw fail(
        `path segment ${JSON.stringify(segment)} contains a character that is not valid in a static route`,
      );
    }
    if (isTraversalSegment(segment)) {
      throw fail(
        `path segment ${JSON.stringify(segment)} escapes the output directory`,
      );
    }
  }

  const target = resolve(root, relativeTarget);
  const relativeTargetPath = relative(root, target);
  if (
    !relativeTargetPath ||
    isAbsolute(relativeTargetPath) ||
    relativeTargetPath === ".." ||
    relativeTargetPath.startsWith(`..${sep}`)
  ) {
    throw fail(
      `resolved output ${JSON.stringify(target)} is outside of the output directory`,
    );
  }

  assertRealTargetInsideOutDir(fail, root, target);
  return target;
}

function routeOutputTarget(
  path: string,
  route: string,
  root: string,
): string {
  const relativeTarget =
    route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
  return resolveStaticTarget(
    (reason) => routePathError(path, root, reason),
    root,
    relativeTarget,
  );
}

// Validates every route destination before writing any of them, rejects
// normalized-route and real-target collisions, then writes the rendered pages.
// Returns the normalized routes so the caller can build sitemap content from
// exactly the routes that were written.
export function writeFolioStaticOutputs<T extends FolioStaticOutputRoute>(
  outDir: string,
  routes: readonly T[],
  render: (route: T) => string,
): T[] {
  const root = resolve(outDir);

  // Reject route collisions before any output: a Map used to silently
  // overwrite the first page when two paths normalized to the same key.
  const seen = new Map<string, T>();
  const normalizedRoutes = routes.map((route) => {
    const path = normalizeStaticRoute(route.path);
    const previous = seen.get(path);
    if (previous) {
      throw new Error(
        `folio static route conflict: ${JSON.stringify(previous.path)} (${JSON.stringify(previous.title)}) and ${JSON.stringify(route.path)} (${JSON.stringify(route.title)}) both normalize to ${JSON.stringify(path)}`,
      );
    }
    seen.set(path, route);
    return { ...route, path };
  });

  // Validate all destinations before writing, avoiding partial output for
  // either duplicate routes or invalid filesystem paths.
  const outputs = normalizedRoutes.map((route, index) => ({
    route,
    source: routes[index],
    target: routeOutputTarget(routes[index].path, route.path, root),
  }));

  // Different URL strings can still resolve to the same file (e.g. /guide
  // and /guide/.). Compare actual destinations, including Windows case folding.
  const seenTargets = new Map<string, T>();
  for (const { source, target } of outputs) {
    const key = comparablePath(target);
    const previous = seenTargets.get(key);
    if (previous) {
      throw new Error(
        `folio static route conflict: ${JSON.stringify(previous.path)} (${JSON.stringify(previous.title)}) and ${JSON.stringify(source.path)} (${JSON.stringify(source.title)}) both write to ${JSON.stringify(target)}`,
      );
    }
    seenTargets.set(key, source);
  }

  for (const { route, target } of outputs) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, render(route), "utf8");
  }

  return normalizedRoutes;
}

// Fixed-name outputs (404.html, sitemap.xml, robots.txt) use the same target
// validation as routes so they cannot be redirected outside outDir through an
// existing symlink either.
export function writeFolioStaticRootFile(
  outDir: string,
  name: string,
  content: string,
): void {
  const root = resolve(outDir);
  const target = resolveStaticTarget(
    (reason) => outputFileError(name, root, reason),
    root,
    name,
  );
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}
