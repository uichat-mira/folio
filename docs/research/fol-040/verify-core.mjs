#!/usr/bin/env node
// FOL-040 (#162) independent verification harness for the Article archive Core
// contract. This harness does NOT use the implementer's test files. It exercises
// the public built package (`packages/folio/dist/index.js`) and a real npm
// tarball consumer outside the repository.
//
// Chains proved here:
//   1. real Markdown -> parseFrontmatter/parseFolioDoc -> FolioDoc -> archive index
//      (all 45 files of the official site, plus purpose-built edge fixtures);
//   2. archive index -> deterministic ids/slugs/titles/ordering/conflict errors;
//   3. schema (schemas/content.schema.json, validated with ajv 2020) <-> parser;
//   4. React/DOM-free Core evidence: source import graph + esbuild metafile;
//   5. built package -> npm pack -> install into a throwaway consumer outside
//      this repository -> import the public entry + tsc declaration check.
//
// Usage:
//   node docs/research/fol-040/verify-core.mjs [--skip-build] [--skip-consumer] [--keep]
//
// Exit code 0 means every executed check passed. Results are written to
// results/acceptance.json for every run, including failures.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const resultsDir = join(scriptDir, "results");
const packageRoot = join(repoRoot, "packages", "folio");
const siteContentDir = join(repoRoot, "apps", "site", "content");
const argv = process.argv.slice(2);
const skipBuild = argv.includes("--skip-build");
const skipConsumer = argv.includes("--skip-consumer");
const keepTemp = argv.includes("--keep");

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

const results = {
  meta: {
    generatedAt: new Date().toISOString(),
    harness: "docs/research/fol-040/verify-core.mjs",
    purpose: "FOL-040 (#162) independent verification of the Article category/tag archive Core contract",
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    commit: git(["rev-parse", "HEAD"]),
    shortCommit: git(["rev-parse", "--short", "HEAD"]),
    dirtyWorkingTree: git(["status", "--porcelain"]) !== "",
    packagedSourcesDirty: git([
      "status",
      "--porcelain",
      "--",
      "packages",
      "apps/site",
      "schemas",
      "scripts",
    ]),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    package: readPackageManifest(),
    siteContentFiles: countMarkdown(siteContentDir),
    commands: [],
  },
  stages: [],
  checks: [],
  tarball: {},
  consumer: {},
  summary: { status: "failed", total: 0, passed: 0, failed: 0 },
};

const tempRoots = [];
let currentStage;

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60_000,
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

function readPackageManifest() {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  return { name: manifest.name, version: manifest.version, main: manifest.main, types: manifest.types };
}

function countMarkdown(root) {
  let count = 0;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) count += 1;
    }
  };
  walk(root);
  return count;
}

