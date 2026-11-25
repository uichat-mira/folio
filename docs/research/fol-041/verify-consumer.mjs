#!/usr/bin/env node
// FOL-041 (#163) independent external-consumer harness.
//
// Proves from OUTSIDE the repository, using only the published package entry
// points, that a real npm tarball consumer:
//   - configures archive pages for a collection path that is NOT /blogs;
//   - builds the default static archive routes (two collections + one disabled);
//   - exposes noindex, base-path, canonical, sitemap and direct-fetch behavior;
//   - fails the build on document/collection/duplicate archive route conflicts;
//   - renders the same archive lists through the React app and static HTML.
//
// Usage:
//   node docs/research/fol-041/verify-consumer.mjs [--skip-build] [--keep]
//
// Results: docs/research/fol-041/results/consumer.json
// Screenshots: docs/research/fol-041/results/screenshots/consumer-*.png
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Reporter,
  assertIncludes,
  evaluate,
  goto,
  htmlRoutes,
  launchChrome,
  openPage,
  parseEntryList,
  parseLocs,
  poll,
  readRoute,
  repoRoot,
  packageRoot,
  routeFile,
  screenshot,
  screenshotsDir,
  sha256,
  startServer,
  tempDir,
  walkFiles,
  npmEnv,
} from "./lib.mjs";

const skipBuild = process.argv.includes("--skip-build");
const keepTemp = process.argv.includes("--keep");
const siteUrl = "https://example.test";
const basePath = "/folio-smoke/";
const consumerName = "folio-fol041-consumer";
const collectionSpecs = [
  { path: "/journal", title: "Journal", archive: { categoryLabels: { 工程实践: "工程实践" } } },
  { path: "/notes", title: "Notes", archive: true },
  { path: "/docs", title: "Docs" },
];

const reporter = new Reporter({
  name: "fol-041-consumer",
  purpose:
    "FOL-041 (#163) independent verification: external npm tarball consumer with non-/blogs collections, static archives, noindex, conflicts and React/static parity",
  harness: "docs/research/fol-041/verify-consumer.mjs",
});

const consumerRoot = tempDir("folio041-consumer-");
const tarballDir = join(consumerRoot, "tarball");
const consumerDir = join(consumerRoot, "consumer");
const contentDir = join(consumerDir, "content");
mkdirSync(tarballDir, { recursive: true });
mkdirSync(contentDir, { recursive: true });
reporter.results.artifacts.consumerRoot = consumerRoot;

function writeFixture(relativePath, frontmatter) {
  const target = join(consumerDir, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `---\n${frontmatter.trim()}\n---\n\nBody for ${relativePath}.\n`);
}

function writeConsumerSources() {
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: consumerName, private: true, version: "0.0.0", type: "module" }, null, 2) + "\n",
  );
  writeFileSync(
    join(consumerDir, "folio.config.ts"),
    `import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Consumer Journal",
  description: "Independent FOL-041 consumer fixture",
  siteUrl: ${JSON.stringify(siteUrl)},
  collections: [
    {
      path: "/journal",
      title: "Journal",
      description: "Journal with opt-in archives",
      archive: { categoryLabels: { 工程实践: "工程实践" } },
    },
    { path: "/notes", title: "Notes", description: "Notes with opt-in archives", archive: true },
    { path: "/docs", title: "Docs", description: "Archive-disabled collection" },
  ],
});
`,
  );
  writeFileSync(
    join(consumerDir, "folio.conflict-collection.config.ts"),
    `import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Consumer Journal",
  description: "Conflict fixture: a collection index owns an archive route",
  siteUrl: ${JSON.stringify(siteUrl)},
  collections: [
    { path: "/journal", title: "Journal", archive: true },
    { path: "/journal/category/工程实践", title: "Shadow collection" },
  ],
});
`,
  );
  writeFileSync(
    join(consumerDir, "vite.config.ts"),
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const base = process.env.CONSUMER_BASE ?? "/";
const noindex = process.env.CONSUMER_NOINDEX === "1";
const contentDir = process.env.CONSUMER_CONTENT ?? "content";
const configPath = join(process.cwd(), process.env.CONSUMER_CONFIG ?? "folio.config.ts");
const config = (await import(pathToFileURL(configPath).href)).default;

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir,
      config,
      staticRoutes: {
        locale: "zh_CN",
        siteName: "Consumer",
        sitemap: true,
        robots: true,
        ...(noindex ? { siteIndexing: "noindex" as const } : {}),
      },
    }),
  ],
});
`,
  );
  writeFileSync(
    join(consumerDir, "vite.conflict-custom.config.ts"),
    `import { defineConfig } from "vite";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.conflict-custom.config";

