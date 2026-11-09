#!/usr/bin/env node
// FOL-041 (#163) independent site-side acceptance harness.
//
// Proves on the official site build (a real consumer of the package):
//   1. Markdown -> Frontmatter -> Core archive index -> React route/entry points,
//      with client-side navigation and keyboard access in real headless Chrome;
//   2. Core archive index -> static HTML/title/description/canonical/sitemap and
//      no-JS direct access, for the root and GitHub-Pages /folio/ base;
//   3. an opt-in differential: the same site built with /blogs archives disabled
//      adds exactly the 13 archive routes and only touches /blogs + article meta;
//   4. regression checks for existing routes, search and absent feeds.
//
// Usage:
//   node docs/research/fol-041/verify-site.mjs [--skip-build]
//
// Results: docs/research/fol-041/results/site.json
// Screenshots: docs/research/fol-041/results/screenshots/*.png
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  pressEnter,
  pressTab,
  readRoute,
  routeFile,
  screenshot,
  screenshotsDir,
  setViewport,
  startServer,
  siteRoot,
  packageRoot,
  posix,
  repoRoot,
  walkFiles,
  tempDir,
  symlinkNodeModules,
} from "./lib.mjs";

const skipBuild = process.argv.includes("--skip-build");
const dist = join(siteRoot, "dist");
const contentRoot = join(siteRoot, "content");
const siteUrlExpected = "https://uichat-mira.github.io";
const basePath = "/folio/";

const reporter = new Reporter({
  name: "fol-041-site",
  purpose:
    "FOL-041 (#163) independent verification: official site React/static archives, base path, opt-in differential and regressions",
  harness: "docs/research/fol-041/verify-site.mjs",
});

function parseEntryDetails(html) {
  const entries = [];
  for (const block of html.split('<div class="folio-entry">').slice(1)) {
    const link = /<a class="folio-entry-link" href="([^"]+)">([^<]+)<\/a>/.exec(block);
    const tags = [...block.matchAll(/<a class="folio-entry-tag" href="([^"]+)">([^<]+)<\/a>/g)].map(
      (match) => ({ href: match[1], title: match[2] }),
    );
    entries.push({ href: link?.[1], title: link?.[2], tags });
  }
  return entries;
}

function headField(html, pattern, label) {
  const match = pattern.exec(html);
  assert.ok(match, `missing ${label}`);
  return match[1];
}

function parseSiteConfig() {
  const source = readFileSync(join(siteRoot, "folio.config.ts"), "utf8");
  const collections = [...source.matchAll(/\{\s*path:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g)].map(
    (match) => ({ path: match[1], title: match[2] }),
  );
  return {
    title: /^  title:\s*"([^"]+)"/m.exec(source)?.[1],
    description: /^  description:\s*"([^"]+)"/m.exec(source)?.[1],
    siteUrl: /siteUrl:\s*"([^"]+)"/.exec(source)?.[1],
    collections,
    blogsArchive: /path:\s*"\/blogs"[\s\S]*?archive:\s*true/.test(source),
  };
}

function expectedArchiveTitleRaW(group) {
  return `${group.kind === "category" ? "分类" : "标签"}：${group.title}`;
}

