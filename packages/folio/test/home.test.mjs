import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  resolveFolioHome,
} from "../dist/index.js";
import {
  renderFolioStaticHome,
  writeFolioStaticSite,
} from "../dist/vite.js";

const template = '<!doctype html><html><head><title>Old</title></head><body><div id="root"></div></body></html>';

function doc(path, overrides = {}) {
  return {
    id: path,
    path,
    sourcePath: path.slice(1) + ".md",
    type: "article",
    title: path,
    description: "Description for " + path,
    group: "Notes",
    order: 99,
    tags: [],
    body: "## Body",
    headings: [],
    data: {},
    ...overrides,
  };
}

function baseConfig(overrides = {}) {
  return {
    title: "Field Notes",
    description: "A small journal",
    siteUrl: "https://example.com",
    collections: [
      { path: "/notes", title: "Notes" },
      { path: "/projects", title: "Projects", emptyMessage: "No projects yet" },
    ],
    ...overrides,
  };
}

function fixture(docs, config, fn) {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-home-"));
  try {
    writeFileSync(resolve(outDir, "index.html"), template);
    return fn({
      config,
      docs,
      roots: [],
      base: "/moyu/",
      outDir,
    }, outDir);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const docs = [
  doc("/notes/second", { order: 1, date: "2026-02-01", title: "Second note" }),
  doc("/notes/first", { order: 2, date: "2026-01-01", title: "First note" }),
  doc("/notes/third", { order: 3, date: "2025-01-01", title: "Third note" }),
  doc("/projects/folio", { type: "project", order: 1, title: "Folio project" }),
  doc("/info/about", { type: "page", order: 1, title: "About this site", description: "About body" }),
];

test("home model defaults mirror the editorial home selection and exclude the featured story from recent", () => {
  const model = resolveFolioHome(baseConfig(), docs);
  assert.deepEqual(model.sections.map((section) => section.type), [
    "intro",
    "featured",
    "recent",
    "collections",
    "about",
  ]);
  const featured = model.sections[1];
  assert.equal(featured.type, "featured");
  assert.equal(featured.doc.path, "/notes/second");
  assert.equal(featured.total, 3);
  const recent = model.sections[2];
  assert.deepEqual(recent.docs.map((item) => item.path), ["/notes/first", "/notes/third"]);
  const collections = model.sections[3];
  assert.deepEqual(collections.collections.map((entry) => entry.collection.path), ["/projects"]);
  const about = model.sections[4];
  assert.equal(about.doc.path, "/info/about");
});

test("configured home controls source, block visibility and order without hardcoded collection names", () => {
  const model = resolveFolioHome(baseConfig({
    home: {
      meta: { left: "NOTES", right: "ARCHIVE" },
      sections: [
        { type: "about", path: "/info/about", linkLabel: "Read more" },
        { type: "featured", collection: "/projects", path: "/projects/folio", label: "PICK" },
        { type: "recent", collection: "/projects", limit: 1 },
        { type: "collections", paths: ["/notes"], limit: 1 },
        { type: "intro", collection: "/notes", title: "Custom title", kicker: "CUSTOM" },
      ],
    },
  }), docs);

  assert.deepEqual(model.meta, { left: "NOTES", right: "ARCHIVE" });
  assert.deepEqual(model.sections.map((section) => section.type), [
    "about",
    "featured",
    "recent",
    "collections",
    "intro",
  ]);
  const featured = model.sections[1];
  assert.equal(featured.doc.path, "/projects/folio");
  assert.equal(featured.label, "PICK");
  const recent = model.sections[2];
  assert.deepEqual(recent.docs, []);
  assert.equal(recent.hadEntries, true);
  const collections = model.sections[3];
  assert.deepEqual(collections.collections[0].docs.map((item) => item.path), ["/notes/second"]);
  assert.equal(model.sections[4].title, "Custom title");
  assert.equal(model.sections[4].kicker, "CUSTOM");
});

test("empty collections, hidden meta and no sections stay explicit", () => {
  const empty = resolveFolioHome(baseConfig({
    collections: [{ path: "/notes", title: "Notes" }],
    home: {
      meta: false,
      sections: [
        { type: "featured" },
        { type: "recent" },
        { type: "collections" },
        { type: "about" },
      ],
    },
  }), []);

  assert.equal(empty.meta, undefined);
  assert.deepEqual(empty.sections.map((section) => section.type), ["recent"]);
  assert.deepEqual(empty.sections[0].docs, []);
  assert.equal(empty.sections[0].hadEntries, false);

  const hidden = resolveFolioHome(baseConfig({ home: { sections: [] } }), docs);
  assert.deepEqual(hidden.sections, []);
});

test("static configured home uses the same order, basePath links and escaped text", () => {
  fixture(docs, baseConfig({
    title: 'Field "Notes" <script>',
    description: "A <small> journal",
    home: {
      sections: [
        { type: "featured", path: "/notes/second", label: "PICK <now>" },
        { type: "recent", collection: "/notes", limit: 3 },
        { type: "collections", paths: ["/projects"] },
        { type: "intro", title: "Intro <b>", description: "Intro & copy" },
      ],
    },
  }), (context, outDir) => {
    writeFolioStaticSite(context);
    const html = readFileSync(resolve(outDir, "index.html"), "utf8");
    assert.ok(html.indexOf("folio-editorial-feature") < html.indexOf("folio-editorial-recent"));
    assert.ok(html.indexOf("folio-editorial-recent") < html.indexOf("folio-editorial-side-section"));
    assert.ok(html.indexOf("folio-editorial-side-section") < html.indexOf("folio-editorial-intro"));
    assert.match(html, /href="\/moyu\/notes\/second\/"/);
    assert.match(html, /href="\/moyu\/notes\/first\/"/);
    assert.match(html, /href="\/moyu\/projects\/folio\/"/);
    assert.match(html, /href="\/moyu\/notes\/"/);
    assert.match(html, /href="\/moyu\/projects\/"/);
    assert.match(html, /PICK &lt;now&gt;/);
    assert.match(html, /Intro &lt;b&gt;/);
    assert.match(html, /Intro &amp; copy/);
    assert.match(html, /Field &quot;Notes&quot; &lt;script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/moyu\/">/);
  });
});

test("configured home links stay correct at the root deployment base", () => {
  fixture(docs, baseConfig({
    home: {
      sections: [
        { type: "featured", collection: "/notes" },
        { type: "recent", collection: "/notes", limit: 1 },
      ],
    },
  }), (context, outDir) => {
    writeFolioStaticSite({ ...context, base: "/" });
    const html = readFileSync(resolve(outDir, "index.html"), "utf8");
    assert.match(html, /href="\/notes\/second\/"/);
    assert.match(html, /href="\/notes\/first\/"/);
    assert.doesNotMatch(html, /href="\/moyu\//);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/">/);
  });
});

test("configuring home does not change other static routes, 404, sitemap or robots", () => {
  const config = baseConfig({
    home: {
      sections: [
        { type: "intro", title: "Configured home" },
        { type: "recent", limit: 1 },
      ],
    },
  });
  fixture(docs, config, (context, outDir) => {
    const result = writeFolioStaticSite(context);
    assert.equal(result.routes, 8);
    assert.match(readFileSync(resolve(outDir, "index.html"), "utf8"), /Configured home/);
    assert.match(readFileSync(resolve(outDir, "notes/second/index.html"), "utf8"), /folio-article-main|folio-markdown/);
    assert.match(readFileSync(resolve(outDir, "notes/index.html"), "utf8"), /folio-collection-page/);
    assert.match(readFileSync(resolve(outDir, "projects/index.html"), "utf8"), /Folio project/);
    assert.match(readFileSync(resolve(outDir, "404.html"), "utf8"), /noindex,nofollow/);
    const sitemap = readFileSync(resolve(outDir, "sitemap.xml"), "utf8");
    assert.match(sitemap, /https:\/\/example\.com\/moyu\/notes\/second\//);
    assert.match(sitemap, /https:\/\/example\.com\/moyu\/projects\//);
    assert.match(readFileSync(resolve(outDir, "robots.txt"), "utf8"), /Sitemap: https:\/\/example\.com\/moyu\/sitemap\.xml/);
  });
});

test("static-only home override changes only '/' and keeps every other route intact", () => {
  fixture(docs, baseConfig(), (context, outDir) => {
    writeFolioStaticSite(context, {
      home: ({ docs: routeDocs }) => ({
        title: "Advanced home",
        description: "Own static home",
        body: '<main class="custom-home"><h1>Advanced home</h1><a href="/moyu/notes/second/">Open note</a></main>',
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Advanced home " + routeDocs.length,
        },
      }),
    });

    const home = readFileSync(resolve(outDir, "index.html"), "utf8");
    assert.match(home, /<title>Advanced home · Field Notes<\/title>/);
    assert.match(home, /<main class="custom-home"><h1>Advanced home<\/h1>/);
    assert.match(home, /https:\/\/example\.com\/moyu\//);
    assert.match(home, /"@type":"WebPage"/);
    assert.doesNotMatch(home, /folio-editorial-home/);

    assert.match(readFileSync(resolve(outDir, "notes/second/index.html"), "utf8"), /Second note/);
    assert.match(readFileSync(resolve(outDir, "notes/index.html"), "utf8"), /folio-collection-page/);
    assert.match(readFileSync(resolve(outDir, "404.html"), "utf8"), /Page not found/);
    assert.match(readFileSync(resolve(outDir, "sitemap.xml"), "utf8"), /<loc>https:\/\/example\.com\/moyu\/<\/loc>/);
    assert.match(readFileSync(resolve(outDir, "robots.txt"), "utf8"), /Sitemap: https:\/\/example\.com\/moyu\/sitemap\.xml/);
  });
});

test("static home override composes with a custom route set but still owns only '/'", () => {
  fixture(docs, baseConfig(), (context, outDir) => {
    writeFolioStaticSite({
      ...context,
      docs: [docs[0], docs[1]],
    }, {
      routes: () => [
        { path: "/", title: "Custom", description: "Custom home", body: "<main>custom default</main>" },
        { path: "/notes/second", title: "Second", description: "Second", body: "<main>custom second</main>" },
      ],
      home: () => ({ body: "<main>narrow home override</main>" }),
    });
    assert.match(readFileSync(resolve(outDir, "index.html"), "utf8"), /narrow home override/);
    assert.match(readFileSync(resolve(outDir, "notes/second/index.html"), "utf8"), /custom second/);
    assert.equal(existsSync(resolve(outDir, "notes/first/index.html")), false);
    assert.equal(existsSync(resolve(outDir, "notes/index.html")), false);
  });
});

test("static home override rejects a different path before writing output", () => {
  fixture(docs, baseConfig(), (context, outDir) => {
    assert.throws(
      () => writeFolioStaticSite(context, {
        home: { path: "/elsewhere", title: "Wrong", description: "Wrong", body: "<main>Wrong</main>" },
      }),
      /may only override the '\/' route/,
    );
    assert.equal(readFileSync(resolve(outDir, "index.html"), "utf8"), template);
    assert.equal(existsSync(resolve(outDir, "notes/index.html")), false);
  });
});

test("static home override requires a '/' route in a custom route set", () => {
  fixture(docs, baseConfig(), (context) => {
    assert.throws(
      () => writeFolioStaticSite({ ...context, docs: [] }, {
        routes: () => [{ path: "/notes", title: "Notes", description: "Notes", body: "<main>Notes</main>" }],
        home: { body: "<main>Home</main>" },
      }),
      /requires a '\/' route/,
    );
  });
});

test("home configuration failures are explicit", () => {
  const cases = [
    [{ home: { sections: [{ type: "unknown" }] } }, /unknown type/],
    [{ home: { sections: [{ type: "recent", limit: -1 }] } }, /non-negative integer/],
    [{ home: { sections: [{ type: "featured", path: "/missing" }] } }, /does not match any document/],
    [{ home: { sections: [{ type: "about", path: "/missing" }] } }, /does not match any document/],
    [{ home: { sections: [{ type: "collections", paths: ["/missing"] }] } }, /not a configured collection/],
    [{ home: { sections: [{ type: "intro", collection: "/info" }] } }, /not a configured collection/],
    [{ home: { sections: [{ type: "featured", collection: "/info" }] } }, /not a configured collection/],
    [{ home: { sections: [{ type: "recent", collection: "/info" }] } }, /not a configured collection/],
    [{ home: { sections: [{ type: "collections", paths: ["/notes", "/notes/"] }] } }, /duplicates/],
    [{ home: { sections: [{ type: "intro", title: 3 }] } }, /must be a string/],
  ];
  for (const [overrides, expected] of cases) {
    assert.throws(
      () => resolveFolioHome(baseConfig(overrides), docs),
      expected,
      JSON.stringify(overrides),
    );
  }
});

test("renderFolioStaticHome exposes the same configured body used by the default route", () => {
  fixture(docs, baseConfig({
    home: { sections: [{ type: "intro", title: "Exported home" }] },
  }), (context) => {
    const html = renderFolioStaticHome(context);
    assert.match(html, /<h1>Exported home<\/h1>/);
    assert.match(html, /href="\/moyu\/notes\/"/);
  });
});