const duplicate = (title, marker) => ({
  path: "/journal/tag/folio",
  title,
  description: "custom archive route " + marker,
  type: "website",
  body: "<main><h1>" + marker + "</h1></main>",
});

export default defineConfig({
  base: "/",
  plugins: [
    folio({
      contentDir: "content",
      config,
      staticRoutes: {
        sitemap: true,
        robots: true,
        // A consumer that writes its own routes owns the archive route. Two
        // routes for the same archive URL must never silently overwrite one.
        routes: () => [duplicate("Tag archive A", "A"), duplicate("Tag archive B", "B")],
      },
    }),
  ],
});
`,
  );
  writeFileSync(
    join(consumerDir, "folio.conflict-custom.config.ts"),
    `import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Consumer Journal",
  description: "Conflict fixture: custom duplicate archive route",
  siteUrl: ${JSON.stringify(siteUrl)},
  collections: [{ path: "/journal", title: "Journal", archive: true }],
});
`,
  );
  writeFileSync(
    join(consumerDir, "index.html"),
    `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Consumer</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`,
  );
  mkdirSync(join(consumerDir, "src"), { recursive: true });
  writeFileSync(
    join(consumerDir, "src", "main.tsx"),
    `import { createRoot } from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import docs from "virtual:folio/content";
import config from "../folio.config";

createRoot(document.getElementById("root")!).render(
  <FolioApp docs={docs as FolioDoc[]} config={config} basePath={import.meta.env.BASE_URL} />,
);
`,
  );
  writeFixture(
    "content/journal/alpha.md",
    `title: Alpha engineering
type: article
category: 工程实践
tags: [Folio, Git]
date: 2026-03-01`,
  );
  writeFixture(
    "content/journal/beta.md",
    `title: Beta content model
type: article
category: 内容模型
tags: [Folio]
date: 2026-02-01`,
  );
  writeFixture(
    "content/journal/gamma.md",
    `title: Gamma uncategorized
type: article
date: 2026-01-01`,
  );
  writeFixture(
    "content/notes/one.md",
    `title: Note one
type: article
category: Frontend
tags: [React, 中文标签]
date: 2026-04-01`,
  );
  writeFixture(
    "content/notes/two.md",
    `title: Note two
type: article
category: frontend
tags: [react]
date: 2026-03-15`,
  );
  writeFixture(
    "content/notes/three.md",
    `title: Note three
type: article
tags: ["", "  "]
date: 2026-02-15`,
  );
  writeFixture(
    "content/docs/guide.md",
    `title: Docs guide
type: doc
category: Frontend
tags: [React]`,
  );
  writeFixture(
    "content/docs/note.md",
    `title: Docs note
type: page`,
  );
  // Conflict fixture (a): a document occupies the would-be archive route.
  writeFixture(
    "content-conflict-doc/journal/category/工程实践.md",
    `title: Colliding doc
