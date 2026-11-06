// Build-layer Git history reader for content dates (FOL-025 / Issue #124).
//
// Core parses explicit frontmatter dates; this module adds the values that only
// local Git history can prove. It is deliberately a single bounded read per
// content manifest instead of one `git log` per document, and every Git call
// uses argument arrays (never a shell string) so paths containing spaces or
// non-ASCII characters are safe on every platform.
//
// The emitted timestamps are committer dates normalized to ISO 8601 UTC, so the
// result does not depend on the build machine's timezone. File mtimes and the
// build clock are never used.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { FolioDoc } from "../types";

const GIT_TIMEOUT_MS = 20_000;
// A full-history `--name-status` read is bounded by this buffer; a repository
// large enough to exceed it degrades to "history unavailable" instead of
// failing the build or running one subprocess per document.
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** Earliest and latest commit dates recorded for one content-relative path. */
export type FolioGitPathDates = {
  first?: string;
  last?: string;
};

/** Result of one bounded read of the content directory's Git history. */
export type FolioGitDates = {
  /**
   * `false` when the clone is shallow or the history could not be read. In that
   * case an earliest visible commit is NOT evidence of a first commit, so it is
   * never used as `publishedAt`.
   */
  complete: boolean;
  /** Keyed by content-directory-relative POSIX path. */
  paths: Map<string, FolioGitPathDates>;
};

type GitChange = { status: string; paths: string[] };
type GitCommit = { timestamp: number; changes: GitChange[] };

const warnedRepositories = new Set<string>();