function listMarkdown(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

function posix(path) {
  return path.replace(/\\/g, "/");
}

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

function npmEnv() {
  return {
    ...process.env,
    npm_config_cache: join(repoRoot, ".npm-cache"),
    npm_config_logs_dir: join(repoRoot, ".npm-logs"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
}

function recordCommand(command, result, extra = {}) {
  results.meta.commands.push({
    command,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    ...extra,
  });
}

function runNpm(args, options = {}) {
  const result = spawnSync(npmCommand, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    timeout: options.timeout ?? 600_000,
    shell: isWindows,
    env: npmEnv(),
  });
  recordCommand(
    `npm ${args.join(" ")} (cwd: ${posix(relative(repoRoot, options.cwd ?? repoRoot)) || "."})`,
    result,
  );
  if (result.error) throw new Error(`${args[0]} could not start: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `npm ${args.join(" ")} failed with status ${result.status}\n` +
        `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
        `--- stderr ---\n${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}

function describe(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

const stageTimers = new Map();

function stage(id) {
  currentStage = { id, status: "running", ms: 0 };
  results.stages.push(currentStage);
  stageTimers.set(id, process.hrtime.bigint());
}

function endStage() {
  if (!currentStage) return;
  const started = stageTimers.get(currentStage.id);
  currentStage.ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
  currentStage.status = "passed";
  currentStage = undefined;
}

function check(id, fn) {
  const started = process.hrtime.bigint();
  try {
    const detail = fn();
    results.checks.push({
      id,
      stage: results.stages.at(-1)?.id,
      status: "passed",
      ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      detail: detail === undefined ? undefined : describe(detail),
    });
    return detail;
  } catch (error) {
    results.checks.push({
      id,
      stage: results.stages.at(-1)?.id,
      status: "failed",
      ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      detail: error?.message ?? String(error),
    });
    throw error;
  }
}

function stableSortBySlug(groups) {
  return [...groups].sort((left, right) => (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
}

function groupSummary(group) {
  return {
    kind: group.kind,
    id: group.id,
    slug: group.slug,
    title: group.title,
    docs: group.docs.map((doc) => ({ path: doc.path, type: doc.type, date: doc.date ?? null, order: doc.order })),
  };
}

function indexSummary(index) {
  return {
    categories: index.categories.map(groupSummary),
    tags: index.tags.map(groupSummary),
    uncategorized: index.uncategorized.map((doc) => doc.path),
    untagged: index.untagged.map((doc) => doc.path),
  };
}

function writeFixture(root, relativePath, frontmatter, body = "## Body\n\nFixture body.\n") {
  const target = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `---\n${frontmatter.trim()}\n---\n\n${body}`);
  return target;
}

function readInstalledPackageManifest(consumerDir, name) {
  return JSON.parse(
    readFileSync(join(consumerDir, "node_modules", ...name.split("/"), "package.json"), "utf8"),
  );
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseAllMarkdown(api, root) {
  return listMarkdown(root).map((absolute) => {
    const sourcePath = posix(relative(root, absolute));
    const raw = readFileSync(absolute, "utf8");
    return { sourcePath, raw, doc: api.parseFolioDoc(sourcePath, raw) };
  });
}

// ---------------------------------------------------------------------------
// Stage 1: package build and public entry
// ---------------------------------------------------------------------------
function stageBuild() {
  stage("package-build-and-public-entry");
  if (skipBuild) {
    results.meta.commands.push({ command: "npm run build -w @uichat-mira/folio", status: "skipped", exitCode: null });
  } else {
    runNpm(["run", "build", "-w", "@uichat-mira/folio"]);
  }
  check("dist-entry-exists", () => {
    assert.ok(existsSync(join(packageRoot, "dist", "index.js")), "dist/index.js is missing");
    return "packages/folio/dist/index.js present";
  });
  endStage();
}

// ---------------------------------------------------------------------------
// Stage 2: real site content -> parser -> archive index (new/old compatibility)
// ---------------------------------------------------------------------------
function stageRealContent(api) {
  stage("real-content-chain");

  const parsed = check("real-content-parses-through-public-parser", () => {
    const documents = parseAllMarkdown(api, siteContentDir);
    assert.ok(documents.length >= 45, `expected at least 45 real content files, found ${documents.length}`);
    for (const { sourcePath, raw, doc } of documents) {
      const { body } = api.parseFrontmatter(raw);
      assert.equal(doc.body, body, `parseFolioDoc body differs from parseFrontmatter for ${sourcePath}`);
      assert.equal(doc.sourcePath, sourcePath.replace(/\\/g, "/"), `sourcePath changed for ${sourcePath}`);
    }
    return {
      files: documents.length,
      byType: documents.reduce((counts, { doc }) => {
        counts[doc.type] = (counts[doc.type] ?? 0) + 1;
        return counts;
      }, {}),
    };
  });

  const documents = parseAllMarkdown(api, siteContentDir);

  check("old-content-category-is-unset-everywhere", () => {
    const withCategory = documents.filter(({ doc }) => doc.category !== undefined);
    assert.equal(withCategory.length, 0, `old content unexpectedly gained a category: ${withCategory.map((entry) => entry.sourcePath)}`);
    return "45/45 existing site documents keep category === undefined";
  });

  check("old-content-tags-parse-exactly-as-before", () => {
    // Independent expectation: frontmatter array -> trimmed strings; legacy
    // string form -> split on |, comma or full-width comma. This is the same
    // documented contract the parser had before FOL-040.
    const expectedTags = (value) => {
      if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
      if (typeof value !== "string" || !value.trim()) return [];
      return value.split(/[|,，]/).map((item) => item.trim()).filter(Boolean);
    };
    const mismatches = [];
    for (const { sourcePath, raw, doc } of documents) {
      const { data } = api.parseFrontmatter(raw);
      const expected = expectedTags(data.tags);
      if (JSON.stringify(expected) !== JSON.stringify(doc.tags)) {
        mismatches.push({ sourcePath, expected, actual: doc.tags });
      }
    }
    assert.deepEqual(mismatches, [], "tag parsing changed for existing content");
    return { documents: documents.length, tagLists: documents.reduce((sum, { doc }) => sum + doc.tags.length, 0) };
  });

  check("old-content-paths-and-ids-unchanged", () => {
    const mismatches = [];
    for (const { sourcePath, raw, doc } of documents) {
      const { data } = api.parseFrontmatter(raw);
      const expectedPath = data.path ? String(data.path) : api.sourcePathToRoute(sourcePath);
      if (doc.path !== expectedPath) mismatches.push({ sourcePath, expectedPath, actualPath: doc.path });
      if (data.id) {
        if (doc.id !== String(data.id)) mismatches.push({ sourcePath, expectedId: String(data.id), actualId: doc.id });
      } else {
        const expectedId = api.slugify(doc.path) || "home";
        if (doc.id !== expectedId) mismatches.push({ sourcePath, expectedId, actualId: doc.id });
      }
    }
    assert.deepEqual(mismatches, [], "existing content routes or ids changed");
    return "every existing document keeps its independently derived route and id";
  });

  check("old-content-search-behavior-unchanged", () => {
    const allDocs = documents.map(({ doc }) => doc);
    // Search is documented to include tags. Every existing tag must still find
    // its own Article; the known Chinese Article title must still be found.
    const missed = [];
    for (const { doc } of documents) {
      for (const tag of doc.tags) {
        const hits = api.searchFolioDocs(allDocs, tag, 50);
        if (!hits.some((hit) => hit.path === doc.path)) missed.push({ path: doc.path, tag });
      }
    }
    assert.deepEqual(missed, [], "search no longer finds documents by tag");
    const chinese = api.searchFolioDocs(allDocs, "分组、标签与日期", 10);
    assert.ok(
      chinese.some((doc) => doc.path === "/blogs/reading-experience-structure"),
      "search lost the existing Chinese article title",
    );
    return "tag text and Chinese title still searchable; categories add no search dimension";
  });

  check("old-content-collection-collection-behavior-unchanged", () => {
    const allDocs = documents.map(({ doc }) => doc);
    const guide = api.selectFolioCollectionDocs(allDocs, "/guide");
    const reference = api.selectFolioCollectionDocs(allDocs, "/reference");
    assert.ok(guide.length >= 10, `expected the guide collection to keep its documents, got ${guide.length}`);
    assert.ok(reference.length >= 20, `expected the reference collection to keep its documents, got ${reference.length}`);
    assert.ok(
      [...guide, ...reference].every((doc) => doc.path.startsWith("/guide/") || doc.path.startsWith("/reference/")),
      "collection selection returned a document outside its route prefix",
    );
    // Adding category must not affect selection: re-run over copies carrying a
    // category and assert the exact same paths.
    const withCategories = allDocs.map((doc) => ({ ...doc, category: "Frontend" }));
    assert.deepEqual(
      api.selectFolioCollectionDocs(withCategories, "/guide").map((doc) => doc.path),
      guide.map((doc) => doc.path),
      "a category changed collection recursion",
    );
    return { guide: guide.length, reference: reference.length, categoryDoesNotAffectSelection: true };
  });

  const index = check("old-content-archive-index-is-safe-and-article-only", () => {
    const allDocs = documents.map(({ doc }) => doc);
    const built = api.buildFolioArticleArchiveIndex(allDocs, true);
    assert.deepEqual(built.categories, [], "old content must not invent categories");
    const articles = documents.filter(({ doc }) => doc.type === "article").map(({ doc }) => doc);
    assert.ok(articles.length >= 4, `expected at least 4 real articles, found ${articles.length}`);
    assert.deepEqual(
      built.uncategorized.map((doc) => doc.path).sort(),
      articles.map((doc) => doc.path).sort(),
      "all real articles without a category must be uncategorized",
    );
    assert.deepEqual(built.untagged, [], "real articles all carry at least one tag");
    for (const group of built.tags) {
      assert.ok(group.docs.every((doc) => doc.type === "article"), `tag group ${group.id} contains a non-article`);
    }
    const articleTagIds = new Set(
      articles.flatMap((doc) => doc.tags.map((tag) => api.normalizeFolioArticleArchiveId(tag))),
    );
    assert.deepEqual(
      built.tags.map((group) => group.id).sort(),
      [...articleTagIds].sort(),
      "tag groups do not match the article tag identities",
    );
    return {
      articles: articles.length,
      categories: built.categories.length,
      tagGroups: built.tags.map((group) => ({ id: group.id, title: group.title, docs: group.docs.length })),
    };
  });

  results.meta.siteContent = parsed;
  endStage();
}

// ---------------------------------------------------------------------------
// Stage 3: purpose-built Markdown fixtures and archive-edge contract
// ---------------------------------------------------------------------------
function createArchiveFixtures() {
  const root = tempDir("folio-fol040-fixtures-");
  writeFixture(
    root,
    "articles/frontend-new.md",
    `title: Frontend new
type: article
category: Frontend
tags:
  - React
  - Runtime
date: 2026-03-01
collection: Alpha
order: 1`,
  );
  writeFixture(
    root,
    "articles/frontend-mid.md",
    `title: Frontend mid
type: article
category: frontend
tags: [react]
date: 2026-02-01
collection: Beta
order: 2`,
  );
  writeFixture(
    root,
    "articles/chinese.md",
    `title: 中文文章
type: article
category: "  前端  "
tags: ["中文标签", "React"]
date: 2026-01-01
collection: Alpha
order: 3`,
  );
  writeFixture(
    root,
    "articles/plain.md",
    `title: Plain
type: article
date: 2026-04-01
collection: Alpha
order: 4`,
  );
  writeFixture(
    root,
    "articles/tag-string.md",
    `title: Tag string
type: article
category: ""
tags: React | Vue
date: 2025-12-01
collection: Beta`,
  );
  writeFixture(
    root,
    "articles/dupe-tags.md",
    `title: Duplicate tags
type: article
tags: [React, react, " REACT "]
date: 2025-11-01
collection: Alpha`,
  );
  writeFixture(
    root,
    "articles/tie-a.md",
    `title: Tie A
type: article
category: Tie
tags: [Tie]
date: 2025-10-01
order: 5`,
  );
  writeFixture(
    root,
    "articles/tie-b.md",
    `title: Tie B
type: article
category: Tie
tags: [Tie]
date: 2025-10-01
order: 5`,
  );
  writeFixture(
    root,
    "articles/invalid-category-array.md",
    `title: Invalid array
type: article
category:
  - Frontend
  - Backend
tags: [ArrayTag]
date: 2025-09-01`,
  );
  writeFixture(
    root,
    "articles/invalid-category-number.md",
    `title: Invalid number
type: article
category: 2026
date: 2025-08-01`,
  );
  writeFixture(
    root,
    "articles/unicode-istanbul.md",
    `title: Istanbul
type: article
category: İstanbul
date: 2025-07-01`,
  );
  writeFixture(
    root,
    "articles/empty-tags.md",
    `title: Empty tags
type: article
tags: ["", "   ", "Real"]
date: 2025-06-01`,
  );
  writeFixture(
    root,
    "docs/doc-with-category.md",
    `title: Doc with category
type: doc
category: Backend
tags: [Backend]
collection: Alpha`,
  );
  writeFixture(
    root,
    "pages/page-with-category.md",
    `title: Page with category
type: page
category: Backend
tags: [Backend]`,
  );
  writeFixture(
    root,
    "articles/collision-cpp.md",
    `title: C++
type: article
category: C++
tags: [Systems]
date: 2026-01-01`,
  );
  writeFixture(
    root,
    "articles/collision-csharp.md",
    `title: C#
type: article
category: C#
tags: [Systems]
date: 2026-01-02`,
  );
  writeFixture(
    root,
    "articles/no-safe-category.md",
    `title: No safe
type: article
category: "+++"
date: 2026-01-01`,
  );
  return root;
}

function stageArchiveFixtures(api) {
  stage("markdown-to-archive-index-edge-contract");
  const root = createArchiveFixtures();
  const baseFiles = [
    "articles/frontend-new.md",
    "articles/frontend-mid.md",
    "articles/chinese.md",
    "articles/plain.md",
    "articles/tag-string.md",
    "articles/dupe-tags.md",
    "articles/tie-a.md",
    "articles/tie-b.md",
    "articles/invalid-category-array.md",
    "articles/invalid-category-number.md",
    "articles/unicode-istanbul.md",
    "articles/empty-tags.md",
    "docs/doc-with-category.md",
    "pages/page-with-category.md",
  ];
  const docs = baseFiles.map((file) => {
    const raw = readFileSync(join(root, ...file.split("/")), "utf8");
    return api.parseFolioDoc(file, raw);
  });

  check("fixtures-parse-through-frontmatter-then-foliodoc", () => {
    for (const doc of docs) {
      assert.ok(doc.body.includes("Fixture body"), `body missing for ${doc.path}`);
      assert.ok(doc.headings.some((heading) => heading.text === "Body"), `heading parsing broken for ${doc.path}`);
    }
    const byPath = Object.fromEntries(docs.map((doc) => [doc.path, doc]));
    assert.equal(byPath["/articles/frontend-new"].category, "Frontend");
    assert.equal(byPath["/articles/frontend-mid"].category, "frontend");
    assert.equal(byPath["/articles/chinese"].category, "前端");
    assert.equal(byPath["/articles/plain"].category, undefined);
    assert.equal(byPath["/articles/tag-string"].category, undefined);
    assert.deepEqual(byPath["/articles/tag-string"].tags, ["React", "Vue"]);
    assert.deepEqual(byPath["/articles/dupe-tags"].tags, ["React", "react", "REACT"]);
    assert.equal(byPath["/articles/invalid-category-array"].category, undefined);
    assert.equal(byPath["/articles/invalid-category-number"].category, undefined);
    return {
      parsed: docs.length,
      articleCount: docs.filter((doc) => doc.type === "article").length,
    };
  });

  const built = check("archive-index-groups-categories-and-tags", () => {
    const index = api.buildFolioArticleArchiveIndex(docs);
    const categories = Object.fromEntries(index.categories.map((group) => [group.id, group]));
    assert.equal(categories.frontend.slug, "frontend");
    assert.equal(categories.frontend.title, "Frontend", "first Article in order supplies the fallback label");
    assert.deepEqual(categories.frontend.docs.map((doc) => doc.path), [
      "/articles/frontend-new",
      "/articles/frontend-mid",
    ]);
    assert.equal(categories["前端"].slug, "前端");
    assert.equal(categories["前端"].title, "前端");
    const istanbul = index.categories.find((group) => group.slug === "istanbul");
    assert.ok(istanbul, "the İstanbul category is missing");
    assert.equal(istanbul.id, api.normalizeFolioArticleArchiveId("İstanbul"));
    assert.equal(categories.tie.docs.length, 2);
    assert.equal(categories.backend, undefined, "type: doc/page must never enter category archives");
    assert.deepEqual(index.uncategorized.map((doc) => doc.path), [
      "/articles/plain",
      "/articles/tag-string",
      "/articles/dupe-tags",
      "/articles/invalid-category-array",
      "/articles/invalid-category-number",
      "/articles/empty-tags",
    ], "uncategorized must keep the stable Article order");

    const tags = Object.fromEntries(index.tags.map((group) => [group.id, group]));
    assert.equal(tags.react.title, "React", "tags use the first source spelling in Article order");
    assert.equal(tags["中文标签"].title, "中文标签");
    assert.deepEqual(tags.react.docs.map((doc) => doc.path), [
      "/articles/frontend-new",
      "/articles/frontend-mid",
      "/articles/chinese",
      "/articles/tag-string",
      "/articles/dupe-tags",
    ]);
    assert.deepEqual(tags.react.docs.filter((doc) => doc.path === "/articles/dupe-tags").length, 1);
    assert.deepEqual(tags["中文标签"].docs.map((doc) => doc.path), ["/articles/chinese"]);
    assert.deepEqual(tags.real.docs.map((doc) => doc.path), ["/articles/empty-tags"]);
    assert.deepEqual(tags.backend, undefined, "type: doc/page tags must not enter tag archives");
    assert.deepEqual(index.untagged.map((doc) => doc.path), [
      "/articles/plain",
      "/articles/invalid-category-number",
      "/articles/unicode-istanbul",
    ]);
    assert.deepEqual(indexSummary(index), indexSummary(api.buildFolioArticleArchiveIndex(docs, false)));
    assert.deepEqual(indexSummary(index), indexSummary(api.buildFolioArticleArchiveIndex(docs, true)));
    return indexSummary(index);
  });

  check("archive-groups-return-the-original-full-documents", () => {
    const index = api.buildFolioArticleArchiveIndex(docs);
    const source = docs.find((doc) => doc.path === "/articles/frontend-new");
    const group = index.categories.find((entry) => entry.id === "frontend");
    assert.equal(group.docs[0], source, "the archive group must return the original FolioDoc object");
    assert.equal(group.docs[0].body, source.body);
    assert.equal(group.docs[0].data.title, "Frontend new");
    return "category/tag groups contain the original FolioDoc references (no re-parse, no copy)";
  });

  check("archive-order-is-stable-date-desc-then-order-then-path", () => {
    const index = api.buildFolioArticleArchiveIndex(docs);
    const tie = index.categories.find((group) => group.id === "tie");
    assert.deepEqual(tie.docs.map((doc) => doc.path), ["/articles/tie-a", "/articles/tie-b"]);
    const react = index.tags.find((group) => group.id === "react");
    assert.deepEqual(react.docs.map((doc) => doc.date), [
      "2026-03-01",
      "2026-02-01",
      "2026-01-01",
      "2025-12-01",
      "2025-11-01",
    ]);
    const slugs = index.categories.map((group) => group.slug);
    assert.deepEqual(slugs, stableSortBySlug(index.categories).map((group) => group.slug));
    return { categorySlugs: slugs, categoryTitles: index.categories.map((group) => group.title) };
  });

  check("archive-index-is-order-independent-and-does-not-mutate-the-input", () => {
    const originalOrder = docs.map((doc) => doc.path);
    const forward = indexSummary(api.buildFolioArticleArchiveIndex(docs));
    const reversed = docs.slice().reverse();
    const backward = indexSummary(api.buildFolioArticleArchiveIndex(reversed));
    assert.deepEqual(forward, backward, "the archive index depends on the caller's array order");
    assert.deepEqual(docs.map((doc) => doc.path), originalOrder, "the builder reordered the caller's array");
    assert.deepEqual(originalOrder.slice().sort(), docs.map((doc) => doc.path).sort());
    return "forward vs reversed input produce identical indexes; caller array untouched";
  });

  check("category-display-label-override-changes-title-only", () => {
    const index = api.buildFolioArticleArchiveIndex(docs, {
      categoryLabels: { frontend: "前端开发", "  前端  ": "前端" },
    });
    const frontend = index.categories.find((group) => group.id === "frontend");
    assert.equal(frontend.title, "前端开发");
    assert.equal(frontend.slug, "frontend", "a display label must never change the URL identifier");
    assert.deepEqual(frontend.docs.map((doc) => doc.path), [
      "/articles/frontend-new",
      "/articles/frontend-mid",
    ]);
    const chinese = index.categories.find((group) => group.id === "前端");
    assert.equal(chinese.title, "前端");
    return frontend;
  });

  check("empty-or-invalid-category-overrides-fall-back-safely", () => {
    const empty = api.buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: "   " } });
    assert.equal(empty.categories.find((group) => group.id === "frontend").title, "Frontend");
    const nonString = api.buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: 42 } });
    assert.equal(nonString.categories.find((group) => group.id === "frontend").title, "Frontend");
    const emptyKey = api.buildFolioArticleArchiveIndex(docs, { categoryLabels: { "   ": "X" } });
    assert.equal(emptyKey.categories.find((group) => group.id === "frontend").title, "Frontend");
    return "empty label, non-string label and empty key all fall back to the source spelling";
  });

  check("conflicting-category-display-labels-fail-explicitly", () => {
    let caught;
    try {
      api.buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: "Alpha", Frontend: "Beta" } });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, "conflicting labels for one category id must throw");
    assert.match(caught.message, /conflicting category display labels/);
    assert.match(caught.message, /frontend/);
    return caught.message;
  });

  check("two-categories-with-one-display-label-fail-explicitly", () => {
    let caught;
    try {
      api.buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: "Web", "前端": "web" } });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, "two distinct categories resolving to one display label must throw");
    assert.match(caught.message, /duplicate category display label/);
    return caught.message;
  });

  check("url-identifier-collision-fails-instead-of-silently-sharing", () => {
    const collisionDocs = [
      api.parseFolioDoc(
        "articles/collision-cpp.md",
        readFileSync(join(root, "articles", "collision-cpp.md"), "utf8"),
      ),
      api.parseFolioDoc(
        "articles/collision-csharp.md",
        readFileSync(join(root, "articles", "collision-csharp.md"), "utf8"),
      ),
    ];
    assert.equal(api.folioArticleArchiveSlug("C++"), "c");
    assert.equal(api.folioArticleArchiveSlug("C#"), "c");
    let caught;
    try {
      api.buildFolioArticleArchiveIndex(collisionDocs);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, "two categories sharing one slug must throw");
    assert.match(caught.message, /URL identifier collision/);
    assert.match(caught.message, /c\+\+/);
    assert.match(caught.message, /c#/);
    return caught.message;
  });

  check("identity-without-url-safe-character-fails-explicitly", () => {
    const raw = readFileSync(join(root, "articles", "no-safe-category.md"), "utf8");
    const doc = api.parseFolioDoc("articles/no-safe-category.md", raw);
    assert.equal(doc.category, "+++");
    assert.equal(api.normalizeFolioArticleArchiveId("+++"), "+++");
    assert.equal(api.folioArticleArchiveSlug("+++"), "");
    let caught;
    try {
      api.buildFolioArticleArchiveIndex([doc]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, "a category with no URL-safe character must throw");
    assert.match(caught.message, /no URL-safe identifier/);
    return caught.message;
  });

  check("normalization-is-deterministic-for-case-whitespace-and-unicode", () => {
    assert.equal(api.normalizeFolioArticleArchiveId("  FrontEnd  "), "frontend");
    assert.equal(api.normalizeFolioArticleArchiveId("前端"), "前端");
    assert.equal(api.normalizeFolioArticleArchiveId("中文   标签"), "中文 标签");
    assert.equal(api.normalizeFolioArticleArchiveId("İstanbul"), "i̇stanbul");
    assert.equal(api.folioArticleArchiveSlug("İstanbul"), "istanbul");
    assert.equal(api.normalizeFolioArticleArchiveId(""), "");
    assert.equal(api.folioArticleArchiveSlug(""), "");
    // Idempotent: normalizing/slugging an id again is a no-op.
    for (const value of ["FrontEnd", "前端", "C++", "İstanbul", "中文   标签"]) {
      const id = api.normalizeFolioArticleArchiveId(value);
      assert.equal(api.normalizeFolioArticleArchiveId(id), id);
      assert.equal(api.folioArticleArchiveSlug(id), api.folioArticleArchiveSlug(value));
    }
    return "case/whitespace/NFC/Chinese behaviour is deterministic and idempotent";
  });

  check("find-group-resolves-by-slug-and-canonical-id", () => {
    const index = api.buildFolioArticleArchiveIndex(docs);
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", "frontend").id, "frontend");
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", "  FrontEnd  ").id, "frontend");
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", "前端").id, "前端");
    assert.equal(api.findFolioArticleArchiveGroup(index, "tag", "react").id, "react");
    assert.equal(api.findFolioArticleArchiveGroup(index, "tag", "中文标签").id, "中文标签");
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", "missing"), undefined);
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", ""), undefined);
    const slug = index.categories.find((group) => group.id === "前端").slug;
    assert.equal(decodeURIComponent(encodeURIComponent(slug)), slug);
    // The decoder must pass the decoded segment; a still-encoded segment is not
    // a canonical id and therefore resolves to undefined.
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", encodeURIComponent(slug)), undefined);
    assert.equal(api.findFolioArticleArchiveGroup(index, "category", decodeURIComponent(encodeURIComponent(slug))).id, "前端");
    return "slug/id lookup works for ASCII and Chinese; unknown/empty identifiers return undefined";
  });

  check("single-category-scalar-contract-holds", () => {
    const twoCategories = api.parseFolioDoc(
      "articles/two.md",
      "---\ntitle: Two\ntype: article\ncategory:\n  - A\n  - B\n---\nbody\n",
    );
    assert.equal(twoCategories.category, undefined, "a category list must not become two categories");
    const objectCategory = api.parseFolioDoc(
      "articles/object.md",
      "---\ntitle: Obj\ntype: article\ncategory:\n  name: A\n---\nbody\n",
    );
    assert.equal(objectCategory.category, undefined);
    assert.ok("category" in objectCategory.data, "raw invalid shape stays available in data");
    // Only type: article enters archives, even if a non-article looks like one.
    const nonArticles = ["docs/a.md", "pages/b.md", "projects/c.md"].map((path, index) =>
      api.parseFolioDoc(
        path,
        `---\ntitle: Non ${index}\ntype: ${["doc", "page", "project"][index]}\ncategory: Frontend\ntags: [React]\n---\nbody\n`,
      ),
    );
    const index = api.buildFolioArticleArchiveIndex(nonArticles);
    assert.deepEqual(index.categories, []);
    assert.deepEqual(index.tags, []);
    return "category is scalar-only; doc/page/project never enter article archives";
  });

  check("archives-span-the-caller-supplied-documents", () => {
    const alphaOnly = docs.filter((doc) => doc.type === "article" && doc.collection === "Alpha");
    const betaOnly = docs.filter((doc) => doc.type === "article" && doc.collection === "Beta");
    const alphaIndex = api.buildFolioArticleArchiveIndex(alphaOnly);
    const betaIndex = api.buildFolioArticleArchiveIndex(betaOnly);
    // Alpha-only and Beta-only indexes differ, while the union exposes both.
    assert.notDeepEqual(indexSummary(alphaIndex), indexSummary(betaIndex));
    const all = api.buildFolioArticleArchiveIndex(docs);
    const alphaReact = all.tags.find((group) => group.id === "react").docs.map((doc) => doc.path);
    assert.ok(alphaReact.includes("/articles/chinese"));
    assert.ok(alphaReact.includes("/articles/tag-string"));
    return {
      alphaArticles: alphaIndex.uncategorized.length,
      betaArticles: betaIndex.uncategorized.length,
      note: "multi-collection scope is the caller's document set, matching FOL-022 collection behaviour",
    };
  });

  endStage();
}

// ---------------------------------------------------------------------------
// Stage 4: schema <-> parser consistency and docs
// ---------------------------------------------------------------------------
function stageSchema(api) {
  stage("schema-and-docs-consistency");
  const schema = JSON.parse(readFileSync(join(repoRoot, "schemas", "content.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  check("schema-compiles-as-json-schema-2020-12", () => {
    ajv.compile(schema);
    return `${schema.$id} compiled with ajv 2020`;
  });
  const validate = ajv.compile(schema);

  check("schema-documents-category-and-tag-archive-contract", () => {
    assert.equal(schema.properties.category.type, "string");
    assert.match(schema.properties.category.description, /uncategorized/);
    assert.match(schema.properties.category.description, /archive dimension/);
    assert.equal(schema.properties.tags.type, "array");
    assert.deepEqual(schema.properties.tags.items, { type: "string" });
    assert.equal(schema.additionalProperties, true);
    return "category string + archive-dimension wording, tags string array, additionalProperties kept";
  });

  check("category-schema-and-parser-agree-on-valid-and-invalid-shapes", () => {
    const valid = (data) => validate(data);
    const cases = [
      { category: "Frontend", expected: "Frontend" },
      { category: "前端", expected: "前端" },
      { category: "  Frontend  ", expected: "Frontend" },
      { category: "", expected: undefined },
      { category: "   ", expected: undefined },
      { category: ["A", "B"], expected: undefined },
      { category: { name: "A" }, expected: undefined },
      { category: 2026, expected: undefined },
      { category: true, expected: undefined },
    ];
    const rows = [];
    for (const entry of cases) {
      const data = { title: "T", ...entry };
      const schemaAccepted = valid(data);
      const doc = api.parseFolioDoc(
        "articles/case.md",
        `---\ntitle: T\ncategory: ${JSON.stringify(entry.category)}\n---\nbody\n`,
      );
      // A shape may only become a category when the schema accepts a string
      // value. Invalid shapes must resolve to uncategorized, never be guessed.
      if (doc.category !== undefined) {
        assert.equal(typeof entry.category, "string");
        assert.ok(schemaAccepted, `parser accepted a category the schema rejects: ${JSON.stringify(entry.category)}`);
      }
      if (Array.isArray(entry.category) || typeof entry.category === "object" || typeof entry.category === "number" || typeof entry.category === "boolean") {
        assert.equal(schemaAccepted, false, `schema accepted an invalid category shape ${JSON.stringify(entry.category)}`);
        assert.equal(doc.category, undefined);
      }
      rows.push({ input: entry.category, schemaAccepted, parsed: doc.category });
    }
    return rows;
  });

  check("real-site-category-and-tags-fields-satisfy-content-schema", () => {
    // Scope this to the FOL-040 surface. The repository has no full-content
    // schema gate; validating the whole legacy frontmatter set surfaces an
    // unrelated pre-existing drift documented by the next check.
    const failures = [];
    for (const { sourcePath, raw } of parseAllMarkdown(api, siteContentDir)) {
      const { data } = api.parseFrontmatter(raw);
      if ("category" in data && !validate({ title: "T", category: data.category })) {
        failures.push({ sourcePath, field: "category", value: data.category });
      }
      if ("tags" in data && !validate({ title: "T", tags: data.tags })) {
        failures.push({ sourcePath, field: "tags", value: data.tags });
      }
    }
    assert.deepEqual(failures, [], "existing content category/tags fields violate schemas/content.schema.json");
    return "45/45 existing documents: category is absent or a schema-valid string; tags are schema-valid string arrays";
  });

  check("real-site-schema-drift-is-pre-existing-and-category-unrelated", () => {
    // Known baseline state, NOT introduced by FOL-040: two migrated design-study
    // files carry an unquoted colon inside `description`, so YAML parsing fails
    // and parseFrontmatter falls back to parseLooseFrontmatter, which reads
    // `order: 62` as a string. The schema wants a number. Confirm the drift is
    // exactly those two `order` fields and that the category contract adds no
    // new deviation.
    const failures = [];
    for (const { sourcePath, raw } of parseAllMarkdown(api, siteContentDir)) {
      const { data } = api.parseFrontmatter(raw);
      if (!validate(data)) {
        failures.push({
          sourcePath,
          fields: (validate.errors ?? []).map((error) => error.instancePath.replace(/^\//, "")).sort(),
          errors: (validate.errors ?? []).map((error) => error.message),
        });
      }
    }
    assert.deepEqual(
      failures.map((failure) => failure.sourcePath).sort(),
      [
        "reference/examples/claude.md",
        "reference/examples/supabase.md",
      ],
      "unexpected full-schema drift beyond the known pre-FOL-040 files",
    );
    assert.ok(
      failures.every((failure) => failure.fields.length === 1 && failure.fields[0] === "order"),
      `the known drift is not limited to order: ${JSON.stringify(failures)}`,
    );
    return {
      note: "pre-existing, out of FOL-040 scope: both files have an unquoted ':' in description; loose frontmatter parsing yields a string order. No category/tag deviation and no FOL-040 change to these files.",
      failures,
    };
  });

  check("legacy-tags-string-form-remains-supported-by-the-parser", () => {
    // Pre-existing contract (not introduced by FOL-040): the schema documents
    // tags as an array, but the parser keeps the legacy `|`/`,` string form.
    // This harness records that divergence explicitly instead of assuming it.
    const data = { title: "Legacy", tags: "React | Runtime" };
    assert.equal(validate(data), false, "the content schema is expected to require an array");
    const doc = api.parseFolioDoc(
      "articles/legacy.md",
      "---\ntitle: Legacy\ntags: React | Runtime\n---\nbody\n",
    );
    assert.deepEqual(doc.tags, ["React", "Runtime"]);
    return "known pre-FOL-040 divergence recorded: schema requires string[]; parser still accepts legacy '|' string";
  });

  check("architecture-doc-describes-the-implemented-contract", () => {
    const doc = readFileSync(join(repoRoot, "docs", "architecture.md"), "utf8");
    for (const needle of [
      "buildFolioArticleArchiveIndex",
      "uncategorized",
      "untagged",
      "categoryLabels",
      "no URL-safe character",
      "compareFolioDocs",
      "type` is not `article`",
    ]) {
      assert.ok(doc.includes(needle), `docs/architecture.md is missing ${needle}`);
    }
    return "docs/architecture.md documents grouping, fallback labels, ordering, collisions and article-only scope";
  });

  endStage();
}