type: doc`,
  );
  // Copy the base content so conflict builds do not need a new npm install.
  for (const file of walkFiles(contentDir)) {
    const target = join(consumerDir, "content-conflict-doc", ...file.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(contentDir, ...file.split("/"))));
  }
}

function build(outDir, env = {}) {
  return reporter.run(
    process.execPath,
    [join(consumerDir, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", outDir, "--emptyOutDir"],
    { cwd: consumerDir, env: { ...npmEnv(), ...env }, allowFailure: true, tailLines: 20 },
  );
}

async function loadInstalledApi() {
  const entry = join(consumerDir, "node_modules", "@uichat-mira", "folio", "dist", "index.js");
  return import(`${pathToFileURL(entry).href}?v=${Date.now()}`);
}

function parseConsumerDocs(api, root) {
  return walkFiles(root, (path) => path.endsWith(".md")).map((file) =>
    api.parseFolioDoc(file, readFileSync(join(root, ...file.split("/")), "utf8")),
  );
}

function expectedArchives(api, docs, collection) {
  const selected = api.selectFolioCollectionDocs(docs, collection.path);
  const index = api.buildFolioArticleArchiveIndex(selected, collection.archive);
  return [
    ...index.categories.map((group) => ({ kind: "category", group })),
    ...index.tags.map((group) => ({ kind: "tag", group })),
  ].map(({ kind, group }) => ({
    ...group,
    kind,
    collectionPath: collection.path,
    route: `${collection.path}/${kind}/${group.slug}`,
  }));
}

function headField(html, pattern, label) {
  const match = pattern.exec(html);
  assert.ok(match, `missing ${label}`);
  return match[1];
}

function parseEntryDetails(html) {
  const entries = [];
  for (const block of html.split('<div class="folio-entry">').slice(1)) {
    const link = /<a class="folio-entry-link" href="([^"]+)">([^<]+)<\/a>/.exec(block);
    entries.push({
      href: link?.[1],
      title: link?.[2],
      tags: [...block.matchAll(/<a class="folio-entry-tag" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => ({
        href: match[1],
        title: match[2],
      })),
    });
  }
  return entries;
}

async function main() {
  // -------------------------------------------------------------------------
  // Package tarball + isolated install.
  // -------------------------------------------------------------------------
  reporter.stage("tarball-and-install");
  if (!skipBuild) reporter.npm(["run", "build", "-w", "@uichat-mira/folio"]);
  const pack = reporter.npm(
    ["pack", "--ignore-scripts", "--pack-destination", tarballDir, "--json"],
    { cwd: packageRoot },
  );
  const packReport = JSON.parse(pack.stdout).at(-1);
  const tarballs = readdirSync(tarballDir).filter((file) => file.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  const tarballPath = join(tarballDir, tarballs[0]);
  reporter.results.artifacts.tarball = {
    fileName: tarballs[0],
    sha256: sha256(tarballPath),
    bytes: packReport.size,
    entryCount: packReport.entryCount,
    unpackedSize: packReport.unpackedSize,
    files: packReport.files.map((file) => file.path),
  };
  reporter.check("tarball-ships-public-entries", () => {
    const files = new Set(packReport.files.map((file) => file.path));
    for (const required of ["dist/index.js", "dist/index.d.ts", "dist/vite.js", "dist/vite.d.ts"]) {
      assert.ok(files.has(required), `tarball missing ${required}`);
    }
    assert.ok(![...files].some((file) => file.startsWith("src/") || file.startsWith("test/")));
    return reporter.results.artifacts.tarball;
  });

  writeConsumerSources();
  reporter.npm(
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--prefer-offline",
      tarballPath,
      "vite@^7",
      "@vitejs/plugin-react@^5",
      "react@^19",
      "react-dom@^19",
      "react-router-dom@^7",
      "typescript",
      "@types/react@^19",
      "@types/react-dom@^19",
      "@types/node@^24",
    ],
    { cwd: consumerDir },
  );

  reporter.check("tarball-installed-outside-the-repository-without-alias", () => {
    const installedRoot = join(consumerDir, "node_modules", "@uichat-mira", "folio");
    const stat = lstatSync(installedRoot);
    assert.equal(stat.isSymbolicLink(), false, "installed package is a symlink");
    const manifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
    assert.equal(manifest.version, JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version);
    const lock = JSON.parse(readFileSync(join(consumerDir, "package-lock.json"), "utf8"));
    const installed = lock.packages?.["node_modules/@uichat-mira/folio"];
    assert.ok(String(installed?.resolved).endsWith(".tgz"), `unexpected install source ${installed?.resolved}`);
    assert.ok(!String(installed?.resolved).includes("packages/folio"));
    assert.equal(sha256(join(installedRoot, "dist", "index.js")), sha256(join(packageRoot, "dist", "index.js")));
    return { version: manifest.version, resolved: installed.resolved, symlink: false };
  });

  const api = await loadInstalledApi();
  const docs = parseConsumerDocs(api, contentDir);
  const archives = collectionSpecs
    .filter((collection) => collection.archive)
    .flatMap((collection) => expectedArchives(api, docs, collection));
  const archiveRoutes = archives.map((entry) => entry.route);
  const expectedRoutes = new Set([
    "/",
    "/404",
    ...collectionSpecs.map((collection) => collection.path),
    ...docs.map((doc) => doc.path),
    ...archiveRoutes,
  ]);
  reporter.results.artifacts.expected = {
    collections: collectionSpecs,
    docs: docs.map((doc) => ({ path: doc.path, type: doc.type, tags: doc.tags })),
    archives: archives.map((entry) => ({
      kind: entry.kind,
      route: entry.route,
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      docs: entry.docs.map((doc) => doc.path),
    })),
    routes: [...expectedRoutes].sort(),
  };
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Default static build with a GitHub-Pages-style base path.
  // -------------------------------------------------------------------------
  reporter.stage("consumer-static-build");
  const dist = join(consumerDir, "dist");
  const buildResult = build("dist", { CONSUMER_BASE: basePath });
  reporter.check("external-consumer-build-succeeds", () => {
    assert.equal(buildResult.status, 0, buildResult.stderr);
    return { routes: htmlRoutes(dist).length };
  });
  reporter.check("consumer-routes-derive-from-configured-collection-paths", () => {
    assert.deepEqual(htmlRoutes(dist).sort(), [...expectedRoutes].sort());
    assert.equal(htmlRoutes(dist).length, 20);
    assert.ok(archiveRoutes.every((route) => route.startsWith("/journal/") || route.startsWith("/notes/")));
    assert.ok(archiveRoutes.every((route) => !route.startsWith("/blogs")));
    assert.deepEqual(
      walkFiles(dist, (path) => path.startsWith("docs/category/") || path.startsWith("docs/tag/")),
      [],
      "archive-disabled /docs collection emitted archive pages",
    );
    return { routes: htmlRoutes(dist).length, archiveRoutes };
  });
  reporter.check("generated-archive-routes-are-unique", () => {
    // Generation cannot produce duplicate archive URLs: Core identities are
    // unique and slug collisions throw, collection paths are unique, and
    // category/tag are distinct path segments. This asserts the property on the
    // actual consumer route set; the duplicate-route build below proves the
    // writer-level guard for consumer-supplied routes.
    assert.equal(new Set(archiveRoutes).size, archiveRoutes.length);
    return archiveRoutes;
  });
  reporter.check("consumer-archive-metadata-canonical-and-base", () => {
    const rows = [];
    for (const entry of archives) {
      const html = readRoute(dist, `/${entry.route}`);
      const kindLabel = entry.kind === "category" ? "分类" : "标签";
      const collection = collectionSpecs.find((candidate) => candidate.path === entry.collectionPath);
      const title = headField(html, /<title>([^<]*)<\/title>/, `${entry.route} title`);
      const description = headField(html, /<meta name="description" content="([^"]*)">/, `${entry.route} description`);
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${entry.route} canonical`);
      assert.equal(title, `${kindLabel}：${entry.title} · Consumer Journal`);
      assert.equal(description, `${collection.title} · ${kindLabel}归档，共 ${entry.docs.length} 篇文章。`);
      assert.equal(canonical, `${siteUrl}${basePath}${entry.route.replace(/^\//, "")}/`);
      rows.push({ route: entry.route, title, canonical });
    }
    return rows;
  });
  reporter.check("consumer-archive-entry-lists-match-core-order", () => {
    for (const entry of archives) {
      const entries = parseEntryList(readRoute(dist, `/${entry.route}`));
      assert.deepEqual(
        entries.map((item) => item.href),
        entry.docs.map((doc) => `${basePath}${doc.path.replace(/^\//, "")}/`),
      );
      assert.deepEqual(entries.map((item) => item.title), entry.docs.map((doc) => doc.title));
    }
    return `${archives.length} archive lists match the installed package's Core index`;
  });
  reporter.check("consumer-shared-tag-spans-two-categories", () => {
    const folio = archives.find((entry) => entry.kind === "tag" && entry.id === "folio");
    assert.ok(folio, "the shared Folio tag is missing");
    assert.equal(folio.docs.length, 2);
    const categories = new Set(
      folio.docs.map(
        (doc) =>
          archives.find(
            (entry) => entry.kind === "category" && entry.docs.some((candidate) => candidate.path === doc.path),
          )?.id,
      ),
    );
    assert.deepEqual([...categories].sort(), ["内容模型", "工程实践"]);
    const entries = parseEntryDetails(readRoute(dist, "/journal/tag/folio"));
    assert.deepEqual(
      entries.map((entry) => entry.href),
      folio.docs.map((doc) => `${basePath}${doc.path.slice(1)}/`),
    );
    return { route: "/journal/tag/folio", categories: [...categories] };
  });
  reporter.check("consumer-collection-index-entry-points-and-disabled-collection", () => {
    for (const collection of collectionSpecs) {
      const html = readRoute(dist, collection.path);
      const chips = [...html.matchAll(/<a class="folio-archive-chip" href="([^"]+)">([^<]+)<\/a>/g)].map(
        (match) => match[1],
      );
      if (!collection.archive) {
        assert.deepEqual(chips, [], `${collection.path} unexpectedly has archive chips`);
        assert.doesNotMatch(html, /folio-entry-tag/);
        continue;
      }
      const expectedChips = archives
        .filter((entry) => entry.kind === "category" && entry.collectionPath === collection.path)
        .map((entry) => `${basePath}${entry.route.slice(1)}/`);
      assert.deepEqual(chips, expectedChips);
    }
    assert.deepEqual(
      walkFiles(dist, (path) => path.startsWith("docs/category/") || path.startsWith("docs/tag/")),
      [],
    );
    return "opted-in collections expose chips/tag links; /docs adds no archive pages, chips or tag links";
  });
  reporter.check("consumer-sitemap-and-cjk-urls-are-consistent", () => {
    const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
    const locs = parseLocs(sitemap);
    const expectedLocs = [...expectedRoutes]
      .filter((route) => route !== "/404")
      .map((route) => (route === "/" ? `${siteUrl}${basePath}` : `${siteUrl}${basePath}${route.slice(1)}/`))
      .sort();
    assert.deepEqual(locs.slice().sort(), expectedLocs);
    assert.equal(locs.length, 19);
    const cjk = locs.filter((loc) => /工程实践|中文标签|内容模型/.test(loc));
    assert.ok(cjk.length >= 3);
    for (const loc of cjk) {
      assert.ok(!loc.includes("%"), `percent-encoded CJK in sitemap: ${loc}`);
      const route = loc.slice(`${siteUrl}${basePath}`.length - 1).replace(/\/$/, "");
      const html = readRoute(dist, route);
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${route} canonical`);
      assert.equal(canonical, loc, `canonical/sitemap mismatch for ${route}`);
      const collectionPath = route.split(/\/(?:category|tag)\//)[0];
      assert.ok(
        readRoute(dist, collectionPath).includes(`href="${basePath}${route.slice(1)}/"`),
        `static archive entry point missing for ${route}`,
      );
    }
    return { locs: locs.length, cjk };
  });
  reporter.check("consumer-robots-and-not-found", () => {
    const robots = readFileSync(join(dist, "robots.txt"), "utf8");
    assertIncludes(robots, `Sitemap: ${siteUrl}${basePath}sitemap.xml`, "consumer robots sitemap");
    assertIncludes(readRoute(dist, "/404"), 'content="noindex,nofollow"', "consumer 404 robots");
    return "robots.txt advertises the base-prefixed sitemap; 404 is noindex";
  });

  const server = await startServer(dist, { base: basePath });
  await reporter.checkAsync("consumer-archive-pages-directly-fetchable-from-served-dist", async () => {
    const results = [];
    for (const entry of archives) {
      const url = `${server.origin}${basePath}${entry.route.slice(1)}/`;
      const response = await fetch(encodeURI(url));
      assert.equal(response.status, 200, `${entry.route} -> ${response.status}`);
      const html = await response.text();
      const entries = parseEntryList(html);
      assert.deepEqual(
        entries.map((item) => item.href),
        entry.docs.map((doc) => `${basePath}${doc.path.slice(1)}/`),
      );
      results.push({ route: entry.route, bytes: html.length, entries: entries.length });
    }
    const outside = await fetch(`${server.origin}${archives[0].route}/`);
    assert.equal(outside.status, 404, "URL outside the base resolved");
    const disabled = await fetch(`${server.origin}${basePath}docs/category/frontend/`);
    assert.equal(disabled.status, 404, "archive-disabled collection served an archive page");
    return { fetched: results.length, outsideBaseStatus: outside.status, disabledStatus: disabled.status };
  });
  await server.close();
  reporter.endStage();

  // -------------------------------------------------------------------------
  // siteIndexing: "noindex" preview build.
  // -------------------------------------------------------------------------
  reporter.stage("consumer-noindex");
  const noindexDist = join(consumerDir, "dist-noindex");
  const noindexBuild = build("dist-noindex", { CONSUMER_NOINDEX: "1" });
  reporter.check("noindex-build-succeeds-and-keeps-archive-pages", () => {
    assert.equal(noindexBuild.status, 0, noindexBuild.stderr);
    assert.deepEqual(htmlRoutes(noindexDist).sort(), [...expectedRoutes].sort());
    return "20 routes still emitted";
  });
  reporter.check("noindex-applies-to-archive-pages-and-unadvertises-the-sitemap", () => {
    for (const entry of archives) {
      const html = readRoute(noindexDist, `/${entry.route}`);
      assert.equal(
        headField(html, /<meta name="robots" content="([^"]*)">/, `${entry.route} robots`),
        "noindex,nofollow",
      );
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${entry.route} canonical`);
      assert.equal(canonical, `${siteUrl}${entry.route}/`, "canonical must not change under noindex");
    }
    const robots = readFileSync(join(noindexDist, "robots.txt"), "utf8");
    assert.doesNotMatch(robots, /^Sitemap:/m, "preview robots.txt advertises the sitemap");
    assertIncludes(robots, "Allow: /", "preview robots.txt must keep crawling allowed");
    const sitemap = readFileSync(join(noindexDist, "sitemap.xml"), "utf8");
    assert.ok(sitemap.includes("/journal/category/工程实践/"), "sitemap lost the archive loc");
    return "every archive page is noindex,nofollow; sitemap exists but robots.txt no longer advertises it";
  });
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Public types from the tarball.
  // -------------------------------------------------------------------------
  reporter.stage("consumer-types");
  writeFileSync(
    join(consumerDir, "verify-types.ts"),
    `import {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  folioArticleArchiveSlug,
  parseFolioDoc,
  type FolioArticleArchiveConfig,
  type FolioArticleArchiveGroup,
  type FolioArticleArchiveIndex,
  type FolioCollectionConfig,
  type FolioConfig,
  type FolioDoc,
} from "@uichat-mira/folio";
import { folio, type FolioStaticBuildOptions } from "@uichat-mira/folio/vite";

const raw = "---\\ntitle: Typed\\ntype: article\\ncategory: 工程实践\\ntags: [Folio]\\n---\\nbody";
const docs: FolioDoc[] = [parseFolioDoc("journal/typed.md", raw)];
const archive: FolioArticleArchiveConfig = { categoryLabels: { 工程实践: "工程实践" } };
const collection: FolioCollectionConfig = { path: "/journal", title: "Journal", archive };
const config: FolioConfig = { title: "Typed", description: "Typed consumer", collections: [collection] };
const index: FolioArticleArchiveIndex = buildFolioArticleArchiveIndex(docs, collection.archive);
const group: FolioArticleArchiveGroup | undefined = findFolioArticleArchiveGroup(index, "category", "工程实践");
const slug: string = folioArticleArchiveSlug("工程实践");
const options: FolioStaticBuildOptions = { sitemap: true, robots: true, siteIndexing: "noindex" };
void folio({ contentDir: "content", config, staticRoutes: options });
console.log(config.title, group?.title, slug, index.categories.length);
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
  const tsc = reporter.run(
    process.execPath,
    [join(consumerDir, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    { cwd: consumerDir, allowFailure: true },
  );
  reporter.check("public-types-and-entries-resolve-from-the-tarball", () => {
    assert.equal(tsc.status, 0, tsc.stdout || tsc.stderr);
    return "consumer tsc NodeNext + skipLibCheck=false resolved Core, config and /vite types";
  });
  const bareImport = reporter.run(
    process.execPath,
    ["--input-type=module", "-e", 'import { buildFolioArticleArchiveIndex, parseFolioDoc } from "@uichat-mira/folio"; const doc = parseFolioDoc("journal/a.md", "---\\ntitle: A\\ntype: article\\ncategory: 工程实践\\ntags: [Folio]\\n---\\nbody"); console.log(typeof buildFolioArticleArchiveIndex, buildFolioArticleArchiveIndex([doc]).categories[0].slug);'],
    { cwd: consumerDir, allowFailure: true },
  );
  reporter.check("bare-public-entry-import-works-in-the-consumer", () => {
    assert.equal(bareImport.status, 0, bareImport.stderr);
    assert.match((bareImport.stdout ?? "").trim(), /^function 工程实践$/);
    return (bareImport.stdout ?? "").trim();
  });
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Build-time conflict failures.
  // -------------------------------------------------------------------------
  reporter.stage("consumer-conflicts");
  const conflictDoc = build("dist-conflict-doc", { CONSUMER_BASE: "/", CONSUMER_CONTENT: "content-conflict-doc" });
  reporter.check("document-archive-route-collision-fails-the-build", () => {
    assert.notEqual(conflictDoc.status, 0);
    const output = `${conflictDoc.stdout ?? ""}${conflictDoc.stderr ?? ""}`;
    assert.match(output, /folio article archive route conflict/);
    assert.match(output, /\/journal\/category\/工程实践/);
    assert.match(output, /conflicts with document/);
    assert.ok(!existsSync(join(consumerDir, "dist-conflict-doc", "journal", "category", "工程实践", "index.html")));
    return output.split("\n").find((line) => line.includes("folio article archive route conflict"));
  });

  const conflictCollection = build("dist-conflict-collection", {
    CONSUMER_BASE: "/",
    CONSUMER_CONFIG: "folio.conflict-collection.config.ts",
  });
  reporter.check("collection-index-archive-route-collision-fails-the-build", () => {
    assert.notEqual(conflictCollection.status, 0);
    const output = `${conflictCollection.stdout ?? ""}${conflictCollection.stderr ?? ""}`;
    assert.match(output, /folio article archive route conflict/);
    assert.match(output, /conflicts with collection index/);
    assert.ok(!existsSync(join(consumerDir, "dist-conflict-collection", "journal", "category", "工程实践", "index.html")));
    return output.split("\n").find((line) => line.includes("folio article archive route conflict"));
  });

  const duplicateRoute = reporter.run(
    process.execPath,
    [
      join(consumerDir, "node_modules", "vite", "bin", "vite.js"),
      "build",
      "--config",
      "vite.conflict-custom.config.ts",
      "--outDir",
      "dist-conflict-custom",
      "--emptyOutDir",
    ],
    { cwd: consumerDir, env: { ...npmEnv(), CONSUMER_BASE: "/" }, allowFailure: true },
  );
  reporter.check("duplicate-custom-archive-route-fails-the-build", () => {
    assert.notEqual(duplicateRoute.status, 0);
    const output = `${duplicateRoute.stdout ?? ""}${duplicateRoute.stderr ?? ""}`;
    assert.match(output, /folio static route conflict/);
    assert.match(output, /\/journal\/tag\/folio/);
    assert.ok(!existsSync(join(consumerDir, "dist-conflict-custom", "journal", "tag", "folio", "index.html")));
    return output.split("\n").find((line) => line.includes("folio static route conflict"));
  });
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Real Chrome: React archive pages in the external consumer, and no-JS.
  // -------------------------------------------------------------------------
  reporter.stage("consumer-browser");
  mkdirSync(screenshotsDir, { recursive: true });
  const browserServer = await startServer(dist, { base: basePath });
  const chrome = await launchChrome({ windowSize: "1440,900" });
  const shots = {};
  try {
    const page = await openPage(chrome.cdp, { width: 1440, height: 900 });
    const categoryRoute = "/journal/category/工程实践";
    await goto(chrome.cdp, page.sessionId, `${browserServer.origin}${basePath}${encodeURI(categoryRoute.slice(1))}/`);
    await poll(chrome.cdp, page.sessionId, "!!document.querySelector('.folio-archive-page')", {
      label: "consumer React category archive",
    });
    const category = await evaluate(
      chrome.cdp,
      page.sessionId,
      `(() => ({
        h1: document.querySelector('h1')?.textContent,
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        tags: [...document.querySelectorAll('.folio-entry-tag')].map(a => a.getAttribute('href')),
      }))()`,
    );
    const normalizeHref = (href) => (href === "/" ? "/" : href.replace(/\/+$/, ""));
    reporter.check("consumer-react-archive-matches-static-and-core", () => {
      const expected = archives.find((entry) => entry.route === categoryRoute);
      assert.equal(category.h1, expected.title);
      assert.deepEqual(
        category.entries.map((entry) => ({ href: normalizeHref(entry.href), title: entry.title })),
        parseEntryList(readRoute(dist, categoryRoute)).map((entry) => ({
          href: normalizeHref(entry.href),
          title: entry.title,
        })),
      );
      assert.deepEqual(
        category.entries.map((entry) => normalizeHref(entry.href)),
        expected.docs.map((doc) => normalizeHref(`${basePath}${doc.path.slice(1)}`)),
      );
      return { route: categoryRoute, entries: category.entries.length };
    });
    shots.consumerCategory = await screenshot(
      chrome.cdp,
      page.sessionId,
      join(screenshotsDir, "consumer-category.png"),
    );

    await goto(chrome.cdp, page.sessionId, `${browserServer.origin}${basePath}journal/tag/folio/`);
    await poll(chrome.cdp, page.sessionId, "!!document.querySelector('.folio-archive-page')", {
      label: "consumer React shared-tag archive",
    });
    const tag = await evaluate(
      chrome.cdp,
      page.sessionId,
      `(() => ({
        h1: document.querySelector('h1')?.textContent,
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
      }))()`,
    );
    reporter.check("consumer-react-shared-tag-page-matches-static", () => {
      const expected = archives.find((entry) => entry.route === "/journal/tag/folio");
      assert.equal(tag.h1, "Folio");
      assert.deepEqual(
        tag.entries.map((entry) => ({ href: normalizeHref(entry.href), title: entry.title })),
        parseEntryList(readRoute(dist, "/journal/tag/folio")).map((entry) => ({
          href: normalizeHref(entry.href),
          title: entry.title,
        })),
      );
      assert.deepEqual(
        tag.entries.map((entry) => normalizeHref(entry.href)),
        expected.docs.map((doc) => normalizeHref(`${basePath}${doc.path.slice(1)}`)),
      );
      return { entries: tag.entries.length };
    });
    shots.consumerTag = await screenshot(
      chrome.cdp,
      page.sessionId,
      join(screenshotsDir, "consumer-tag.png"),
    );

    const noJs = await openPage(chrome.cdp, { width: 1440, height: 900 });
    await chrome.cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, noJs.sessionId);
    await goto(chrome.cdp, noJs.sessionId, `${browserServer.origin}${basePath}${encodeURI(categoryRoute.slice(1))}/`);
    const noJsResult = await evaluate(
      chrome.cdp,
      noJs.sessionId,
      `(() => ({
        page: !!document.querySelector('.folio-archive-page'),
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => a.getAttribute('href')),
      }))()`,
    );
    reporter.check("consumer-static-archive-works-without-javascript", () => {
      const expected = archives.find((entry) => entry.route === categoryRoute);
      assert.equal(noJsResult.page, true);
      assert.deepEqual(
        noJsResult.entries,
        expected.docs.map((doc) => `${basePath}${doc.path.slice(1)}/`),
      );
      return noJsResult;
    });
    shots.consumerNoJs = await screenshot(
      chrome.cdp,
      noJs.sessionId,
      join(screenshotsDir, "consumer-nojs-category.png"),
    );
    reporter.check("external-consumer-browser-has-no-page-exceptions", () => {
      const exceptions = chrome.consoleEntries.filter((entry) => entry.type === "exception");
      assert.deepEqual(exceptions, []);
      return { browser: chrome.browserVersion, consoleEntries: chrome.consoleEntries.length };
    });
  } finally {
    await chrome.stop();
    await browserServer.close();
  }
  reporter.results.artifacts.screenshots = shots;
  reporter.endStage();
}

let failure;
try {
  await main();
} catch (error) {
  failure = error;
} finally {
  if (!keepTemp) rmSync(consumerRoot, { recursive: true, force: true });
  else reporter.results.artifacts.consumerRoot = consumerRoot;
}
const summary = reporter.write("consumer.json");
if (failure) {
  console.error(`\nFAILED: ${failure.message}`);
  process.exitCode = 1;
} else if (summary.failed) {
  process.exitCode = 1;
}