function runGitText(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

function runGitBuffer(cwd: string, args: string[]): Buffer | undefined {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "buffer",
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Canonicalize a path so `path.relative` compares the same form on both sides.
 * Windows may report one side with 8.3 short names (for example
 * `C:\Users\ADMINI~1\...`) and Git with the long form; macOS `/tmp` is a
 * symlink. Without this, a valid history entry can map to "outside content" and
 * be dropped.
 */
function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

/**
 * Parse `git log -z --format=%x1e...%x1f%cI --name-status -M` output.
 * Records are RS-separated, header fields are US-separated and every status /
 * path token is NUL-separated, so spaces, tabs and non-ASCII paths are safe.
 */
export function parseGitHistory(buffer: Buffer): GitCommit[] {
  const commits: GitCommit[] = [];

  for (const record of buffer.toString("utf8").split("\x1e")) {
    if (!record) continue;

    const headerEnd = record.indexOf("\x00");
    if (headerEnd < 0) continue;

    const [sha, committedIso] = record.slice(0, headerEnd).split("\x1f");
    const timestamp = committedIso ? Date.parse(committedIso) : Number.NaN;
    if (!sha || Number.isNaN(timestamp)) continue;

    const tokens = record
      .slice(headerEnd + 1)
      .replace(/^\r?\n/, "")
      .split("\x00")
      .filter(Boolean);
    const changes: GitChange[] = [];

    for (let index = 0; index < tokens.length; ) {
      const status = tokens[index++];
      if (status.startsWith("R") || status.startsWith("C")) {
        const from = tokens[index++];
        const to = tokens[index++];
        if (from && to) changes.push({ status, paths: [from, to] });
      } else {
        const path = tokens[index++];
        if (path) changes.push({ status, paths: [path] });
      }
    }

    commits.push({ timestamp, changes });
  }

  return commits;
}

function warnOnce(repository: string, message: string): void {
  const key = `${repository}\u0000${message}`;
  if (warnedRepositories.has(key)) return;
  warnedRepositories.add(key);
  console.warn(`[folio] ${repository}: ${message}`);
}

/**
 * Read the content directory's history from the local Git repository.
 *
 * Returns `undefined` when the content directory is not inside a Git work tree
 * (or Git is unavailable). A repository must be found via `rev-parse`, so
 * content outside the repository, a missing `git` binary and an untracked tree
 * all degrade to "no trustworthy dates" instead of failing the build.
 */
export function readFolioGitDates(contentDir: string): FolioGitDates | undefined {
  const absoluteContent = canonicalPath(resolve(contentDir));

  // One `rev-parse` call resolves the work tree, shallow state and HEAD. Two
  // bounded subprocesses per manifest (this call plus the log below) keep the
  // overhead independent of the number of documents.
  const info = runGitText(absoluteContent, [
    "rev-parse",
    "--show-toplevel",
    "--is-shallow-repository",
    "--verify",
    "HEAD",
  ]);

  let repositoryRaw: string | undefined;
  let head: string | undefined;
  let shallow: boolean;

  if (info) {
    const lines = info.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    head = lines.pop();
    const shallowLine = lines.pop();
    repositoryRaw = lines.join("\n");
    shallow = shallowLine === "true";
  } else {
    // An unborn repository (no commits yet) makes `--verify HEAD` fail while
    // the work tree itself is valid. Ask only for the repository facts.
    const fallback = runGitText(absoluteContent, [
      "rev-parse",
      "--show-toplevel",
      "--is-shallow-repository",
    ]);
    if (!fallback) return undefined;
    const lines = fallback.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    shallow = lines.pop() === "true";
    repositoryRaw = lines.join("\n");
  }

  if (!repositoryRaw) return undefined;
  const repository = canonicalPath(repositoryRaw);

  const contentRelative = relative(repository, absoluteContent);
  if (contentRelative.startsWith("..") || isAbsolute(contentRelative)) return undefined;
  const pathspec = contentRelative ? toPosix(contentRelative) : ".";

  if (shallow) {
    warnOnce(
      repository,
      "shallow Git clone detected; publishedAt is left unset because the first commit cannot be verified. " +
        "Fetch the full history (for example actions/checkout with fetch-depth: 0) for complete date metadata.",
    );
  }

  // An unborn repository has no history but is not degraded.
  if (!head?.trim()) {
    return { complete: !shallow, paths: new Map() };
  }

  const log = runGitBuffer(repository, [
    "log",
    "--no-color",
    "--no-decorate",
    "-z",
    "--format=%x1e%H%x1f%cI",
    "--name-status",
    "-M",
    "--",
    pathspec,
  ]);
  if (!log) {
    warnOnce(repository, "Git history could not be read; content dates are left unset.");
    return { complete: false, paths: new Map() };
  }

  // `git log` is newest-first; walking oldest-first lets a rename transfer the
  // existing first-commit value and then keep only the latest modification.
  const commits = parseGitHistory(log).reverse();
  const history = new Map<string, FolioGitPathDates>();

  for (const commit of commits) {
    const iso = new Date(commit.timestamp).toISOString();

    for (const change of commit.changes) {
      const status = change.status[0];

      if (status === "R") {
        const [from, to] = change.paths;
        const inherited = history.get(from);
        history.delete(from);
        const entry = history.get(to) ?? { first: iso, last: iso };
        if (inherited?.first) entry.first = inherited.first;
        entry.last = iso;
        history.set(to, entry);
        continue;
      }

      if (status === "C") {
        // A copy starts its own history; it does not inherit the source first
        // commit, because the copied content entered the repository here.
        history.set(change.paths[1], { first: iso, last: iso });
        continue;
      }

      if (status === "D") {
        history.delete(change.paths[0]);
        continue;
      }

      const path = change.paths[0];
      const entry = history.get(path) ?? { first: iso, last: iso };
      entry.first ??= iso;
      entry.last = iso;
      history.set(path, entry);
    }
  }

  const paths = new Map<string, FolioGitPathDates>();
  for (const [path, dates] of history) {
    const key = toPosix(relative(absoluteContent, resolve(repository, path)));
    if (key.startsWith("..") || isAbsolute(key)) continue;
    paths.set(key, dates);
  }

  return { complete: !shallow, paths };
}

/**
 * Fill only the date fields that have no trustworthy explicit source.
 *
 * - `publishedAt` is filled only when the history is complete, so a shallow
 *   clone never presents its earliest visible commit as the first commit.
 * - `updatedAt` may use the latest visible commit even when the clone is
 *   shallow: that commit is genuinely the latest recorded change.
 */
export function applyFolioGitDates(
  doc: FolioDoc,
  git: FolioGitDates | undefined,
): FolioDoc {
  if (!git) return doc;

  const entry = git.paths.get(doc.sourcePath);
  const sources = doc.dateSources ?? {
    publishedAt: "unknown" as const,
    updatedAt: "unknown" as const,
  };

  let publishedAt = doc.publishedAt;
  let updatedAt = doc.updatedAt;
  let publishedAtSource = sources.publishedAt;
  let updatedAtSource = sources.updatedAt;

  if (!publishedAt && git.complete && entry?.first) {
    publishedAt = entry.first;
    publishedAtSource = "git-first-commit";
  }
  if (!updatedAt && entry?.last) {
    updatedAt = entry.last;
    updatedAtSource = "git-last-commit";
  }

  return {
    ...doc,
    publishedAt,
    updatedAt,
    dateSources: {
      publishedAt: publishedAtSource,
      updatedAt: updatedAtSource,
      historyComplete: git.complete,
    },
  };
}