async function main() {
  const siteConfig = parseSiteConfig();
  reporter.results.artifacts.siteConfig = siteConfig;
  assert.equal(siteConfig.siteUrl, siteUrlExpected);
  assert.equal(siteConfig.blogsArchive, true, "the official /blogs collection must opt in");

  // -------------------------------------------------------------------------
  // Build the package and the official site (root base).
  // -------------------------------------------------------------------------
  reporter.stage("official-site-build");
  if (!skipBuild) {
    reporter.npm(["run", "build", "-w", "@uichat-mira/folio"]);
    reporter.npm(["run", "build", "-w", "@uichat-mira/folio-site"]);
  }
  reporter.check("package-and-site-build-produced-output", () => {
    assert.ok(existsSync(join(packageRoot, "dist", "index.js")));
    assert.ok(existsSync(join(dist, "index.html")));
    return "packages/folio/dist + apps/site/dist exist";
  });

  const siteApi = await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href);
  const contentFiles = walkFiles(contentRoot, (path) => path.endsWith(".md"));
  const docs = contentFiles.map((file) =>
    siteApi.parseFolioDoc(file, readFileSync(join(contentRoot, file), "utf8")),
  );
  const blogsDocs = siteApi.selectFolioCollectionDocs(docs, "/blogs");
  const blogsIndex = siteApi.buildFolioArticleArchiveIndex(blogsDocs, true);
  const archiveRoutes = [
    ...blogsIndex.categories.map((group) => ({
      kind: "category",
      group,
      route: `/blogs/category/${group.slug}`,
    })),
    ...blogsIndex.tags.map((group) => ({ kind: "tag", group, route: `/blogs/tag/${group.slug}` })),
  ];
  const collectionPaths = siteConfig.collections.map((collection) => collection.path);
  const expectedRouteSet = new Set([
    "/",
    "/404",
    ...collectionPaths,
    ...docs.map((doc) => doc.path),
    ...archiveRoutes.map((entry) => entry.route),
  ]);
  reporter.results.artifacts.expected = {
    docs: docs.length,
    articles: docs.filter((doc) => doc.type === "article").length,
    collections: siteConfig.collections,
    categories: blogsIndex.categories.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      docs: group.docs.map((doc) => doc.path),
    })),
    tags: blogsIndex.tags.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      docs: group.docs.map((doc) => doc.path),
    })),
    routes: [...expectedRouteSet].sort(),
  };
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Static output: route set, archive content/metadata, sitemap, regressions.
  // -------------------------------------------------------------------------
  reporter.stage("static-root-output");
  const builtRoutes = htmlRoutes(dist);

  reporter.check("route-set-matches-core-expectation", () => {
    assert.deepEqual(builtRoutes.slice().sort(), [...expectedRouteSet].sort());
    assert.equal(builtRoutes.length, 63, "official site must emit 63 routes (50 existing + 13 archive)");
    return { routes: builtRoutes.length, archives: archiveRoutes.length };
  });

  reporter.check("archive-pages-exist-for-every-core-group", () => {
    for (const { route } of archiveRoutes) {
      assert.ok(existsSync(routeFile(dist, route)), `missing archive page ${route}`);
    }
    return `${archiveRoutes.length} archive pages`;
  });

  reporter.check("archive-page-metadata-matches-core", () => {
    const rows = [];
    for (const { kind, group, route } of archiveRoutes) {
      const html = readRoute(dist, route);
      const title = headField(html, /<title>([^<]*)<\/title>/, `${route} title`);
      const description = headField(html, /<meta name="description" content="([^"]*)">/, `${route} description`);
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${route} canonical`);
      const robots = headField(html, /<meta name="robots" content="([^"]*)">/, `${route} robots`);
      assert.equal(title, `${expectedArchiveTitleRaW(group)} · Folio`);
      assert.equal(description, `博客 · ${kind === "category" ? "分类" : "标签"}归档，共 ${group.docs.length} 篇文章。`);
      assert.equal(canonical, `${siteUrlExpected}${route}/`);
      assert.equal(robots, "index,follow");
      assertIncludes(html, `${kind === "category" ? "CATEGORY" : "TAG"} ARCHIVE · ${group.docs.length} ARTICLES`, `${route} kicker`);
      rows.push({ route, title, canonical, count: group.docs.length });
    }
    return rows;
  });

  reporter.check("archive-entry-list-matches-core-order-and-links", () => {
    for (const { group, route } of archiveRoutes) {
      const html = readRoute(dist, route);
      const entries = parseEntryList(html);
      assert.deepEqual(
        entries.map((entry) => entry.href),
        group.docs.map((doc) => doc.path),
        `${route} entry links/order differ from Core`,
      );
      assert.deepEqual(
        entries.map((entry) => entry.title),
        group.docs.map((doc) => doc.title),
        `${route} entry titles differ from Core`,
      );
      assertIncludes(html, `共 ${group.docs.length} 篇文章`, `${route} visible count`);
      assertIncludes(html, `href="/blogs"`, `${route} back link`);
    }
    return `${archiveRoutes.length} archive entry lists match the Core index exactly`;
  });

  reporter.check("category-entry-row-and-tag-links-on-collection-index", () => {
    const html = readRoute(dist, "/blogs");
    const chips = [...html.matchAll(/<a class="folio-archive-chip" href="([^"]+)">([^<]+)<\/a>/g)].map(
      (match) => ({ href: match[1], title: match[2] }),
    );
    assert.deepEqual(
      chips.map((chip) => ({ href: chip.href, title: chip.title })),
      blogsIndex.categories.map((group) => ({ href: `/blogs/category/${group.slug}`, title: group.title })),
    );
    const entries = parseEntryDetails(html);
    const expectedEntries = siteApi.selectFolioCollectionDocs(docs, "/blogs");
    assert.deepEqual(entries.map((entry) => entry.href), expectedEntries.map((doc) => doc.path));
    for (const entry of entries) {
      const doc = expectedEntries.find((candidate) => candidate.path === entry.href);
      // Tag links follow the Core route order (tag groups sorted by slug), not
      // the frontmatter declaration order.
      const expectedTags = blogsIndex.tags
        .filter((group) => group.docs.some((candidate) => candidate.path === doc.path))
        .map((group) => ({ href: `/blogs/tag/${group.slug}`, title: group.title }));
      assert.deepEqual(entry.tags, expectedTags, `tag links differ for ${doc.path}`);
    }
    return { chips: chips.length, entries: entries.length };
  });

  reporter.check("article-pages-expose-tag-links-without-changing-urls", () => {
    const articles = docs.filter((doc) => doc.type === "article");
    for (const article of articles) {
      const html = readRoute(dist, article.path);
      const tags = [...html.matchAll(/<a class="folio-article-tag" href="([^"]+)">([^<]+)<\/a>/g)].map(
        (match) => ({ href: match[1], title: match[2] }),
      );
      const expectedTags = blogsIndex.tags
        .filter((group) => group.docs.some((doc) => doc.path === article.path))
        .map((group) => ({ href: `/blogs/tag/${group.slug}`, title: group.title }));
      assert.deepEqual(tags, expectedTags, `article tag links differ for ${article.path}`);
    }
    return `${articles.length} article pages keep their URLs and gain tag links`;
  });

  reporter.check("archive-links-are-not-injected-into-header", () => {
    for (const route of ["/blogs", "/blogs/category/工程实践", "/blogs/tag/folio"]) {
      const html = readRoute(dist, route);
      const start = html.indexOf("<header");
      assert.ok(start >= 0, `${route} has no hero header to inspect`);
      const header = html.slice(start, html.indexOf("</header>", start));
      assert.doesNotMatch(header, /\/blogs\/(?:category|tag)\//, `${route} header contains archive links`);
      assert.doesNotMatch(header, /folio-archive-chip|folio-entry-tag/, `${route} header contains archive chips`);
    }
    return "collection/article/archive headers contain no category/tag archive entry points";
  });

  reporter.check("sitemap-lists-exactly-the-generated-routes", () => {
    const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
    const locs = parseLocs(sitemap);
    const expected = [...expectedRouteSet]
      .filter((route) => route !== "/404")
      .map((route) => `${siteUrlExpected}${route === "/" ? "/" : `${route}/`}`)
      .sort();
    assert.deepEqual(locs.slice().sort(), expected);
    assert.equal(locs.length, 62);
    const archiveLocs = locs.filter((loc) => /\/blogs\/(?:category|tag)\//.test(loc));
    assert.equal(archiveLocs.length, 13);
    for (const loc of archiveLocs) {
      assert.match(loc, /工程实践|内容模型|\/blogs\/tag\/[a-z-]+/u);
      assert.ok(decodeURIComponent(encodeURI(loc)) === loc, "sitemap loc must be raw UTF-8, not percent-encoded");
    }
    return { locs: locs.length, archiveLocs: archiveLocs.length, sample: archiveLocs.slice(0, 3) };
  });

  reporter.check("robots-and-not-found-unchanged", () => {
    const robots = readFileSync(join(dist, "robots.txt"), "utf8");
    assert.equal(robots, "User-agent: *\nAllow: /\nSitemap: https://uichat-mira.github.io/sitemap.xml\n");
    const notFound = readRoute(dist, "/404");
    assertIncludes(notFound, 'content="noindex,nofollow"', "404 robots");
    return "robots.txt advertises the sitemap; 404 stays noindex,nofollow";
  });

  reporter.check("existing-document-routes-and-home-regression", () => {
    for (const doc of docs) {
      assert.ok(existsSync(routeFile(dist, doc.path)), `existing document route missing: ${doc.path}`);
      const html = readRoute(dist, doc.path);
      const title = headField(html, /<title>([^<]*)<\/title>/, `${doc.path} title`);
      assert.equal(title, `${doc.title} · Folio`, `title changed for ${doc.path}`);
    }
    const home = readRoute(dist, "/");
    assertIncludes(home, siteConfig.title, "home title");
    assertIncludes(home, "/blogs", "home collection link");
    assertIncludes(home, "/guide/getting-started", "home guide link");
    return `${docs.length} existing document routes still exist with unchanged titles; home links intact`;
  });

  reporter.check("feeds-remain-absent-and-search-is-unchanged", () => {
    const feedFiles = walkFiles(dist, (path) => /(?:^|\/)(?:rss|atom|feeds\/[^/]+)\.xml$/.test(path));
    assert.deepEqual(feedFiles, [], "the official site now emits feed files it did not configure");
    const blogHtml = readRoute(dist, "/blogs");
    assert.doesNotMatch(blogHtml, /rel="alternate"[^>]+(?:rss|atom)/i, "unexpected feed discovery link");
    // Search keeps its documented fields; a category is not a search dimension.
    const synthetic = siteApi.parseFolioDoc(
      "blogs/search-probe.md",
      "---\ntitle: Search probe\ntype: article\ncategory: ZZOnlyCategory\ntags: [ZZOnlyTag]\n---\nbody\n",
    );
    assert.deepEqual(siteApi.searchFolioDocs([synthetic], "ZZOnlyCategory"), [], "category leaked into search");
    assert.equal(siteApi.searchFolioDocs([synthetic], "ZZOnlyTag").length, 1, "tag search regressed");
    assert.ok(
      siteApi.searchFolioDocs(docs, "Folio", 50).some((doc) => doc.path === "/blogs/why-folio"),
      "existing title search regressed",
    );
    return "no feeds emitted (same as baseline); tags searchable, category not a search field";
  });

  reporter.check("cjk-slugs-are-consistent-across-static-surfaces", () => {
    const rows = [];
    for (const { group, route } of archiveRoutes) {
      if (!/[\u4e00-\u9fff]/.test(group.slug)) continue;
      const html = readRoute(dist, route);
      const entryHrefs = [...html.matchAll(/<a class="folio-entry-link" href="([^"]+)"/g)].map((m) => m[1]);
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${route} canonical`);
      const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
      assert.ok(entryHrefs.every((href) => !/%/.test(href)), `${route} static href is percent-encoded`);
      assert.ok(canonical.includes(route), `${route} canonical mismatch`);
      assert.ok(sitemap.includes(`${siteUrlExpected}${route}/`), `${route} missing from sitemap as raw UTF-8`);
      rows.push({ route, canonical, entryHrefs });
    }
    assert.ok(rows.length >= 2, "expected at least two CJK archive slugs");
    return rows;
  });
  reporter.endStage();

  // -------------------------------------------------------------------------
  // GitHub-Pages-style sub-path build.
  // -------------------------------------------------------------------------
  reporter.stage("static-subpath-output");
  const subpathRoot = tempDir("folio041-subpath-");
  const subpathDist = join(subpathRoot, "dist");
  reporter.node([join(repoRoot, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", subpathDist, "--emptyOutDir"], {
    cwd: siteRoot,
    env: { FOLIO_SITE_BASE: basePath },
  });
  const subRoutes = htmlRoutes(subpathDist);

  reporter.check("subpath-build-emits-the-same-route-set", () => {
    assert.deepEqual(subRoutes.slice().sort(), builtRoutes.slice().sort());
    assert.equal(subRoutes.length, 63);
    return "63 routes under /folio/";
  });

  reporter.check("subpath-canonical-links-sitemap-and-assets-are-base-aware", () => {
    for (const { route } of archiveRoutes) {
      const html = readRoute(subpathDist, route);
      const canonical = headField(html, /<link rel="canonical" href="([^"]*)">/, `${route} canonical`);
      assert.equal(canonical, `${siteUrlExpected}${basePath}${route.slice(1)}/`);
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const value = match[1];
        if (!value.startsWith("/") || value.startsWith("//")) continue;
        assert.ok(value.startsWith(basePath), `${route} has a non-base URL ${value}`);
      }
    }
    const sitemap = readFileSync(join(subpathDist, "sitemap.xml"), "utf8");
    assert.ok(sitemap.includes(`${siteUrlExpected}${basePath}blogs/category/工程实践/`));
    const robots = readFileSync(join(subpathDist, "robots.txt"), "utf8");
    assertIncludes(robots, `Sitemap: ${siteUrlExpected}${basePath}sitemap.xml`, "subpath robots sitemap");
    return "canonical, internal links, sitemap and robots all use /folio/";
  });

  reporter.check("subpath-all-internal-links-resolve-to-built-files", () => {
    const broken = [];
    for (const route of subRoutes) {
      const html = readRoute(subpathDist, route);
      for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
        const href = match[1];
        if (!href.startsWith("/") || href.startsWith("//")) continue;
        if (!href.startsWith(basePath)) {
          broken.push({ route, href, reason: "missing base" });
          continue;
        }
        const inner = href.slice(basePath.length).split(/[?#]/, 1)[0];
        if (!inner || inner.includes("..")) continue;
        const target = join(subpathDist, decodeURIComponent(inner));
        if (
          !existsSync(target) &&
          !existsSync(join(target, "index.html")) &&
          !existsSync(`${target}.html`)
        ) {
          broken.push({ route, href, reason: "missing target" });
        }
      }
    }
    assert.deepEqual(broken, []);
    return "every internal href in the 63 subpath pages resolves";
  });

  const subpathServer = await startServer(subpathDist, { base: basePath });
  await reporter.checkAsync("subpath-static-archive-directly-fetchable-without-js", async () => {
    const encoded = encodeURI(`/folio/blogs/category/工程实践/`);
    const response = await fetch(`${subpathServer.origin}${encoded}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const entries = parseEntryList(html);
    const expectedGroup = blogsIndex.categories.find((group) => group.slug === "工程实践");
    assert.ok(expectedGroup, "the 工程实践 category is missing from the Core index");
    assert.deepEqual(
      entries.map((entry) => entry.href),
      expectedGroup.docs.map((doc) => `/folio${doc.path}`),
    );
    const outside = await fetch(`${subpathServer.origin}/blogs/category/工程实践/`);
    assert.equal(outside.status, 404, "URLs outside the base must not resolve");
    return { encoded, bytes: html.length, entries: entries.length };
  });
  await subpathServer.close();
  rmSync(subpathRoot, { recursive: true, force: true });
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Opt-in differential: same site with /blogs archive disabled.
  // -------------------------------------------------------------------------
  reporter.stage("opt-in-differential");
  const worktreeDir = "/tmp/folio041-disabled-worktree";
  rmSync(worktreeDir, { recursive: true, force: true });
  reporter.run("git", ["worktree", "add", "--detach", worktreeDir, "HEAD"], { cwd: repoRoot });
  let disabledDist;
  try {
    const configPath = join(worktreeDir, "apps", "site", "folio.config.ts");
    const original = readFileSync(configPath, "utf8");
    const patched = original.replace(
      /\n\s*\/\/ FOL-041 demo:[\s\S]*?\n\s*archive: true,/,
      "",
    );
    assert.notEqual(patched, original, "could not disable the /blogs archive in the temp worktree");
    writeFileSync(configPath, patched);
    symlinkNodeModules(worktreeDir);
    reporter.node(
      [join(repoRoot, "node_modules", "vite", "bin", "vite.js"), "build"],
      { cwd: join(worktreeDir, "apps", "site"), env: { FOLIO_SITE_BASE: "/" } },
    );
    disabledDist = join(worktreeDir, "apps", "site", "dist");
    assert.ok(existsSync(disabledDist));

    const strip = (html) =>
      html
        .replace(/assets\/[A-Za-z0-9_.-]+?-([A-Za-z0-9_-]{8,})\.(js|css)/g, "assets/HASH.$2")
        .replace(/assets\/index-[A-Za-z0-9_-]+\.(js|css)/g, "assets/index-HASH.$1")
        .replace(/<span class="folio-doc-meta__avatar"[^>]*>.*?<\/span>/g, '<span class="folio-doc-meta__avatar"></span>');

    reporter.check("archive-disabled-build-is-the-50-route-baseline", () => {
      const routes = htmlRoutes(disabledDist);
      const baseline = [
        "/",
        "/404",
        ...collectionPaths,
        ...docs.map((doc) => doc.path),
      ].sort();
      assert.deepEqual(routes.slice().sort(), baseline);
      assert.equal(routes.length, 50);
      assert.deepEqual(
        walkFiles(disabledDist, (path) => /\/blogs\/(?:category|tag)\//.test(path)),
        [],
        "archive files exist despite archive disabled",
      );
      return "50 routes, no category/tag directory";
    });

    reporter.check("disabled-build-has-no-archive-entry-points", () => {
      const blog = readRoute(disabledDist, "/blogs");
      assert.doesNotMatch(blog, /folio-archive-row|folio-entry-tag/);
      for (const doc of docs.filter((entry) => entry.type === "article")) {
        assert.doesNotMatch(readRoute(disabledDist, doc.path), /folio-article-tags/);
      }
      const sitemap = readFileSync(join(disabledDist, "sitemap.xml"), "utf8");
      assert.doesNotMatch(sitemap, /\/blogs\/(?:category|tag)\//);
      const home = readRoute(disabledDist, "/");
      assert.doesNotMatch(home, /\/blogs\/(?:category|tag)\//);
      return "no category row, tag links, archive sitemap entries or home archive links";
    });

    reporter.check("enabled-minus-disabled-is-exactly-the-archive-routes", () => {
      const enabled = new Set(htmlRoutes(dist));
      const disabled = new Set(htmlRoutes(disabledDist));
      const added = [...enabled].filter((route) => !disabled.has(route)).sort();
      const removed = [...disabled].filter((route) => !enabled.has(route)).sort();
      assert.deepEqual(removed, []);
      assert.deepEqual(
        added,
        archiveRoutes.map((entry) => entry.route).sort(),
        "archive opt-in added routes beyond the Core archive pages",
      );
      return { added: added.length };
    });

    reporter.check("non-archive-html-is-byte-identical-ignoring-env-noise", () => {
      const common = htmlRoutes(dist).filter((route) => !route.startsWith("/blogs/category/") && !route.startsWith("/blogs/tag/"));
      const differing = [];
      for (const route of common) {
        const left = strip(readRoute(dist, route));
        const right = strip(readRoute(disabledDist, route));
        if (left !== right) differing.push(route);
      }
      assert.deepEqual(differing.sort(), [
        "/blogs",
        "/blogs/content-stays-in-git",
        "/blogs/one-markdown-many-surfaces",
        "/blogs/reading-experience-structure",
        "/blogs/why-folio",
      ]);
      return {
        differing: differing.length,
        note: "only the collection index (category row + entry tag links) and the four article pages (tag nav) differ; hashed asset names and GitHub-API avatars are normalized as build-environment noise",
      };
    });

    reporter.check("global-header-and-existing-navigation-unchanged", () => {
      const headerOf = (html) => html.slice(0, html.indexOf("</header>"));
      for (const route of ["/", "/blogs", "/guide/introduction", "/reference/overview"]) {
        assert.equal(strip(headerOf(readRoute(dist, route))), strip(headerOf(readRoute(disabledDist, route))), `header changed on ${route}`);
      }
      return "home/collection/doc headers identical with archive on vs off";
    });
  } finally {
    reporter.run("git", ["worktree", "remove", "--force", worktreeDir], { cwd: repoRoot, allowFailure: true });
    rmSync(worktreeDir, { recursive: true, force: true });
    reporter.run("git", ["worktree", "prune"], { cwd: repoRoot, allowFailure: true });
  }
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Real headless Chrome: React routes, entry points, keyboard, mobile, no-JS.
  // -------------------------------------------------------------------------
  reporter.stage("browser-react-and-no-js");
  const server = await startServer(dist, { base: "/" });
  const chrome = await launchChrome({ windowSize: "1440,900" });
  mkdirSync(screenshotsDir, { recursive: true });
  const shots = {};
  try {
    const desktop = await openPage(chrome.cdp, { width: 1440, height: 900 });
    await goto(chrome.cdp, desktop.sessionId, `${server.origin}/blogs/`);
    await poll(chrome.cdp, desktop.sessionId, "!!document.querySelector('.folio-archive-row')", {
      label: "collection category row",
    });

    const entryPoints = await evaluate(
      chrome.cdp,
      desktop.sessionId,
      `(() => ({
        chips: [...document.querySelectorAll('.folio-archive-chip')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        tagLinks: [...document.querySelectorAll('.folio-entry-tag')].slice(0, 8).map(a => a.getAttribute('href')),
        headerArchiveLinks: [...document.querySelectorAll('header a')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/') && /\\/(category|tag)\\//.test(h)),
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
      }))()`,
    );
    reporter.check("react-collection-page-shows-category-row-and-tag-links", () => {
      assert.deepEqual(
        entryPoints.chips,
        blogsIndex.categories.map((group) => ({ href: `/blogs/category/${group.slug}`, title: group.title })),
      );
      assert.ok(entryPoints.tagLinks.length > 0);
      assert.deepEqual(entryPoints.headerArchiveLinks, [], "global header contains archive links");
      assert.deepEqual(
        entryPoints.entries.map((entry) => entry.href),
        siteApi.selectFolioCollectionDocs(docs, "/blogs").map((doc) => doc.path),
      );
      return { chips: entryPoints.chips, tagLinks: entryPoints.tagLinks.length, entries: entryPoints.entries.length };
    });
    shots.desktopBlogs = await screenshot(chrome.cdp, desktop.sessionId, join(screenshotsDir, "desktop-blogs-entrypoints.png"));

    const focusSequence = [];
    let chipFocused = false;
    for (let index = 0; index < 80; index += 1) {
      await pressTab(chrome.cdp, desktop.sessionId);
      const active = await evaluate(
        chrome.cdp,
        desktop.sessionId,
        `(() => { const el = document.activeElement; return el ? { tag: el.tagName, className: typeof el.className === 'string' ? el.className : '', href: el.getAttribute?.('href') ?? null } : null; })()`,
      );
      focusSequence.push(active);
      if (active?.href?.startsWith("/blogs/category/")) {
        chipFocused = true;
        break;
      }
    }
    await reporter.checkAsync("category-chip-is-keyboard-focusable-and-activatable", async () => {
      assert.ok(chipFocused, `never reached an archive chip by Tab; last=${JSON.stringify(focusSequence.slice(-3))}`);
      shots.desktopChipFocus = await screenshot(
        chrome.cdp,
        desktop.sessionId,
        join(screenshotsDir, "desktop-chip-focus.png"),
      );
      const before = await evaluate(chrome.cdp, desktop.sessionId, "performance.getEntriesByType('navigation').length");
      await pressEnter(chrome.cdp, desktop.sessionId);
      const navigated = await poll(
        chrome.cdp,
        desktop.sessionId,
        "location.pathname.includes('/category/') && !!document.querySelector('.folio-archive-page')",
        { label: "Enter on a focused category chip" },
      );
      const after = await evaluate(
        chrome.cdp,
        desktop.sessionId,
        `(() => ({
          nav: performance.getEntriesByType('navigation').length,
          path: location.pathname,
          h1: document.querySelector('h1')?.textContent,
          entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        }))()`,
      );
      assert.ok(navigated);
      assert.equal(before, 1);
      assert.equal(after.nav, 1, "keyboard activation performed a full document navigation");
      const focusedChipHref = focusSequence.find((entry) => entry?.href?.startsWith("/blogs/category/")).href;
      const group = archiveRoutes.find((entry) => entry.route === focusedChipHref).group;
      assert.equal(after.h1, group.title);
      assert.deepEqual(after.entries.map((entry) => entry.href), group.docs.map((doc) => doc.path));
      shots.desktopCategory = await screenshot(
        chrome.cdp,
        desktop.sessionId,
        join(screenshotsDir, "desktop-category.png"),
      );
      return { chip: focusedChipHref, clientNavigationEntries: after.nav, entries: after.entries.length };
    });

    await goto(chrome.cdp, desktop.sessionId, `${server.origin}/blogs/tag/folio/`);
    await poll(chrome.cdp, desktop.sessionId, "!!document.querySelector('.folio-archive-page')", {
      label: "tag archive page",
    });
    const tagPage = await evaluate(
      chrome.cdp,
      desktop.sessionId,
      `(() => ({
        h1: document.querySelector('h1')?.textContent,
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        activeNav: [...document.querySelectorAll('.folio-nav a, nav a')].filter(a => a.getAttribute('href') === location.pathname).length,
      }))()`,
    );
    reporter.check("react-tag-archive-spans-categories-and-matches-static", () => {
      const expected = blogsIndex.tags.find((group) => group.slug === "folio");
      assert.equal(tagPage.h1, "Folio");
      assert.deepEqual(tagPage.entries.map((entry) => entry.href), expected.docs.map((doc) => doc.path));
      const staticEntries = parseEntryList(readRoute(dist, "/blogs/tag/folio"));
      assert.deepEqual(tagPage.entries, staticEntries);
      const categories = new Set(
        expected.docs.map((doc) => blogsIndex.categories.find((group) => group.docs.includes(doc))?.id),
      );
      assert.ok(categories.size >= 2, "shared tag does not span two categories");
      return { entries: tagPage.entries.length, categories: [...categories] };
    });
    shots.desktopTag = await screenshot(chrome.cdp, desktop.sessionId, join(screenshotsDir, "desktop-tag.png"));

    await goto(chrome.cdp, desktop.sessionId, `${server.origin}/blogs/why-folio/`);
    const articleTags = await evaluate(
      chrome.cdp,
      desktop.sessionId,
      `[...document.querySelectorAll('.folio-article-tag')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() }))`,
    );
    await reporter.checkAsync("react-article-page-tag-link-navigates-without-reload", async () => {
      const whyFolio = docs.find((doc) => doc.path === "/blogs/why-folio");
      const whyFolioTags = blogsIndex.tags
        .filter((group) => group.docs.some((doc) => doc.path === whyFolio.path))
        .map((group) => ({ href: `/blogs/tag/${group.slug}`, title: group.title }));
      assert.deepEqual(articleTags, whyFolioTags);
      const before = await evaluate(chrome.cdp, desktop.sessionId, "performance.getEntriesByType('navigation').length");
      await evaluate(chrome.cdp, desktop.sessionId, "document.querySelector('.folio-article-tag').click(), true");
      await poll(chrome.cdp, desktop.sessionId, "location.pathname.includes('/tag/') && !!document.querySelector('.folio-archive-page')", {
        label: "tag navigation from article",
      });
      const after = await evaluate(chrome.cdp, desktop.sessionId, "performance.getEntriesByType('navigation').length");
      assert.equal(before, 1);
      assert.equal(after, 1);
      return { tags: articleTags.map((tag) => tag.href), clientNavigationEntries: after };
    });

    // Static/React parity is computed from the actual route the keyboard
    // activation selected. The route stays decoded for filesystem lookups and
    // is percent-encoded only when handed to the browser/server.
    const categoryRoute = focusedChipRouteFrom(focusSequence);
    const categoryGroup = archiveRoutes.find((entry) => entry.route === categoryRoute).group;
    const staticCategoryEntries = parseEntryList(readRoute(dist, categoryRoute));
    const encodedCategoryUrl = `${server.origin}${encodeURI(categoryRoute)}/`;

    await setViewport(chrome.cdp, desktop.sessionId, { width: 375, height: 812, mobile: true, scale: 2 });
    await goto(chrome.cdp, desktop.sessionId, encodedCategoryUrl);
    await poll(chrome.cdp, desktop.sessionId, "!!document.querySelector('.folio-archive-page')", {
      label: "mobile category archive",
    });
    const mobile = await evaluate(
      chrome.cdp,
      desktop.sessionId,
      `(() => ({
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        h1: document.querySelector('h1')?.textContent,
      }))()`,
    );
    reporter.check("react-desktop-and-static-category-lists-agree", () => {
      assert.deepEqual(
        staticCategoryEntries.map((entry) => entry.href),
        categoryGroup.docs.map((doc) => doc.path),
      );
      return { route: categoryRoute, entries: staticCategoryEntries.length };
    });
    reporter.check("mobile-375px-archive-has-no-horizontal-overflow", () => {
      assert.equal(mobile.h1, categoryGroup.title);
      assert.deepEqual(mobile.entries.map((entry) => entry.href), categoryGroup.docs.map((doc) => doc.path));
      assert.ok(
        mobile.scrollWidth <= mobile.innerWidth + 1,
        `horizontal overflow at 375px: scrollWidth=${mobile.scrollWidth}, innerWidth=${mobile.innerWidth}`,
      );
      return mobile;
    });
    shots.mobileCategory = await screenshot(
      chrome.cdp,
      desktop.sessionId,
      join(screenshotsDir, "mobile-category.png"),
    );

    // Keyboard focus on tag links too.
    await setViewport(chrome.cdp, desktop.sessionId, { width: 1440, height: 900 });
    await goto(chrome.cdp, desktop.sessionId, `${server.origin}/blogs/`);
    let tagFocused = false;
    for (let index = 0; index < 120; index += 1) {
      await pressTab(chrome.cdp, desktop.sessionId);
      const active = await evaluate(
        chrome.cdp,
        desktop.sessionId,
        "(() => { const el = document.activeElement; return el ? { href: el.getAttribute?.('href') ?? null, cls: typeof el.className === 'string' ? el.className : '' } : null; })()",
      );
      if (active?.href?.startsWith("/blogs/tag/")) {
        tagFocused = true;
        break;
      }
    }
    reporter.check("tag-links-are-keyboard-focusable", () => {
      assert.ok(tagFocused, "never reached a tag link by Tab");
      return "Tab reaches .folio-entry-tag links on the collection index";
    });

    // No-JS direct load: a fresh page with scripting disabled.
    const noJs = await openPage(chrome.cdp, { width: 1440, height: 900 });
    await chrome.cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, noJs.sessionId);
    await goto(chrome.cdp, noJs.sessionId, encodedCategoryUrl);
    const noJsResult = await evaluate(
      chrome.cdp,
      noJs.sessionId,
      `(() => ({
        readyState: document.readyState,
        page: !!document.querySelector('.folio-archive-page'),
        h1: document.querySelector('h1')?.textContent,
        entries: [...document.querySelectorAll('.folio-entry-link')].map(a => ({ href: a.getAttribute('href'), title: a.textContent.trim() })),
        scriptsExecuted: window.__folio041NoJsMarker ?? null,
      }))()`,
    );
    reporter.check("static-archive-is-readable-with-javascript-disabled", () => {
      assert.equal(noJsResult.page, true);
      assert.equal(noJsResult.h1, categoryGroup.title);
      assert.deepEqual(noJsResult.entries.map((entry) => entry.href), categoryGroup.docs.map((doc) => doc.path));
      return noJsResult;
    });
    shots.desktopNoJs = await screenshot(
      chrome.cdp,
      noJs.sessionId,
      join(screenshotsDir, "desktop-nojs-category.png"),
    );
    await chrome.cdp.send("Emulation.setScriptExecutionDisabled", { value: false }, noJs.sessionId);

    reporter.check("no-page-exceptions-during-browser-archive-flow", () => {
      const exceptions = chrome.consoleEntries.filter((entry) => entry.type === "exception");
      assert.deepEqual(exceptions, [], "unexpected page exception during archive flow");
      return { browser: chrome.browserVersion, consoleEntries: chrome.consoleEntries.length };
    });
  } finally {
    await chrome.stop();
    await server.close();
  }
  reporter.results.artifacts.screenshots = shots;
  reporter.endStage();

  // -------------------------------------------------------------------------
  // Source-of-truth inspection (high-risk duplicate-logic check requested by
  // the captain): route derivation/normalization must come from Core.
  // -------------------------------------------------------------------------
  reporter.stage("single-source-of-truth");
  reporter.check("site-archive-composition-consumes-core-helpers", () => {
    const archiveSource = readFileSync(join(siteRoot, "src", "archive.ts"), "utf8");
    for (const helper of [
      "buildFolioArticleArchiveIndex",
      "folioCollectionIndexes",
      "normalizeFolioCollectionPath",
      "selectFolioCollectionDocs",
    ]) {
      assertIncludes(archiveSource, helper, "apps/site/src/archive.ts Core helper");
    }
    assert.doesNotMatch(archiveSource, /\.toLowerCase\(|\.normalize\(|slugify\(/, "apps/site/src/archive.ts re-implements label normalization");
    const staticRoutesSource = readFileSync(join(siteRoot, "src", "static-routes.ts"), "utf8");
    assertIncludes(staticRoutesSource, "buildSiteArchiveModel", "site static routes archive model");
    assert.doesNotMatch(staticRoutesSource, /buildFolioArticleArchiveIndex|selectFolioCollectionDocs\(.*\).*category/, "site static routes re-filter document types");
    const packageStatic = readFileSync(join(packageRoot, "src", "static.ts"), "utf8");
    assertIncludes(packageStatic, "buildFolioArticleArchiveIndex", "package static archive model");
    const packageUi = readFileSync(join(packageRoot, "src", "ui", "article-archive", "ArticleArchive.tsx"), "utf8");
    assertIncludes(packageUi, "buildFolioArticleArchiveIndex", "package React archive model");
    assert.doesNotMatch(packageUi, /\.toLowerCase\(|\.normalize\(|slugify\(/, "React archive model re-implements label normalization");
    return {
      coreConsumers: [
        "apps/site/src/archive.ts",
        "apps/site/src/static-routes.ts",
        "packages/folio/src/static.ts",
        "packages/folio/src/ui/article-archive/ArticleArchive.tsx",
      ],
      nonBlockingDuplication: [
        "route path template '<collection>/<kind>/<slug>' is repeated in apps/site/src/archive.ts, packages/folio/src/ui/article-archive/ArticleArchive.tsx and packages/folio/src/static.ts (no shared public route-path helper)",
        "archive description string is repeated in apps/site/src/archive.ts and packages/folio/src/static.ts",
        "React and static entry-list/category-row renderers are intentionally separate render targets",
      ],
      normalizationSource: "packages/folio/src/core/article-archive.ts (single implementation)",
    };
  });
  reporter.endStage();
}

function focusedChipRouteFrom(focusSequence) {
  const href = focusSequence.find((entry) => entry?.href?.startsWith("/blogs/category/"))?.href;
  assert.ok(href, "no focused category chip");
  return href;
}

let failure;
try {
  await main();
} catch (error) {
  failure = error;
}
reporter.results.artifacts.screenshotsDir = "docs/research/fol-041/results/screenshots";
const summary = reporter.write("site.json");
if (failure) {
  console.error(`\nFAILED: ${failure.message}`);
  process.exitCode = 1;
} else if (summary.failed) {
  process.exitCode = 1;
}
