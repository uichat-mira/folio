import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FolioApp } from "../dist/index.js";

// FOL-041 / Issue #163: React archive pages are rendered through the real
// public `FolioApp` entry. There is no jsdom dependency, so the browser
// history surface BrowserRouter needs is provided by a minimal, isolated
// window/document stub. Nothing else about the app is mocked.

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
    headings: [],
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
  navigation: [
    { label: "博客", href: "/blogs" },
    { label: "笔记", href: "/notes" },
  ],
  collections: [
    { path: "/blogs", title: "博客", archive: true },
    { path: "/notes", title: "笔记" },
  ],
};

function renderApp(pathname, { basePath = "/", siteConfig = config, siteDocs = docs } = {}) {
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
  window.document = {
    defaultView: window,
    documentElement: { dataset: {}, style: {} },
  };
  globalThis.window = window;
  globalThis.document = window.document;
  try {
    return renderToStaticMarkup(
      createElement(FolioApp, {
        config: siteConfig,
        docs: siteDocs,
        basePath,
        ui: { search: false },
      }),
    );
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

function archiveChips(html) {
  return [...html.matchAll(/class="folio-archive-chip"[^>]*?\shref="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function archiveEntryLinks(html) {
  return [...html.matchAll(/class="folio-entry-link" href="([^"]+)"/g)].map((match) => match[1]);
}

function entryTagLinks(html) {
  return [...html.matchAll(/class="folio-entry-tag" href="([^"]+)"/g)].map((match) => match[1]);
}

test("opted-in collection index exposes category entry points and clickable card tags", () => {
  const html = renderApp("/blogs");

  assert.match(html, /class="folio-archive-row" aria-label="博客分类归档"><ul class="folio-archive-row__list">/);
  assert.equal(html.includes("folio-archive-row__label"), false);
  assert.match(html, /aria-current="true"[^>]*>全部<\/a>/);
  assert.deepEqual(archiveChips(html), [
    "/blogs",
    "/blogs/category/backend",
    "/blogs/category/frontend",
  ]);
  // Tags on article cards point at the derived archive route.
  const tags = entryTagLinks(html);
  assert.ok(tags.includes("/blogs/tag/react"));
  assert.ok(tags.includes("/blogs/tag/state"));
  assert.ok(tags.includes("/blogs/tag/设计"));
  assert.equal(tags.filter((href) => href === "/blogs/tag/react").length, 2,
    "both cross-category articles link to the same tag archive");
  // Existing article permalinks are untouched.
  assert.match(html, /class="folio-entry-link" href="\/blogs\/alpha"/);
  assert.match(html, /href="\/blogs\/guide"/);

  // No category/tag archive link is injected into the global header nav.
  const header = html.slice(0, html.indexOf("</header>"));
  assert.doesNotMatch(header, /\/blogs\/(?:category|tag)\//);
});

test("category and tag pages render the Core groups with stable order and links", () => {
  const category = renderApp("/blogs/category/frontend");
  assert.match(category, /folio-archive-page/);
  assert.match(category, /CATEGORY ARCHIVE · 2 ARTICLES/);
  assert.match(category, /<h1>Frontend<\/h1>/);
  assert.match(category, /博客 · 分类归档 · 共 2 篇文章/);
  assert.deepEqual(archiveEntryLinks(category), ["/blogs/alpha", "/blogs/gamma"]);
  assert.match(category, /class="folio-archive-back" href="\/blogs"/);

  // A tag aggregates Articles from different categories (beta=backend,
  // alpha=Frontend) and keeps the Core Article order.
  const tag = renderApp("/blogs/tag/react");
  assert.match(tag, /TAG ARCHIVE · 2 ARTICLES/);
  assert.match(tag, /<h1>react<\/h1>/);
  assert.deepEqual(archiveEntryLinks(tag), ["/blogs/beta", "/blogs/alpha"]);

  const chinese = renderApp("/blogs/tag/设计");
  assert.match(chinese, /<h1>设计<\/h1>/);
  assert.deepEqual(archiveEntryLinks(chinese), ["/blogs/gamma"]);
});

test("article metadata exposes its tags and unknown archive identifiers stay 404", () => {
  const articleHtml = renderApp("/blogs/alpha");
  assert.match(articleHtml, /class="folio-article-tags" aria-label="文章标签"/);
  assert.match(articleHtml, /class="folio-article-tag" href="\/blogs\/tag\/react"/);
  assert.match(articleHtml, /class="folio-article-tag" href="\/blogs\/tag\/state"/);

  for (const pathname of ["/blogs/category/unknown", "/blogs/tag/unknown"]) {
    const html = renderApp(pathname);
    assert.match(html, /folio-not-found/, `${pathname} must not invent an archive page`);
    assert.doesNotMatch(html, /folio-archive-page/);
  }
});

test("archive routes derive from the configured collection path, not /blogs", () => {
  const siteConfig = {
    title: "Journal",
    description: "Journal",
    navigation: [{ label: "2026", href: "/journal/2026" }],
    collections: [
      {
        path: "/journal/2026",
        title: "2026",
        archive: { categoryLabels: { frontend: "前端" } },
      },
    ],
  };
  const siteDocs = [
    article("/journal/2026/alpha", { category: "Frontend", tags: ["React"], date: "2026-01-01" }),
  ];

  const index = renderApp("/journal/2026", { siteConfig, siteDocs });
  assert.deepEqual(archiveChips(index), [
    "/journal/2026",
    "/journal/2026/category/frontend",
  ]);
  assert.match(index, />前端<\/a>/);
  assert.doesNotMatch(index, /\/blogs\//);

  const archive = renderApp("/journal/2026/tag/react", { siteConfig, siteDocs });
  assert.match(archive, /TAG ARCHIVE · 1 ARTICLES/);
  assert.deepEqual(archiveEntryLinks(archive), ["/journal/2026/alpha"]);
});

test("archive-disabled collections add no pages, routes, rows or tag links", () => {
  const siteConfig = {
    title: "Plain",
    description: "Plain",
    collections: [{ path: "/blogs", title: "博客" }],
  };
  const siteDocs = [article("/blogs/alpha", { category: "Frontend", tags: ["React"] })];

  const index = renderApp("/blogs", { siteConfig, siteDocs });
  assert.doesNotMatch(index, /folio-archive-row|folio-archive-chip|folio-entry-tag/);
  assert.match(index, /class="folio-entry"/);

  const articleHtml = renderApp("/blogs/alpha", { siteConfig, siteDocs });
  assert.doesNotMatch(articleHtml, /folio-article-tags|folio-article-tag/);

  const missing = renderApp("/blogs/category/frontend", { siteConfig, siteDocs });
  assert.match(missing, /folio-not-found/);
});

test("archive entries and tag links keep a consumer base path", () => {
  const html = renderApp("/folio/blogs/tag/react", { basePath: "/folio/" });
  assert.match(html, /TAG ARCHIVE · 2 ARTICLES/);
  assert.deepEqual(archiveEntryLinks(html), ["/folio/blogs/beta", "/folio/blogs/alpha"]);
  assert.match(html, /class="folio-entry-tag" href="\/folio\/blogs\/tag\/react"/);
});

test("an archive route that collides with a document or collection fails React routing", () => {
  assert.throws(
    () =>
      renderApp("/blogs", {
        siteDocs: [...docs, article("/blogs/category/frontend", { date: "2026-04-01" })],
      }),
    (error) => {
      assert.match(error.message, /folio article archive route conflict/);
      assert.ok(error.message.includes("/blogs/category/frontend"));
      return true;
    },
  );

  assert.throws(
    () =>
      renderApp("/blogs", {
        siteConfig: {
          ...config,
          collections: [
            ...config.collections,
            { path: "/blogs/category/frontend", title: "Frontend index" },
          ],
        },
      }),
    /folio article archive route conflict/,
  );
});

test("archive entry points ship the shared restrained styles and keyboard focus", () => {
  const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.folio-archive-row\s*\{/);
  assert.match(css, /\.folio-archive-row\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.folio-archive-row\s*\{[^}]*top:\s*var\(--folio-header-height\)/s);
  assert.match(css, /\.folio-archive-row__list\s*\{/);
  assert.match(css, /\.folio-archive-chip\s*\{[^}]*var\(--folio-radius-pill\)/s);
  assert.match(css, /\.folio-archive-chip\s*\{[^}]*var\(--folio-hairline\)/s);
  assert.match(css, /\.folio-entry-tags\s*\{/);
  assert.match(css, /\.folio-article-tags\s*\{/);
  // Focus is visible on the tag/chip links and on the stretched title link.
  assert.match(css, /\.folio-archive-chip:focus-visible/);
  assert.match(css, /\.folio-entry-tag:focus-visible/);
  assert.match(css, /\.folio-entry-link:focus-visible::after/);
});