// ---------------------------------------------------------------------------
// Stage 5: React/DOM-free Core evidence
// ---------------------------------------------------------------------------
function stageLayerEvidence() {
  stage("core-is-react-and-dom-free");
  const archiveSource = readFileSync(join(packageRoot, "src", "core", "article-archive.ts"), "utf8");

  check("archive-core-source-imports-only-core", () => {
    const specifiers = [...archiveSource.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
    assert.deepEqual(specifiers.sort(), ["../types", "./content"]);
    for (const specifier of specifiers) {
      assert.ok(!/react|react-dom|react-router|vite|\/ui\/|\/build\//.test(specifier));
    }
    return specifiers;
  });

  check("archive-core-source-has-no-dom-globals", () => {
    const withoutComments = archiveSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const dom = /\b(?:document|window|localStorage|sessionStorage|navigator)\s*(?:\?\.|\.|\[|\()/.exec(withoutComments);
    assert.equal(dom, null, `DOM global usage found: ${dom?.[0]}`);
    return "no DOM global access in src/core/article-archive.ts";
  });

  check("layer-gate-passes-on-the-real-source-tree", () => {
    const result = spawnSync(process.execPath, [join(packageRoot, "scripts", "dependency-layers.mjs")], {
      cwd: packageRoot,
      encoding: "utf8",
      timeout: 120_000,
    });
    recordCommand("node packages/folio/scripts/dependency-layers.mjs", result);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = (result.stdout ?? "").trim().split("\n").at(-1);
    assert.match(summary, /\[layers\] ok/);
    return summary;
  });

  check("esbuild-metafile-proves-the-core-module-pulls-in-no-react", () => {
    const outDir = tempDir("folio-fol040-esbuild-");
    const outfile = join(outDir, "article-archive.mjs");
    const metafile = join(outDir, "meta.json");
    const esbuild = join(repoRoot, "node_modules", ".bin", isWindows ? "esbuild.cmd" : "esbuild");
    const result = spawnSync(
      esbuild,
      [
        join(packageRoot, "src", "core", "article-archive.ts"),
        "--bundle",
        "--format=esm",
        "--platform=node",
        "--target=node20",
        // The bundled CJS dependencies (yaml) call require("process"); provide a
        // real require in the ESM output so the standalone probe can execute.
        "--banner:js=import { createRequire as __folioCreateRequire } from 'node:module'; const require = __folioCreateRequire(import.meta.url);",
        `--outfile=${outfile}`,
        `--metafile=${metafile}`,
        "--log-level=warning",
      ],
      { cwd: repoRoot, encoding: "utf8", timeout: 120_000, shell: isWindows },
    );
    recordCommand("esbuild --bundle src/core/article-archive.ts --metafile", result);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const inputs = Object.keys(JSON.parse(readFileSync(metafile, "utf8")).inputs);
    const reactInputs = inputs.filter((input) => /node_modules[/\\](?:react|react-dom|react-router-dom)[/\\]/.test(input));
    assert.deepEqual(reactInputs, [], `the Core archive bundle includes React: ${reactInputs}`);
    // Run the standalone bundle in a fresh Node process (no DOM, no React).
    const probe = `
      import { buildFolioArticleArchiveIndex } from ${JSON.stringify(pathToFileURL(outfile).href)};
      const doc = {
        id: "/blogs/a",
        path: "/blogs/a",
        sourcePath: "blogs/a.md",
        type: "article",
        title: "A",
        description: "",
        group: "博客",
        order: 99,
        category: "Frontend",
        tags: ["React"],
        body: "body",
        headings: [],
        data: {},
      };
      const index = buildFolioArticleArchiveIndex([doc]);
      if (index.categories.length !== 1 || index.categories[0].title !== "Frontend" || index.tags[0].id !== "react") {
        throw new Error("standalone core bundle returned an unexpected index: " + JSON.stringify(index));
      }
      if (typeof globalThis.document !== "undefined" || typeof globalThis.window !== "undefined") {
        throw new Error("DOM unexpectedly present");
      }
      console.log(JSON.stringify({ categories: index.categories.length, tags: index.tags.length }));
    `;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: outDir,
      encoding: "utf8",
      timeout: 120_000,
    });
    recordCommand("node <standalone article-archive bundle probe>", run);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    return {
      inputs: inputs.length,
      bundledModules: inputs.filter((input) => !input.startsWith("..")),
      standaloneRun: JSON.parse((run.stdout ?? "").trim()),
    };
  });

  endStage();
}

// ---------------------------------------------------------------------------
// Stage 6: real npm tarball consumer outside the repository
// ---------------------------------------------------------------------------
function stageTarballConsumer() {
  if (skipConsumer) {
    results.meta.commands.push({ command: "npm pack + external consumer", status: "skipped", exitCode: null });
    return;
  }
  stage("external-npm-tarball-consumer");

  const tempRoot = tempDir("folio-fol040-consumer-");
  const tarballDir = join(tempRoot, "tarball");
  const consumerDir = join(tempRoot, "consumer");
  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });

  const pack = runNpm([
    "pack",
    "--ignore-scripts",
    "--pack-destination",
    tarballDir,
    "--json",
  ], { cwd: packageRoot });
  const packReport = JSON.parse(pack.stdout).at(-1);
  const tarballs = readdirSync(tarballDir).filter((file) => file.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, `expected exactly one tarball, found ${tarballs.length}`);
  const tarballPath = join(tarballDir, tarballs[0]);
  results.tarball = {
    fileName: tarballs[0],
    sha256: sha256(tarballPath),
    bytes: packReport.size,
    entryCount: packReport.entryCount,
    unpackedSize: packReport.unpackedSize,
    packedFiles: packReport.files.map((file) => file.path),
    sourceCommit: results.meta.commit,
    sourceDirty: results.meta.packagedSourcesDirty !== "",
  };
  check("tarball-contains-public-dist-entry-and-declarations", () => {
    const files = new Set(packReport.files.map((file) => file.path));
    for (const required of ["package.json", "dist/index.js", "dist/index.d.ts"]) {
      assert.ok(files.has(required), `tarball missing ${required}`);
    }
    assert.ok(![...files].some((file) => file.startsWith("src/") || file.startsWith("test/")));
    return `${packReport.entryCount} files, ${packReport.size} bytes`;
  });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "folio-fol040-consumer", private: true, version: "0.0.0", type: "module" }, null, 2) + "\n",
  );

  const install = runNpm(
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--prefer-offline",
      tarballPath,
      "@types/react@^19",
      "@types/react-dom@^19",
      "@types/node@^24",
    ],
    { cwd: consumerDir },
  );
  results.consumer.installLogTail = (install.stdout ?? "").trim().split("\n").slice(-6);

  const installedRoot = join(consumerDir, "node_modules", "@uichat-mira", "folio");
  check("tarball-is-installed-as-a-real-package-not-a-workspace-link", () => {
    const stat = lstatSync(installedRoot);
    assert.equal(stat.isSymbolicLink(), false, "installed package is a symlink (workspace/file alias)");
    assert.ok(stat.isDirectory(), "installed package is not a directory");
    const manifest = readInstalledPackageManifest(consumerDir, "@uichat-mira/folio");
    assert.equal(manifest.name, "@uichat-mira/folio");
    assert.equal(manifest.version, results.meta.package.version);
    const lock = JSON.parse(readFileSync(join(consumerDir, "package-lock.json"), "utf8"));
    const installed = lock.packages?.["node_modules/@uichat-mira/folio"];
    assert.ok(installed, "lockfile has no entry for @uichat-mira/folio");
    assert.ok(String(installed.resolved).endsWith(".tgz"), `unexpected install source: ${installed.resolved}`);
    assert.ok(!String(installed.resolved).includes("packages/folio"), "consumer resolved the repository workspace instead of the tarball");
    results.consumer = {
      ...results.consumer,
      installedVersion: manifest.version,
      symlink: false,
      lockResolved: installed.resolved,
      tarballSha256: results.tarball.sha256,
    };
    return { version: manifest.version, resolved: installed.resolved };
  });

  check("installed-dist-bytes-match-the-built-package", () => {
    const local = join(packageRoot, "dist", "index.js");
    const installed = join(installedRoot, "dist", "index.js");
    assert.equal(sha256(installed), sha256(local), "installed dist/index.js differs from the built package");
    assert.equal(sha256(join(installedRoot, "dist", "index.d.ts")), sha256(join(packageRoot, "dist", "index.d.ts")));
    return { indexJsSha256: sha256(local) };
  });

  writeFileSync(
    join(consumerDir, "verify.mjs"),
    `import assert from "node:assert/strict";
import {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  folioArticleArchiveSlug,
  normalizeFolioArticleArchiveId,
  parseFrontmatter,
  parseFolioDoc,
} from "@uichat-mira/folio";

const rawNew = "---\\ntitle: New\\ntype: article\\ncategory: Frontend\\ntags: [React, Runtime]\\ndate: 2026-03-01\\ncollection: Alpha\\n---\\nbody new\\n";
const rawOld = "---\\ntitle: Old\\ntype: article\\ntags: [react]\\ndate: 2026-02-01\\ncollection: Beta\\n---\\nbody old\\n";
const rawChinese = "---\\ntitle: 中文\\ntype: article\\ncategory: 前端\\ntags: [中文标签, React]\\ndate: 2026-01-01\\n---\\nbody zh\\n";
const rawDoc = "---\\ntitle: Doc\\ntype: doc\\ncategory: Frontend\\ntags: [React]\\n---\\nbody doc\\n";

const docs = [rawNew, rawOld, rawChinese, rawDoc].map((raw, index) => {
  const parsed = parseFrontmatter(raw);
  assert.ok(parsed.body.startsWith("body"));
  return parseFolioDoc("blogs/c" + index + ".md", raw);
});

assert.equal(docs[0].category, "Frontend");
assert.equal(docs[1].category, undefined);
assert.deepEqual(docs[1].tags, ["react"]);

const index = buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: "前端开发" } });
assert.deepEqual(index.categories.map((group) => group.id).sort(), ["frontend", "前端"]);
const frontend = index.categories.find((group) => group.id === "frontend");
assert.equal(frontend.title, "前端开发");
assert.equal(frontend.slug, "frontend");
assert.deepEqual(frontend.docs.map((doc) => doc.path), ["/blogs/c0"]);
const react = index.tags.find((group) => group.id === "react");
assert.deepEqual(react.docs.map((doc) => doc.path), ["/blogs/c0", "/blogs/c1", "/blogs/c2"]);
assert.deepEqual(index.uncategorized.map((doc) => doc.path), ["/blogs/c1"]);
assert.equal(findFolioArticleArchiveGroup(index, "category", "前端").id, "前端");
assert.equal(normalizeFolioArticleArchiveId("  FRONTEND "), "frontend");
assert.equal(folioArticleArchiveSlug("前端"), "前端");
console.log(JSON.stringify({
  consumer: "external-tarball",
  packageEntry: "import '@uichat-mira/folio' resolved without workspace/file alias",
  categories: index.categories.map((group) => ({ id: group.id, slug: group.slug, title: group.title, docs: group.docs.map((doc) => doc.path) })),
  tags: index.tags.map((group) => ({ id: group.id, docs: group.docs.map((doc) => doc.path) })),
  uncategorized: index.uncategorized.map((doc) => doc.path),
}, null, 2));
`,
  );
  const consumerRun = spawnSync(process.execPath, ["verify.mjs"], {
    cwd: consumerDir,
    encoding: "utf8",
    timeout: 120_000,
  });
  recordCommand("node verify.mjs (external consumer importing @uichat-mira/folio)", consumerRun);
  check("external-consumer-imports-public-entry-and-builds-the-index", () => {
    assert.equal(consumerRun.status, 0, consumerRun.stderr || consumerRun.stdout);
    const payload = JSON.parse(consumerRun.stdout);
    assert.equal(payload.categories.length, 2);
    assert.equal(payload.uncategorized.length, 1);
    results.consumer.probe = payload;
    return payload;
  });

  writeFileSync(
    join(consumerDir, "verify-types.ts"),
    `import {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  folioArticleArchiveSlug,
  normalizeFolioArticleArchiveId,
  parseFrontmatter,
  parseFolioDoc,
  type FolioArticleArchiveConfig,
  type FolioArticleArchiveGroup,
  type FolioArticleArchiveIndex,
  type FolioArticleArchiveKind,
  type FolioCollectionConfig,
  type FolioDoc,
} from "@uichat-mira/folio";

const raw = "---\\ntitle: Typed\\ntype: article\\ncategory: Frontend\\ntags: [React]\\n---\\nbody";
const { data } = parseFrontmatter(raw);
const docs: FolioDoc[] = [parseFolioDoc("blogs/typed.md", raw)];
const config: FolioArticleArchiveConfig = { categoryLabels: { frontend: "前端开发" } };
const collection: FolioCollectionConfig = { path: "/blogs", archive: config };
const index: FolioArticleArchiveIndex = buildFolioArticleArchiveIndex(docs, collection.archive);
const kind: FolioArticleArchiveKind = "category";
const groups: FolioArticleArchiveGroup[] = [...index.categories, ...index.tags];
const group: FolioArticleArchiveGroup | undefined = findFolioArticleArchiveGroup(index, kind, groups[0]!.slug);
const normalized: string = normalizeFolioArticleArchiveId(String(data.category));
const slug: string = folioArticleArchiveSlug(normalized);
console.log(group?.title, slug, index.uncategorized.length);
`,
  );
  writeFileSync(
    join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: ["node"],
        },
        include: ["verify-types.ts"],
      },
      null,
      2,
    ) + "\n",
  );
  const tsc = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const typecheck = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
    cwd: consumerDir,
    encoding: "utf8",
    timeout: 300_000,
  });
  recordCommand("tsc -p tsconfig.json (external consumer, NodeNext, skipLibCheck=false)", typecheck);
  check("external-consumer-types-resolve-from-tarball-declarations", () => {
    assert.equal(typecheck.status, 0, typecheck.stdout || typecheck.stderr);
    return "TypeScript NodeNext + skipLibCheck=false resolved all public archive types from dist/index.d.ts";
  });

  if (keepTemp) results.consumer.tempDir = consumerDir;
  endStage();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let failure;
