import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  renderFolioStaticHtml,
  writeFolioStaticSite,
} from "../dist/vite.js";

const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>`;

function context(outDir = "/tmp/folio") {
  return {
    config: {
      title: "Folio",
      description: "Docs runtime",
      siteUrl: "https://example.com",
    },
    docs: [],
    roots: [],
    base: "/guide/",
    outDir,
  };
}

test("static HTML includes canonical, social metadata, JSON-LD, and body", () => {
  const html = renderFolioStaticHtml(
    template,
    {
      path: "/intro",
      title: "Introduction",
      description: "Start here",
      body: "<main><h1>Hello</h1></main>",
      type: "article",
      robots: "index,follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Introduction",
      },
    },
    context(),
    {
      locale: "zh_CN",
      defaultImage: "logo.png",
      image: { type: "image/png", width: 940, height: 760 },
    },
  );

  assert.match(html, /<title>Introduction · Folio<\/title>/);
  assert.match(html, /https:\/\/example\.com\/guide\/intro\//);
  assert.match(html, /https:\/\/example\.com\/guide\/logo\.png/);
  assert.match(html, /property="og:locale" content="zh_CN"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<div id="root"><main><h1>Hello<\/h1><\/main><\/div>/);
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
});

test("static site writer creates routes, 404, sitemap, and robots", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-static-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const result = writeFolioStaticSite(context(outDir), {
      routes: () => [
        {
          path: "/",
          title: "Home",
          description: "Home page",
          body: "<main>Home</main>",
        },
        {
          path: "/article",
          title: "Article",
          description: "Article page",
          body: "<main>Article</main>",
          type: "article",
        },
      ],
      notFound: () => ({
        path: "/404",
        title: "Missing",
        description: "Missing page",
        body: "<main>Missing</main>",
        robots: "noindex,nofollow",
      }),
    });

    assert.equal(result.routes, 2);
    assert.match(readFileSync(resolve(outDir, "index.html"), "utf8"), /Home/);
    assert.match(
      readFileSync(resolve(outDir, "article/index.html"), "utf8"),
      /Article/,
    );
    assert.match(
      readFileSync(resolve(outDir, "404.html"), "utf8"),
      /noindex,nofollow/,
    );
    assert.match(
      readFileSync(resolve(outDir, "sitemap.xml"), "utf8"),
      /https:\/\/example\.com\/guide\/article\//,
    );
    assert.equal(
      readFileSync(resolve(outDir, "robots.txt"), "utf8"),
      "User-agent: *\nAllow: /\nSitemap: https://example.com/guide/sitemap.xml\n",
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});


test("default document routes use the documentation structure shell", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-doc-shell-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const docs = [
      {
        id: "intro",
        path: "/docs/intro",
        sourcePath: "docs/intro.md",
        type: "doc",
        title: "Introduction",
        description: "Start here",
        group: "Guide",
        collection: "Core",
        section: "Getting started",
        order: 1,
        tags: [],
        body: "## First section\nHello",
        headings: [{ depth: 2, text: "First section", id: "first-section" }],
        data: {},
      },
      {
        id: "runtime",
        path: "/docs/runtime",
        sourcePath: "docs/runtime.md",
        type: "doc",
        title: "Runtime",
        description: "Runtime docs",
        group: "Guide",
        collection: "Core",
        section: "Runtime",
        order: 2,
        tags: [],
        body: "## Runtime section\nBody",
        headings: [{ depth: 2, text: "Runtime section", id: "runtime-section" }],
        data: {},
      },
    ];

    writeFolioStaticSite({ ...context(outDir), docs });

    const html = readFileSync(
      resolve(outDir, "docs/intro/index.html"),
      "utf8",
    );

    assert.match(html, /class="folio-docs-shell"/);
    assert.match(html, /class="folio-docnav"/);
    assert.match(html, /class="folio-toc"/);
    assert.match(html, /class="folio-page-nav"/);
    assert.match(html, /href="\/guide\/docs\/runtime\/"/);
    assert.match(html, /href="#first-section"/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});


test("static document shell keeps mobile navigation without JavaScript", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-static-mobile-docs-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const docs = [
      {
        id: "intro",
        path: "/docs/intro",
        sourcePath: "docs/intro.md",
        type: "doc",
        title: "Introduction",
        description: "Start here",
        group: "Guide",
        collection: "Core",
        section: "Start",
        order: 1,
        tags: [],
        body: "## First section\nHello",
        headings: [{ depth: 2, text: "First section", id: "first-section" }],
        data: {},
      },
    ];

    writeFolioStaticSite({ ...context(outDir), docs });

    const html = readFileSync(
      resolve(outDir, "docs/intro/index.html"),
      "utf8",
    );

    assert.match(html, /folio-docs-mobile-bar--static/);
    assert.match(html, /<details class="folio-static-doc-menu">/);
    assert.match(html, /<summary>菜单<\/summary>/);
    assert.match(html, /<summary>页面导航<\/summary>/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
