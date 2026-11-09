import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildFolioArticleArchiveIndex, FolioApp } from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const template =
  '<!doctype html><html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';

const PREVIEW_ROBOTS_TXT =
  "# Preview build: site-wide noindex. Crawling stays allowed so crawlers can read the page-level noindex.\n" +
  "User-agent: *\n" +
  "Allow: /\n";

function article(path, { date, category, tags = [], type = "article", order = 1 } = {}) {
  return {
    id: path.slice(1).replace(/\//g, "-"),
    path,
    sourcePath: path.slice(1) + ".md",
    type,
    title: `Title ${path}`,
    description: `Description for ${path}`,
    group: "博客",
    order,
    date,
    category,
    tags,
    body: "## Body\n\nText.",
    headings: [{ depth: 2, text: "Body", id: "body" }],
    data: {},
  };
}

const docs = [
  article("/blogs/alpha", { date: "2026-01-02", category: "Frontend", tags: ["React", "State"] }),
  article("/blogs/beta", { date: "2026-01-03", category: "backend", tags: ["react"], order: 2 }),
  article("/blogs/gamma", { date: "2025-12-01", category: "Frontend", tags: ["设计"], order: 3 }),
  article("/blogs/guide", { type: "doc", tags: [], order: 4 }),
  article("/notes/other", { date: "2026-02-01", category: "Frontend", tags: ["React"], order: 5 }),
];

const config = {
  title: "Archive Site",
  description: "Archive site",
  siteUrl: "https://example.test",
  collections: [
    { path: "/blogs", title: "博客", description: "生活的记录", archive: true },
    { path: "/notes", title: "笔记" },
  ],
};

function withSite(run, { siteConfig = config, siteDocs = docs, base = "/moyu/" } = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), "folio-archive-static-"));
  const outDir = resolve(dir, "out");
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");
    return run({
      context: { config: siteConfig, docs: siteDocs, roots: [], base, outDir },
      read: (path) => readFileSync(resolve(outDir, path), "utf8"),
      exists: (path) => existsSync(resolve(outDir, path)),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function robotsOf(html) {
  const matches = [...html.matchAll(/<meta name="robots" content="([^"]*)">/g)];
  assert.equal(matches.length, 1, "expected exactly one robots meta tag");
  return matches[0][1];
}

function canonicalOf(html) {
  const match = html.match(/<link rel="canonical" href="([^"]*)">/);
  assert.ok(match, "expected a canonical link");
  return match[1];
}

function entryLinks(html) {
  return [...html.matchAll(/class="folio-entry-link" href="([^"]*)"/g)].map((match) => match[1]);
}

test("opted-in collections generate category and tag routes derived from their own path", () =>
  withSite(({ context, read, exists }) => {
    const result = writeFolioStaticSite(context);
    // home + two collection indexes + five /blogs archive groups + five documents
    assert.equal(result.routes, 13);

    const categoryHtml = read("blogs/category/frontend/index.html");
    const tagHtml = read("blogs/tag/react/index.html");
    const chineseTagHtml = read("blogs/tag/设计/index.html");

    for (const file of [
      "blogs/category/frontend/index.html",
      "blogs/category/backend/index.html",
      "blogs/tag/react/index.html",
      "blogs/tag/state/index.html",
      "blogs/tag/设计/index.html",
      "blogs/alpha/index.html",
    ]) {
      assert.ok(exists(file), `expected static archive output ${file}`);
    }

    assert.match(categoryHtml, /<title>分类：Frontend · Archive Site<\/title>/);
    assert.match(
      categoryHtml,
      /<meta name="description" content="博客 · 分类归档，共 2 篇文章。">/,
    );
    assert.equal(
      canonicalOf(categoryHtml),
      "https://example.test/moyu/blogs/category/frontend/",
    );
    assert.match(categoryHtml, /CATEGORY ARCHIVE · 2 ARTICLES/);
    assert.deepEqual(
      entryLinks(categoryHtml),
      ["/moyu/blogs/alpha/", "/moyu/blogs/gamma/"],
      "category archive keeps the Core Article order (date desc)",
    );
    assert.match(categoryHtml, /class="folio-archive-back" href="\/moyu\/blogs\/"/);

    // A tag aggregates articles from different categories.
    assert.match(tagHtml, /<title>标签：react · Archive Site<\/title>/);
    assert.match(tagHtml, /TAG ARCHIVE · 2 ARTICLES/);
    assert.deepEqual(entryLinks(tagHtml), ["/moyu/blogs/beta/", "/moyu/blogs/alpha/"]);
    assert.equal(canonicalOf(tagHtml), "https://example.test/moyu/blogs/tag/react/");

    assert.match(chineseTagHtml, /<h1>设计<\/h1>/);
    assert.match(chineseTagHtml, /TAG ARCHIVE · 1 ARTICLES/);
    assert.equal(
      canonicalOf(chineseTagHtml),
      "https://example.test/moyu/blogs/tag/设计/",
    );

    // Entry points on the collection index and article metadata.
    const indexHtml = read("blogs/index.html");
    assert.match(indexHtml, /class="folio-archive-row" aria-label="博客分类归档"/);
    assert.deepEqual(
      [...indexHtml.matchAll(/class="folio-archive-chip" href="([^"]*)"/g)].map((match) => match[1]),
      ["/moyu/blogs/category/backend/", "/moyu/blogs/category/frontend/"],
    );
    assert.match(indexHtml, /class="folio-entry-tag" href="\/moyu\/blogs\/tag\/react\/">react</);
    assert.match(indexHtml, /class="folio-entry-tag" href="\/moyu\/blogs\/tag\/设计\/">设计</);

    const articleHtml = read("blogs/alpha/index.html");
    assert.match(articleHtml, /class="folio-article-tags" aria-label="文章标签"/);
    assert.match(articleHtml, /class="folio-article-tag" href="\/moyu\/blogs\/tag\/react\/">react</);
    assert.match(articleHtml, /class="folio-article-tag" href="\/moyu\/blogs\/tag\/state\/">State</);

    // The un-opted-in collection is untouched.
    assert.doesNotMatch(read("notes/index.html"), /folio-archive-row/);
    assert.doesNotMatch(read("notes/other/index.html"), /folio-article-tags/);

    const sitemap = read("sitemap.xml");
    for (const path of [
      "blogs/category/frontend/",
      "blogs/category/backend/",
      "blogs/tag/react/",
      "blogs/tag/设计/",
    ]) {
      assert.match(sitemap, new RegExp(`https://example\\.test/moyu/${path}`));
    }
    assert.match(read("robots.txt"), /Sitemap: https:\/\/example\.test\/moyu\/sitemap\.xml/);
  }));

test("static archive lists match the Core index for every derived group", () =>
  withSite(({ context, read }) => {
    writeFolioStaticSite(context);
    const index = buildFolioArticleArchiveIndex(
      docs.filter((doc) => doc.path.startsWith("/blogs/")),
      true,
    );
    for (const group of [...index.categories, ...index.tags]) {
      const html = read(`blogs/${group.kind}/${group.slug}/index.html`);
      assert.equal(
        entryLinks(html).join("\n"),
        group.docs.map((doc) => `/moyu${doc.path}/`).join("\n"),
        `${group.kind} ${group.slug} must publish the Core group content, count and order`,
      );
      assert.match(html, new RegExp(`${group.docs.length} ARTICLES`));
    }
  }));

test("archive routes follow an arbitrary collection path and category label overrides", () =>
  withSite(
    ({ context, read, exists }) => {
      writeFolioStaticSite(context);
      assert.ok(exists("journal/2026/category/frontend/index.html"));
      assert.ok(exists("journal/2026/tag/react/index.html"));
      const indexHtml = read("journal/2026/index.html");
      assert.match(indexHtml, /class="folio-archive-chip" href="\/moyu\/journal\/2026\/category\/frontend\/">前端</);
      assert.doesNotMatch(indexHtml, /\/blogs\//);
      assert.match(
        read("journal/2026/tag/react/index.html"),
        /<h1>React<\/h1>/,
      );
    },
    {
      base: "/moyu/",
      siteConfig: {
        title: "Journal",
        description: "Journal",
        siteUrl: "https://example.test",
        collections: [
          {
            path: "/journal/2026",
            title: "2026",
            archive: { categoryLabels: { frontend: "前端" } },
          },
        ],
      },
      siteDocs: [
        article("/journal/2026/alpha", { category: "Frontend", tags: ["React"], date: "2026-01-01" }),
      ],
    },
  ));

test("siteIndexing=noindex reaches archive pages without changing canonical or base path", () =>
  withSite(({ context, read }) => {
    writeFolioStaticSite(context, { siteIndexing: "noindex" });
    for (const file of [
      "blogs/index.html",
      "blogs/category/frontend/index.html",
      "blogs/tag/react/index.html",
      "blogs/alpha/index.html",
    ]) {
      assert.equal(robotsOf(read(file)), "noindex,nofollow", `${file} must inherit noindex`);
    }
    assert.equal(
      canonicalOf(read("blogs/tag/react/index.html")),
      "https://example.test/moyu/blogs/tag/react/",
    );
    assert.equal(read("robots.txt"), PREVIEW_ROBOTS_TXT);
    // The preview sitemap remains unadvertised but still lists real routes.
    assert.match(read("sitemap.xml"), /https:\/\/example\.test\/moyu\/blogs\/tag\/react\//);
  }));

test("without archive opt-in there are no archive routes, entry points or tags", () =>
  withSite(
    ({ context, read, exists }) => {
      const result = writeFolioStaticSite(context);
      assert.equal(result.routes, 1 + 2 + 5);
      assert.equal(exists("blogs/category"), false);
      assert.equal(exists("blogs/tag"), false);
      assert.doesNotMatch(read("blogs/index.html"), /folio-archive-row|folio-entry-tag/);
      assert.doesNotMatch(read("blogs/alpha/index.html"), /folio-article-tags/);
      assert.doesNotMatch(read("sitemap.xml"), /\/category\/|\/tag\//);
    },
    {
      siteConfig: {
        title: "Archive Site",
        description: "Archive site",
        siteUrl: "https://example.test",
        collections: [
          { path: "/blogs", title: "博客" },
          { path: "/notes", title: "笔记" },
        ],
      },
    },
  ));

test("archive routes between categories and tags are the only routes for that data", () =>
  withSite(
    ({ context, read, exists }) => {
      writeFolioStaticSite(context);
      // Articles without a category or tags must not create empty archives.
      assert.equal(exists("blogs/category"), false);
      assert.equal(exists("blogs/tag"), false);
      assert.doesNotMatch(read("blogs/index.html"), /folio-archive-row|folio-article-tag/);
    },
    {
      siteDocs: [
        article("/blogs/plain", { date: "2026-01-01", tags: [] }),
        article("/blogs/also-plain", { date: "2026-01-02", tags: [] }),
      ],
      siteConfig: {
        title: "Plain",
        description: "Plain",
        siteUrl: "https://example.test",
        collections: [{ path: "/blogs", title: "博客", archive: true }],
      },
    },
  ));

test("archive route conflicts with a document or collection index fail before writing", () => {
  // A document that owns the same URL as the derived category archive.
  withSite(
    ({ context, read, exists }) => {
      assert.throws(
        () => writeFolioStaticSite(context),
        (error) => {
          assert.match(error.message, /folio article archive route conflict/);
          assert.ok(error.message.includes("/blogs/category/frontend"));
          return true;
        },
      );
      assert.equal(read("index.html"), template, "nothing may be written on conflict");
      assert.equal(exists("blogs/category/frontend/index.html"), false);
    },
    {
      siteDocs: [
        ...docs,
        article("/blogs/category/frontend", { date: "2026-04-01" }),
      ],
    },
  );

  // A configured collection index that owns the same URL as an archive route.
  withSite(({ context, read, exists }) => {
    assert.throws(
      () => writeFolioStaticSite(context),
      /folio article archive route conflict/,
    );
    assert.equal(read("index.html"), template);
    assert.equal(exists("blogs/category/frontend/index.html"), false);
  }, {
    siteConfig: {
      title: "Archive Site",
      description: "Archive site",
      siteUrl: "https://example.test",
      collections: [
        { path: "/blogs", title: "博客", archive: true },
        { path: "/blogs/category/frontend", title: "Frontend index" },
      ],
    },
  });
});

test("two categories with the same URL identifier fail the static build", () =>
  withSite(
    ({ context, read }) => {
      assert.throws(
        () => writeFolioStaticSite(context),
        /URL identifier collision/,
      );
      assert.equal(read("index.html"), template);
    },
    {
      siteDocs: [
        article("/blogs/cpp", { category: "C++", date: "2026-01-01" }),
        article("/blogs/csharp", { category: "C#", date: "2026-01-02" }),
      ],
      siteConfig: {
        title: "Collision",
        description: "Collision",
        siteUrl: "https://example.test",
        collections: [{ path: "/blogs", title: "博客", archive: true }],
      },
    },
  ));

test("archive documents keep their existing permalinks and are not renamed", () =>
  withSite(({ context, read }) => {
    writeFolioStaticSite(context);
    const articleHtml = read("blogs/alpha/index.html");
    assert.match(articleHtml, /<h1>Title \/blogs\/alpha<\/h1>/);
    assert.match(articleHtml, /https:\/\/example\.test\/moyu\/blogs\/alpha\//);
    // The static output never adds an archive segment to the article route.
    assert.doesNotMatch(articleHtml, /canonical" href="[^"]*\/category\//);
  }));

test("React and static archive surfaces publish the same content, order and links", () => {
  function renderReact(pathname) {
    const window = {
      location: {
        pathname,
        search: "",
        hash: "",
        origin: "http://localhost",
        href: "http://localhost" + pathname,
      },
      history: { state: null, pushState() {}, replaceState() {}, go() {} },
      localStorage: { getItem() { return null; }, setItem() {} },
      matchMedia() { return { matches: false }; },
      addEventListener() {},
      removeEventListener() {},
      scrollTo() {},
    };
    window.document = { defaultView: window, documentElement: { dataset: {}, style: {} } };
    globalThis.window = window;
    globalThis.document = window.document;
    try {
      return renderToStaticMarkup(
        createElement(FolioApp, {
          config,
          docs,
          basePath: "/",
          ui: { search: false },
        }),
      );
    } finally {
      delete globalThis.window;
      delete globalThis.document;
    }
  }

  const stripBase = (href) => href.replace(/^\/moyu/, "").replace(/\/$/, "");
  const links = (html, className) =>
    [...html.matchAll(new RegExp(`class="${className}" href="([^"]+)"`, "g"))].map((match) =>
      stripBase(match[1]),
    );

  withSite(({ context, read }) => {
    writeFolioStaticSite(context);
    for (const [pathname, file] of [
      ["/blogs", "blogs/index.html"],
      ["/blogs/category/frontend", "blogs/category/frontend/index.html"],
      ["/blogs/tag/react", "blogs/tag/react/index.html"],
    ]) {
      const staticHtml = read(file);
      const reactHtml = renderReact(pathname);
      assert.deepEqual(
        links(staticHtml, "folio-entry-link"),
        links(reactHtml, "folio-entry-link"),
        `${pathname} archive entries must match between React and static HTML`,
      );
      assert.deepEqual(
        links(staticHtml, "folio-entry-tag"),
        links(reactHtml, "folio-entry-tag"),
        `${pathname} tag links must match between React and static HTML`,
      );
      assert.deepEqual(
        links(staticHtml, "folio-archive-chip"),
        links(reactHtml, "folio-archive-chip"),
        `${pathname} category entry points must match between React and static HTML`,
      );
    }
    const staticArticle = read("blogs/alpha/index.html");
    const reactArticle = renderReact("/blogs/alpha");
    assert.deepEqual(
      links(staticArticle, "folio-article-tag"),
      links(reactArticle, "folio-article-tag"),
      "article metadata tag links must match between React and static HTML",
    );
  });
});

test("opting into archives leaves existing feeds and article URLs intact", () =>
  withSite(({ context, read, exists }) => {
    const result = writeFolioStaticSite(context, {
      feeds: [{ path: "/blogs", title: "博客" }],
    });
    assert.ok(exists("rss.xml"), "the existing blog feed must still be written");
    const rss = read("rss.xml");
    assert.match(rss, /https:\/\/example\.test\/moyu\/blogs\/alpha\//);
    assert.match(rss, /https:\/\/example\.test\/moyu\/blogs\/beta\//);
    // Feeds list Articles, never the generated archive pages.
    assert.doesNotMatch(rss, /\/blogs\/category\/|\/blogs\/tag\//);
    // Archive routes were added on top of the unchanged document routes.
    assert.ok(result.routes > 1 + 2 + 5);
    assert.ok(exists("blogs/alpha/index.html"));
    assert.ok(exists("blogs/tag/react/index.html"));
  }));

test("missing categories or tags never create empty or meaningless entry points", () =>
  withSite(
    ({ context, read, exists }) => {
      writeFolioStaticSite(context);
      assert.deepEqual(exists("blogs/category"), true);
      assert.deepEqual(exists("blogs/tag"), true);
      // Only the real category is linked; uncategorized articles add no bucket.
      const indexHtml = read("blogs/index.html");
      assert.deepEqual(
        [...indexHtml.matchAll(/class="folio-archive-chip" href="([^"]*)"/g)].map((match) => match[1]),
        ["/moyu/blogs/category/frontend/"],
      );
      assert.equal(exists("blogs/category/uncategorized"), false);
      // The untagged article keeps an entry without a tag row.
      const untagged = read("blogs/untagged/index.html");
      assert.doesNotMatch(untagged, /folio-article-tags/);
      assert.ok(exists("blogs/tag/react/index.html"));
      assert.equal(exists("blogs/tag/untagged"), false);
    },
    {
      siteDocs: [
        article("/blogs/tagged", { tags: ["React"], date: "2026-01-01" }),
        article("/blogs/untagged", { category: "Frontend", date: "2026-01-02" }),
      ],
      siteConfig: {
        title: "Partial",
        description: "Partial",
        siteUrl: "https://example.test",
        collections: [{ path: "/blogs", title: "博客", archive: true }],
      },
    },
  ));