try {
  stageBuild();
  const api = await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href);

  check("public-entry-exports-the-minimal-archive-api", () => {
    for (const name of [
      "buildFolioArticleArchiveIndex",
      "findFolioArticleArchiveGroup",
      "normalizeFolioArticleArchiveId",
      "folioArticleArchiveSlug",
    ]) {
      assert.equal(typeof api[name], "function", `dist/index.js does not export ${name}`);
    }
    return ["buildFolioArticleArchiveIndex", "findFolioArticleArchiveGroup", "normalizeFolioArticleArchiveId", "folioArticleArchiveSlug"];
  });

  check("built-declarations-expose-the-public-archive-types", () => {
    const types = readFileSync(join(packageRoot, "dist", "index.d.ts"), "utf8");
    for (const declaration of [
      "type FolioArticleArchiveKind =",
      "type FolioArticleArchiveGroup =",
      "type FolioArticleArchiveIndex =",
      "declare function buildFolioArticleArchiveIndex(docs: readonly FolioDoc[], config?: boolean | FolioArticleArchiveConfig): FolioArticleArchiveIndex;",
      "declare function findFolioArticleArchiveGroup(",
      "declare function normalizeFolioArticleArchiveId(label: string): string;",
      "declare function folioArticleArchiveSlug(value: string): string;",
      "FolioArticleArchiveConfig,",
    ]) {
      assert.ok(types.includes(declaration), `dist/index.d.ts is missing: ${declaration}`);
    }
    return "all four functions, three result types and FolioArticleArchiveConfig are declared in dist/index.d.ts";
  });

  stageRealContent(api);
  stageArchiveFixtures(api);
  stageSchema(api);
  stageLayerEvidence();
  stageTarballConsumer();
} catch (error) {
  failure = error;
}

if (currentStage) {
  currentStage.status = "failed";
  currentStage.error = failure?.message;
}

results.summary.total = results.checks.length;
results.summary.passed = results.checks.filter((entry) => entry.status === "passed").length;
results.summary.failed = results.checks.filter((entry) => entry.status === "failed").length;
results.summary.status = failure ? "failed" : "passed";
results.meta.finishedAt = new Date().toISOString();

mkdirSync(resultsDir, { recursive: true });
writeFileSync(join(resultsDir, "acceptance.json"), JSON.stringify(results, null, 2) + "\n");

for (const entry of results.checks) {
  console.log(`${entry.status === "passed" ? "PASS" : "FAIL"}  ${entry.id} (${entry.ms}ms)`);
}
console.log(
  `\n${results.summary.passed}/${results.summary.total} checks passed` +
    (failure ? `; first failure: ${failure.message}` : ""),
);
console.log(`results: ${posix(relative(repoRoot, join(resultsDir, "acceptance.json")))}`);

if (!keepTemp) {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
} else {
  console.log(`temporary roots kept: ${tempRoots.join(", ")}`);
}

if (failure) process.exitCode = 1;
