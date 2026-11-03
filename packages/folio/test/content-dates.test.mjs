import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFolioDoc } from "../dist/index.js";
import { folio } from "../dist/vite.js";

// FOL-025 (Issue #124): build-time Git dates plus independent frontmatter
// overrides. Every assertion below comes from a real temporary Git repository
// and the real built plugin entry, never from a mocked history.

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = [];

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Committer timestamps used by the fixtures. Both offsets deliberately differ
// from UTC so a timezone-dependent formatter would change the expected values.
const FIRST_COMMIT = "2024-01-02T03:04:05+08:00"; // -> 2024-01-01T19:04:05.000Z
const SECOND_COMMIT = "2024-02-03T04:05:06-07:00"; // -> 2024-02-03T11:05:06.000Z
const THIRD_COMMIT = "2024-03-04T05:06:07+00:00"; // -> 2024-03-04T05:06:07.000Z

function temporaryDirectory(prefix = "folio-dates-") {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function git(cwd, args, env = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed:\n${result.stderr ?? ""}`,
  );
  return result.stdout.trim();
}

function createRepository() {
  const root = temporaryDirectory();
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Folio Date Test"]);
  git(root, ["config", "user.email", "folio-dates@example.test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["config", "core.autocrlf", "false"]);
  return root;
}

function writeDoc(root, sourcePath, source) {
  const file = resolve(root, "content", sourcePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source, "utf8");
}

function commit(root, message, committedAt) {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", message], {
    GIT_AUTHOR_DATE: committedAt,
    GIT_COMMITTER_DATE: committedAt,
  });
}

// Drive the real built plugin entry. `folio()` captures `process.cwd()`, which
// is exactly how the Vite adapter is used in a real app.
function loadDocs(root, contentDir = "content") {
  const previous = process.cwd();
  process.chdir(root);
  try {
    const plugin = folio({
      config: { title: "Dates", description: "Dates" },
      contentDir,
      staticRoutes: false,
    });
    const resolved = plugin.resolveId("virtual:folio/content");
    assert.ok(resolved, "the plugin did not resolve virtual:folio/content");
    const source = plugin.load(resolved);
    assert.equal(typeof source, "string", "the plugin did not load the virtual module");
    const match = source.match(/^const docs = ([\s\S]*?);\nexport const roots = /m);
    assert.ok(match, "the virtual module kept its docs/roots shape");
    return JSON.parse(match[1]);
  } finally {
    process.chdir(previous);
  }
}

function bySourcePath(docs, sourcePath) {
  const doc = docs.find((candidate) => candidate.sourcePath === sourcePath);
  assert.ok(doc, `${sourcePath} was not discovered`);
  return doc;
}

test("Git history fills publishedAt/updatedAt from committer dates in UTC", () => {
  const root = createRepository();
  writeDoc(root, "docs/article.md", "---\ntitle: Article\n---\nfirst\n");
  commit(root, "first", FIRST_COMMIT);
  writeDoc(root, "docs/article.md", "---\ntitle: Article\n---\nsecond\n");
  commit(root, "second", SECOND_COMMIT);

  const doc = bySourcePath(loadDocs(root), "docs/article.md");
  assert.equal(doc.publishedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(doc.updatedAt, "2024-02-03T11:05:06.000Z");
  assert.deepEqual(doc.dateSources, {
    publishedAt: "git-first-commit",
    updatedAt: "git-last-commit",
    historyComplete: true,
  });
});

test("renames and non-ASCII paths keep the first commit date", () => {
  const root = createRepository();
  writeDoc(root, "docs/old name.md", "---\ntitle: Moved\n---\nfirst\n");
  commit(root, "create", FIRST_COMMIT);

  mkdirSync(resolve(root, "content", "中文 目录"), { recursive: true });
  git(root, ["mv", "content/docs/old name.md", "content/中文 目录/新 文件.md"]);
  writeDoc(root, "中文 目录/新 文件.md", "---\ntitle: Moved\n---\nrenamed\n");
  commit(root, "rename", SECOND_COMMIT);

  writeDoc(root, "中文 目录/新 文件.md", "---\ntitle: Moved\n---\nupdated\n");
  commit(root, "update", THIRD_COMMIT);

  const doc = bySourcePath(loadDocs(root), "中文 目录/新 文件.md");
  assert.equal(doc.publishedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(doc.updatedAt, "2024-03-04T05:06:07.000Z");
  assert.equal(doc.dateSources.publishedAt, "git-first-commit");
  assert.equal(doc.dateSources.updatedAt, "git-last-commit");
});

test("explicit publishedAt and updatedAt override independently", () => {
  const root = createRepository();

  const sources = {
    "docs/both.md":
      "---\ntitle: Both\npublishedAt: 2025-01-02T03:04:05+08:00\nupdatedAt: 2025-02-03T04:05:06Z\n---\nbody\n",
    "docs/published-only.md":
      "---\ntitle: Published\npublishedAt: 2025-03-04\n---\nbody\n",
    "docs/updated-only.md":
      "---\ntitle: Updated\nupdatedAt: 2025-04-05T06:07:08-07:00\n---\nbody\n",
    "docs/invalid.md":
      "---\ntitle: Invalid\npublishedAt: 2024-05-06 07:08\nupdatedAt: not-a-date\n---\nbody\n",
    "docs/impossible.md":
      "---\ntitle: Impossible\npublishedAt: 2024-02-30\n---\nbody\n",
  };
  for (const [sourcePath, source] of Object.entries(sources)) {
    writeDoc(root, sourcePath, source);
  }
  commit(root, "create", FIRST_COMMIT);
  // Modify the body only, so every explicit override survives into the file the
  // build actually parses.
  for (const [sourcePath, source] of Object.entries(sources)) {
    writeDoc(root, sourcePath, source.replace(/\nbody\n/, "\nchanged\n"));
  }
  commit(root, "modify", SECOND_COMMIT);

  const docs = loadDocs(root);
  const both = bySourcePath(docs, "docs/both.md");
  assert.equal(both.publishedAt, "2025-01-01T19:04:05.000Z");
  assert.equal(both.updatedAt, "2025-02-03T04:05:06.000Z");
  assert.equal(both.dateSources.publishedAt, "frontmatter");
  assert.equal(both.dateSources.updatedAt, "frontmatter");

  const publishedOnly = bySourcePath(docs, "docs/published-only.md");
  assert.equal(publishedOnly.publishedAt, "2025-03-04T00:00:00.000Z");
  assert.equal(publishedOnly.dateSources.publishedAt, "frontmatter");
  assert.equal(publishedOnly.updatedAt, "2024-02-03T11:05:06.000Z");
  assert.equal(publishedOnly.dateSources.updatedAt, "git-last-commit");

  const updatedOnly = bySourcePath(docs, "docs/updated-only.md");
  assert.equal(updatedOnly.publishedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(updatedOnly.dateSources.publishedAt, "git-first-commit");
  assert.equal(updatedOnly.updatedAt, "2025-04-05T13:07:08.000Z");
  assert.equal(updatedOnly.dateSources.updatedAt, "frontmatter");

  // A date-time without an offset (or an unparseable value) is not an
  // "effective explicit value"; Git fills it instead of inventing a timezone.
  const invalid = bySourcePath(docs, "docs/invalid.md");
  assert.equal(invalid.publishedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(invalid.dateSources.publishedAt, "git-first-commit");
  assert.equal(invalid.updatedAt, "2024-02-03T11:05:06.000Z");
  assert.equal(invalid.dateSources.updatedAt, "git-last-commit");

  const impossible = bySourcePath(docs, "docs/impossible.md");
  assert.equal(impossible.publishedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(impossible.dateSources.publishedAt, "git-first-commit");
});

test("an unborn repository is valid and has no history dates", () => {
  const root = createRepository();
  writeDoc(root, "docs/unborn.md", "---\ntitle: Unborn\n---\nbody\n");

  const doc = bySourcePath(loadDocs(root), "docs/unborn.md");
  assert.equal(doc.publishedAt, undefined);
  assert.equal(doc.updatedAt, undefined);
  assert.deepEqual(doc.dateSources, {
    publishedAt: "unknown",
    updatedAt: "unknown",
    historyComplete: true,
  });
});

test("legacy date feeds publishedAt without changing the legacy field", () => {
  const root = createRepository();
  writeDoc(
    root,
    "docs/legacy.md",
    "---\ntitle: Legacy\ndate: 2023-05-06\n---\nbody\n",
  );
  commit(root, "create", FIRST_COMMIT);
  writeDoc(
    root,
    "docs/legacy.md",
    "---\ntitle: Legacy\ndate: 2023-05-06\n---\nbody changed\n",
  );
  commit(root, "modify", SECOND_COMMIT);

  const doc = bySourcePath(loadDocs(root), "docs/legacy.md");
  assert.equal(doc.date, "2023-05-06", "legacy display field must stay verbatim");
  assert.equal(doc.publishedAt, "2023-05-06T00:00:00.000Z");
  assert.equal(doc.dateSources.publishedAt, "legacy-date");
  assert.equal(doc.updatedAt, "2024-02-03T11:05:06.000Z");
  assert.equal(doc.dateSources.updatedAt, "git-last-commit");
});

test("untracked and uncommitted content never fabricates a date", () => {
  const root = createRepository();
  writeDoc(root, "docs/tracked.md", "---\ntitle: Tracked\n---\nbody\n");
  commit(root, "create", FIRST_COMMIT);

  // Tracked but modified after the last commit: the last committed change is
  // still the only trustworthy value (mtimes are intentionally ignored).
  writeDoc(root, "docs/tracked.md", "---\ntitle: Tracked\n---\nuncommitted\n");
  // New file that has never been committed.
  writeDoc(root, "docs/untracked.md", "---\ntitle: Untracked\n---\nbody\n");

  const docs = loadDocs(root);
  const tracked = bySourcePath(docs, "docs/tracked.md");
  assert.equal(tracked.updatedAt, "2024-01-01T19:04:05.000Z");
  assert.equal(tracked.dateSources.updatedAt, "git-last-commit");

  const untracked = bySourcePath(docs, "docs/untracked.md");
  assert.equal(untracked.publishedAt, undefined);
  assert.equal(untracked.updatedAt, undefined);
  assert.deepEqual(untracked.dateSources, {
    publishedAt: "unknown",
    updatedAt: "unknown",
    historyComplete: true,
  });
});

test("content outside any Git repository builds with unknown dates", () => {
  const root = temporaryDirectory("folio-no-git-");
  writeDoc(root, "docs/plain.md", "---\ntitle: Plain\n---\nbody\n");

  const doc = bySourcePath(loadDocs(root), "docs/plain.md");
  assert.equal(doc.publishedAt, undefined);
  assert.equal(doc.updatedAt, undefined);
  assert.deepEqual(doc.dateSources, {
    publishedAt: "unknown",
    updatedAt: "unknown",
  });
});

test("a shallow clone never presents its earliest visible commit as first", () => {
  const source = createRepository();
  writeDoc(source, "docs/shallow.md", "---\ntitle: Shallow\n---\none\n");
  commit(source, "one", FIRST_COMMIT);
  writeDoc(source, "docs/shallow.md", "---\ntitle: Shallow\n---\ntwo\n");
  commit(source, "two", SECOND_COMMIT);
  writeDoc(source, "docs/shallow.md", "---\ntitle: Shallow\n---\nthree\n");
  commit(source, "three", THIRD_COMMIT);

  const cloneParent = temporaryDirectory("folio-shallow-");
  const clone = resolve(cloneParent, "clone");
  const url = pathToFileURL(source).href;
  git(cloneParent, ["clone", "-q", "--depth", "1", url, clone]);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values.join(" "));
  let docs;
  try {
    docs = loadDocs(clone);
  } finally {
    console.warn = originalWarn;
  }

  const doc = bySourcePath(docs, "docs/shallow.md");
  // The latest commit is genuinely the latest recorded change and stays usable.
  assert.equal(doc.updatedAt, "2024-03-04T05:06:07.000Z");
  assert.equal(doc.dateSources.updatedAt, "git-last-commit");
  // The earliest visible commit is NOT proof of the first commit.
  assert.equal(doc.publishedAt, undefined);
  assert.equal(doc.dateSources.publishedAt, "unknown");
  assert.equal(doc.dateSources.historyComplete, false);
  assert.match(warnings.join("\n"), /shallow Git clone/i);
  assert.match(warnings.join("\n"), /fetch-depth: 0/);
});

test("a missing Git executable degrades to unknown dates instead of failing", () => {
  const root = temporaryDirectory("folio-no-git-binary-");
  writeDoc(root, "docs/offline.md", "---\ntitle: Offline\n---\nbody\n");

  const probe = resolve(root, "probe.mjs");
  writeFileSync(
    probe,
    [
      'import { pathToFileURL } from "node:url";',
      `const { folio } = await import(${JSON.stringify(
        pathToFileURL(resolve(packageRoot, "dist/vite.js")).href,
      )});`,
      "process.chdir(process.argv[2]);",
      'const plugin = folio({ config: { title: "No Git", description: "No Git" }, contentDir: "content", staticRoutes: false });',
      'const source = plugin.load("\\0virtual:folio/content");',
      "const docs = JSON.parse(source.match(/^const docs = ([\\s\\S]*?);\\nexport const roots = /m)[1]);",
      "console.log(JSON.stringify(docs));",
    ].join("\n"),
    "utf8",
  );

  // An empty PATH makes `git` unresolvable while the absolute Node executable
  // still starts, which is the "no Git environment" case.
  const result = spawnSync(process.execPath, [probe, root], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: "", Path: "" },
  });
  assert.equal(
    result.status,
    0,
    `the build failed without Git:\n${result.stderr ?? ""}`,
  );
  const docs = JSON.parse(result.stdout.trim());
  const doc = bySourcePath(docs, "docs/offline.md");
  assert.equal(doc.publishedAt, undefined);
  assert.equal(doc.updatedAt, undefined);
  assert.equal(doc.dateSources.publishedAt, "unknown");
  assert.equal(doc.dateSources.updatedAt, "unknown");
});

test("parseFolioDoc and the Build layer express the same explicit dates", () => {
  const source = "---\ntitle: Shared\npublishedAt: 2025-01-02T03:04:05+08:00\nupdatedAt: 2025-02-03\n---\nbody\n";
  const core = parseFolioDoc("docs/shared.md", source);

  const root = createRepository();
  writeDoc(root, "docs/shared.md", source);
  commit(root, "create", FIRST_COMMIT);
  const build = bySourcePath(loadDocs(root), "docs/shared.md");

  assert.equal(core.publishedAt, build.publishedAt);
  assert.equal(core.updatedAt, build.updatedAt);
  assert.equal(core.dateSources.publishedAt, build.dateSources.publishedAt);
  assert.equal(core.dateSources.updatedAt, build.dateSources.updatedAt);
  assert.equal(build.dateSources.historyComplete, true);
});

test("the build does not use file mtimes as dates", () => {
  const root = createRepository();
  writeDoc(root, "docs/mtime.md", "---\ntitle: Mtime\n---\nbody\n");
  commit(root, "create", FIRST_COMMIT);

  // A much newer mtime must not leak into the metadata.
  const file = resolve(root, "content", "docs/mtime.md");
  const future = new Date("2030-12-31T23:59:59Z");
  writeFileSync(file, readFileSync(file, "utf8"), { encoding: "utf8" });
  utimesSync(file, future, future);

  const doc = bySourcePath(loadDocs(root), "docs/mtime.md");
  assert.equal(doc.updatedAt, "2024-01-01T19:04:05.000Z");
  assert.notEqual(doc.updatedAt, future.toISOString());
});
