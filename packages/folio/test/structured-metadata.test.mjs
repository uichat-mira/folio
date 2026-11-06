// FOL-027 / Issue #126: article structured metadata, author precedence and
// sitemap <lastmod>. These are black-box acceptance tests through the published
// `/vite` entry: JSON-LD is parsed with JSON.parse and sitemap.xml is parsed
// with the shared dependency-free XML parser, never asserted as raw substrings.
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
import { renderFolioStaticHtml, writeFolioStaticSite } from "../dist/vite.js";
import { isW3cDatetime, parseSitemapXml } from "./helpers/xml.mjs";

const TEMPLATE =
  '<!doctype html><html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';
const SITE_URL = "https://example.com";
const BASE = "/moyu/";

function makeContext({ config = {}, outDir = resolve(tmpdir(), "folio-structured-unused") } = {}) {
  return {
    config: { title: "Folio", description: "Docs runtime", siteUrl: SITE_URL, ...config },
    docs: [],
    roots: [],
    base: BASE,
    outDir,
  };
}

function makeDoc(overrides = {}) {
  return {
    id: "post",
    path: "/blogs/post",
    sourcePath: "blogs/post.md",
    type: "article",
    title: "Post title",
    description: "Post description",
    group: "博客",
    order: 1,
    tags: [],
    body: "## Body\nHello",
    headings: [],
    data: {},
    ...overrides,
  };
}

function makeRoute(overrides = {}) {
  return {
    path: "/blogs/post",
    title: "Post title",
    description: "Post description",
    body: "<main>Post</main>",
    ...overrides,
  };
}

function parseJsonLd(html) {
  const scripts = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ];
  assert.equal(scripts.length, 1, "expected exactly one JSON-LD script");
  return JSON.parse(scripts[0][1]);
}

function renderJsonLd(route, context = makeContext(), options = {}) {
  return parseJsonLd(renderFolioStaticHtml(TEMPLATE, route, context, options));
}

function withStaticSite({ routes, docs = [], config = {}, options = {} }, run) {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-structured-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), TEMPLATE, "utf8");
    const context = makeContext({ config, outDir });
    context.docs = docs;
    writeFolioStaticSite(
      context,
      routes ? { routes: () => routes, ...options } : options,
    );
    run(outDir);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function readSitemap(outDir) {
  return parseSitemapXml(readFileSync(resolve(outDir, "sitemap.xml"), "utf8"));
}

function sitemapByLoc(outDir) {
  return new Map(readSitemap(outDir).map((entry) => [entry.loc, entry.lastmod]));
}

// --- JSON-LD: article fields, authors and trusted dates ---------------------

test("article JSON-LD projects frontmatter authors, trusted dates, URL and image", () => {
  const doc = makeDoc({
    data: {
      author: [
        { name: "Alice", url: "https://alice.example" },
        { name: "Bob" },
      ],
    },
    publishedAt: "2025-02-03T04:05:06.000Z",
    updatedAt: "2025-03-04T05:06:07.000Z",
    dateSources: { publishedAt: "frontmatter", updatedAt: "git-last-commit" },
    cover: "covers/post.png",
  });

  const jsonLd = renderJsonLd(
    makeRoute({ doc, type: "article", image: doc.cover }),
    makeContext(),
    { defaultImage: "logo.png" },
  );

  assert.equal(jsonLd["@context"], "https://schema.org");
  assert.equal(jsonLd["@type"], "Article");
  assert.equal(jsonLd.headline, "Post title");
  assert.equal(jsonLd.description, "Post description");
  assert.equal(jsonLd.url, "https://example.com/moyu/blogs/post/");
  assert.equal(jsonLd.image, "https://example.com/moyu/covers/post.png");
  assert.equal(jsonLd.datePublished, "2025-02-03T04:05:06.000Z");
  assert.equal(jsonLd.dateModified, "2025-03-04T05:06:07.000Z");
  assert.deepEqual(jsonLd.author, [
    { "@type": "Person", name: "Alice", url: "https://alice.example" },
    { "@type": "Person", name: "Bob" },
  ]);
  assert.deepEqual(jsonLd.publisher, { "@type": "Organization", name: "Folio" });
  assert.ok(
    !JSON.stringify(jsonLd).includes("[object Object]"),
    "frontmatter objects must never be stringified into a Person name",
  );
});

test("document JSON-LD maps to TechArticle and omits every absent field exactly", () => {
  const doc = makeDoc({
    type: "doc",
    path: "/docs/intro",
    sourcePath: "docs/intro.md",
    title: "Intro",
    description: "Intro description",
    data: {},
  });
  const jsonLd = renderJsonLd(
    makeRoute({ path: "/docs/intro", title: "Intro", description: "Intro description", doc }),
    makeContext({ config: { siteUrl: undefined } }),
  );

  assert.deepEqual(jsonLd, {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Intro",
    description: "Intro description",
    publisher: { "@type": "Organization", name: "Folio" },
  });
});

test("author precedence is frontmatter > config.author > omitted", () => {
  const configured = { author: "Site Author" };

  const frontmatterWins = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: { author: "Doc Author" } }) }),
    makeContext({ config: configured }),
  );
  assert.deepEqual(frontmatterWins.author, [
    { "@type": "Person", name: "Doc Author" },
  ]);

  const fallback = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext({ config: configured }),
  );
  assert.deepEqual(fallback.author, [
    { "@type": "Person", name: "Site Author" },
  ]);

  const omitted = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext(),
  );
  assert.ok(!("author" in omitted), "no configured author must omit the property");
  assert.ok(!JSON.stringify(omitted).includes('"author"'));
});

test("config.author supports a string, an object and an array of both", () => {
  const objectAuthor = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext({
      config: { author: { name: "Site Author", url: "https://site.example/about" } },
    }),
  );
  assert.deepEqual(objectAuthor.author, [
    { "@type": "Person", name: "Site Author", url: "https://site.example/about" },
  ]);

  const listAuthor = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext({
      config: {
        author: ["First Author", { name: "Second Author", url: "https://second.example" }],
      },
    }),
  );
  assert.deepEqual(listAuthor.author, [
    { "@type": "Person", name: "First Author" },
    { "@type": "Person", name: "Second Author", url: "https://second.example" },
  ]);
});

test("frontmatter author strings keep the legacy separator semantics", () => {
  const jsonLd = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: { author: "Alice | Bob，Carol, Dave" } }) }),
  );
  assert.deepEqual(
    jsonLd.author.map((person) => person.name),
    ["Alice", "Bob", "Carol", "Dave"],
  );
});

test("empty or blank author values never become an author array", () => {
  for (const author of [[], "", "   ", [{ name: "  " }, ""], [null, undefined]]) {
    const jsonLd = renderJsonLd(
      makeRoute({ doc: makeDoc({ data: {} }) }),
      makeContext({ config: { author } }),
    );
    assert.ok(
      !("author" in jsonLd),
      `config.author ${JSON.stringify(author)} must not emit an author property`,
    );
  }

  // An empty frontmatter author also falls back to the configured default
  // instead of suppressing a real author.
  const fallback = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: { author: "" } }) }),
    makeContext({ config: { author: "Site Author" } }),
  );
  assert.deepEqual(fallback.author, [{ "@type": "Person", name: "Site Author" }]);
});

test("only trusted date sources reach datePublished and dateModified", () => {
  const published = "2025-02-03T04:05:06.000Z";
  const updated = "2025-03-04T05:06:07.000Z";

  for (const source of ["frontmatter", "legacy-date"]) {
    const jsonLd = renderJsonLd(
      makeRoute({
        doc: makeDoc({
          publishedAt: published,
          dateSources: { publishedAt: source, updatedAt: "unknown" },
        }),
      }),
    );
    assert.equal(jsonLd.datePublished, published, `${source} must feed datePublished`);
    assert.ok(!("dateModified" in jsonLd));
  }

  for (const source of ["git-first-commit", "unknown"]) {
    const jsonLd = renderJsonLd(
      makeRoute({
        doc: makeDoc({
          publishedAt: published,
          dateSources: { publishedAt: source, updatedAt: "unknown" },
        }),
      }),
    );
    assert.ok(
      !("datePublished" in jsonLd),
      `${source} must never become datePublished`,
    );
  }

  for (const source of ["frontmatter", "git-last-commit"]) {
    const jsonLd = renderJsonLd(
      makeRoute({
        doc: makeDoc({
          updatedAt: updated,
          dateSources: { publishedAt: "unknown", updatedAt: source },
        }),
      }),
    );
    assert.equal(jsonLd.dateModified, updated, `${source} must feed dateModified`);
  }

  for (const source of ["git-first-commit", "unknown"]) {
    const jsonLd = renderJsonLd(
      makeRoute({
        doc: makeDoc({
          updatedAt: updated,
          dateSources: { publishedAt: "unknown", updatedAt: source },
        }),
      }),
    );
    assert.ok(
      !("dateModified" in jsonLd),
      `${source} must never become dateModified`,
    );
  }
});

test("dates without provenance are never inferred from build time, mtime or legacy display values", () => {
  // A hand-built document (or a consumer route) with values but no trusted
  // provenance: nothing may be emitted.
  const noProvenance = renderJsonLd(
    makeRoute({
      doc: makeDoc({
        date: "2020-01-01",
        publishedAt: "2025-02-03T04:05:06.000Z",
        updatedAt: "2025-03-04T05:06:07.000Z",
      }),
    }),
  );
  assert.ok(!("datePublished" in noProvenance));
  assert.ok(!("dateModified" in noProvenance));

  // The legacy display-only `date` field alone is not a structured-data date.
  const legacyDisplayOnly = renderJsonLd(
    makeRoute({ doc: makeDoc({ date: "2020-01-01", data: {} }) }),
  );
  assert.ok(!("datePublished" in legacyDisplayOnly));
});

test("JSON-LD escaping keeps untrusted title text inside valid JSON", () => {
  const title = 'A <script>alert("x")</script> title';
  const html = renderFolioStaticHtml(
    TEMPLATE,
    makeRoute({ title, doc: makeDoc({ title, data: { author: "A" } }) }),
    makeContext(),
  );
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.equal(parseJsonLd(html).headline, title);
});

// --- JSON-LD: page types ----------------------------------------------------

test("home, configured collection and unknown custom routes map to the right page type", () => {
  const home = renderJsonLd(
    makeRoute({ path: "/", title: "Folio", description: "Docs runtime" }),
    makeContext(),
  );
  assert.deepEqual(home, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Folio",
    description: "Docs runtime",
    url: "https://example.com/moyu/",
  });

  const collectionContext = makeContext({
    config: { collections: [{ path: "/blogs/", title: "博客", description: "Blog" }] },
  });
  const collection = renderJsonLd(
    makeRoute({ path: "/blogs", title: "博客", description: "Blog" }),
    collectionContext,
  );
  assert.deepEqual(collection, {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "博客",
    description: "Blog",
    url: "https://example.com/moyu/blogs/",
  });

  const custom = renderJsonLd(
    makeRoute({ path: "/custom", title: "Custom", description: "Custom page" }),
    makeContext(),
  );
  assert.deepEqual(custom, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Folio",
    url: "https://example.com/moyu/custom/",
  });
});

test("home WebSite omits the URL when no siteUrl is configured", () => {
  const home = renderJsonLd(
    makeRoute({ path: "/", title: "Folio", description: "Docs runtime" }),
    makeContext({ config: { siteUrl: undefined } }),
  );
  assert.equal(home["@type"], "WebSite");
  assert.ok(!("url" in home));
  assert.equal(home.description, "Docs runtime");
});

test("consumer-supplied route.jsonLd is never overwritten or merged", () => {
  const explicit = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: "Folio",
    codeRepository: "https://github.com/uichat-mira/folio",
  };
  const jsonLd = renderJsonLd(
    makeRoute({ jsonLd: explicit, doc: makeDoc({ data: { author: "Doc Author" } }) }),
  );
  assert.deepEqual(jsonLd, explicit);
});

// --- JSON-LD: image and og:type compatibility ------------------------------

test("image is emitted only when one resolves, honouring route image, defaultImage and logo", () => {
  const noImage = renderJsonLd(makeRoute({ doc: makeDoc({ data: {} }) }), makeContext());
  assert.ok(!("image" in noImage));

  const viaDefault = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext(),
    { defaultImage: "logo.png" },
  );
  assert.equal(viaDefault.image, "https://example.com/moyu/logo.png");

  const viaLogo = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext({ config: { logo: "/brand/logo.svg" } }),
  );
  assert.equal(viaLogo.image, "https://example.com/moyu/brand/logo.svg");

  const viaRoute = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }), image: "cover.png" }),
    makeContext(),
    { defaultImage: "logo.png" },
  );
  assert.equal(viaRoute.image, "https://example.com/moyu/cover.png");

  const withoutSiteUrl = renderJsonLd(
    makeRoute({ doc: makeDoc({ data: {} }) }),
    makeContext({ config: { siteUrl: undefined } }),
    { defaultImage: "logo.png" },
  );
  assert.equal(withoutSiteUrl.image, "/moyu/logo.png");
});

test("article routes keep og:type=article and the existing social image output", () => {
  const html = renderFolioStaticHtml(
    TEMPLATE,
    makeRoute({ type: "article", doc: makeDoc({ data: {} }) }),
    makeContext(),
    { defaultImage: "logo.png" },
  );

  assert.match(html, /<meta property="og:type" content="article">/);
  assert.equal((html.match(/property="og:image"/g) ?? []).length, 1);
  assert.match(html, /property="og:image" content="https:\/\/example\.com\/moyu\/logo\.png"/);
  assert.match(html, /property="og:image:secure_url" content="https:\/\/example\.com\/moyu\/logo\.png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/example\.com\/moyu\/logo\.png"/);
  assert.match(html, /name="robots" content="index,follow"/);
});

// --- Sitemap lastmod -------------------------------------------------------

test("sitemap emits lastmod only for explicit or trusted modification dates", () => {
  const updatedDoc = makeDoc({
    path: "/blogs/updated",
    publishedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-03-04T05:06:07.000Z",
    dateSources: { publishedAt: "frontmatter", updatedAt: "git-last-commit" },
  });
  const publishedOnlyDoc = makeDoc({
    path: "/blogs/published-only",
    publishedAt: "2025-01-01T00:00:00.000Z",
    dateSources: { publishedAt: "legacy-date", updatedAt: "unknown" },
  });
  const firstCommitDoc = makeDoc({
    path: "/blogs/first-commit",
    publishedAt: "2024-01-01T00:00:00.000Z",
    dateSources: { publishedAt: "git-first-commit", updatedAt: "unknown" },
  });
  const overriddenDoc = makeDoc({
    path: "/blogs/overridden",
    updatedAt: "2025-03-04T05:06:07.000Z",
    dateSources: { publishedAt: "unknown", updatedAt: "git-last-commit" },
  });

  const routes = [
    { path: "/", title: "Home", description: "Home", body: "<main>Home</main>" },
    { path: "/blogs", title: "博客", description: "Blog", body: "<main>Blog</main>" },
    { path: "/blogs/updated", title: "Updated", description: "Updated", body: "<main>x</main>", doc: updatedDoc },
    { path: "/blogs/published-only", title: "Published", description: "Published", body: "<main>x</main>", doc: publishedOnlyDoc },
    { path: "/blogs/first-commit", title: "First", description: "First", body: "<main>x</main>", doc: firstCommitDoc },
    {
      path: "/blogs/overridden",
      title: "Overridden",
      description: "Overridden",
      body: "<main>x</main>",
      doc: overriddenDoc,
      lastmod: "2025-06-07T08:09:10+08:00",
    },
    {
      path: "/dated",
      title: "Dated",
      description: "Dated",
      body: "<main>x</main>",
      lastmod: "2025-06-07",
    },
  ];

  withStaticSite(
    { routes, config: { collections: [{ path: "/blogs", title: "博客" }] } },
    (outDir) => {
      const entries = sitemapByLoc(outDir);
      assert.equal(entries.size, routes.length);
      // Neither the home page nor the collection index has a document date.
      assert.equal(entries.get("https://example.com/moyu/"), undefined);
      assert.equal(entries.get("https://example.com/moyu/blogs/"), undefined);
      // Trusted git-last-commit updatedAt.
      assert.equal(
        entries.get("https://example.com/moyu/blogs/updated/"),
        "2025-03-04T05:06:07.000Z",
      );
      // publishedAt is never a modification date.
      assert.equal(entries.get("https://example.com/moyu/blogs/published-only/"), undefined);
      assert.equal(entries.get("https://example.com/moyu/blogs/first-commit/"), undefined);
      // An explicit route value wins over the document's updatedAt and is
      // normalized to ISO 8601 UTC.
      assert.equal(
        entries.get("https://example.com/moyu/blogs/overridden/"),
        "2025-06-07T00:09:10.000Z",
      );
      assert.equal(entries.get("https://example.com/moyu/dated/"), "2025-06-07T00:00:00.000Z");

      for (const { loc, lastmod } of readSitemap(outDir)) {
        assert.ok(loc.startsWith("https://example.com/moyu/"), `unexpected loc ${loc}`);
        if (lastmod !== undefined) {
          assert.ok(isW3cDatetime(lastmod), `lastmod ${lastmod} for ${loc} must be a W3C datetime`);
        }
      }
      assert.ok(!readFileSync(resolve(outDir, "sitemap.xml"), "utf8").includes("404"));
      assert.equal(existsSync(resolve(outDir, "404.html")), true);
    },
  );
});

test("invalid explicit route.lastmod fails before any page is written", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-structured-invalid-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), TEMPLATE, "utf8");

    assert.throws(
      () =>
        writeFolioStaticSite(makeContext({ outDir }), {
          routes: () => [
            { path: "/valid-first", title: "Valid", description: "Valid page", body: "<main>valid</main>" },
            {
              path: "/bad-lastmod",
              title: "Bad",
              description: "Bad page",
              body: "<main>bad</main>",
              lastmod: "2024-02-30",
            },
          ],
        }),
      (error) => {
        assert.match(error.message, /folio static route "\/bad-lastmod" lastmod/);
        assert.ok(error.message.includes(JSON.stringify("2024-02-30")));
        assert.match(error.message, /ISO 8601/);
        return true;
      },
    );

    // The route set is validated before the first page: no partial site.
    assert.equal(existsSync(resolve(outDir, "valid-first/index.html")), false);
    assert.equal(existsSync(resolve(outDir, "404.html")), false);
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), false);
    assert.equal(existsSync(resolve(outDir, "robots.txt")), false);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("lastmod rejects date-times without an explicit timezone", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-structured-offset-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), TEMPLATE, "utf8");
    assert.throws(
      () =>
        writeFolioStaticSite(makeContext({ outDir }), {
          routes: () => [
            {
              path: "/no-offset",
              title: "No offset",
              description: "No offset",
              body: "<main>x</main>",
              lastmod: "2025-01-02T03:04:05",
            },
          ],
        }),
      /folio static route "\/no-offset" lastmod/,
    );
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), false);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// --- URL/base consistency across the default route set ---------------------

test("canonical, og:url, JSON-LD, sitemap loc and lastmod agree under /moyu/", () => {
  const unicodeDoc = makeDoc({
    path: "/blogs/中文-标题",
    sourcePath: "blogs/中文-标题.md",
    title: "中文标题",
    description: "中文描述",
    publishedAt: "2025-01-02T03:04:05.000Z",
    updatedAt: "2025-02-03T04:05:06.000Z",
    dateSources: { publishedAt: "frontmatter", updatedAt: "frontmatter" },
    data: { author: "作者" },
  });

  withStaticSite(
    {
      docs: [unicodeDoc],
      config: { collections: [{ path: "/blogs", title: "博客", description: "Blog" }] },
    },
    (outDir) => {
      const articleHtml = readFileSync(
        resolve(outDir, "blogs", "中文-标题", "index.html"),
        "utf8",
      );
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(articleHtml)[1];
      const ogUrl = /<meta property="og:url" content="([^"]+)"/.exec(articleHtml)[1];
      const articleLd = parseJsonLd(articleHtml);
      assert.equal(canonical, "https://example.com/moyu/blogs/中文-标题/");
      assert.equal(ogUrl, canonical);
      assert.equal(articleLd.url, canonical);
      assert.equal(articleLd.datePublished, "2025-01-02T03:04:05.000Z");
      assert.equal(articleLd.dateModified, "2025-02-03T04:05:06.000Z");

      const homeHtml = readFileSync(resolve(outDir, "index.html"), "utf8");
      const homeCanonical = /<link rel="canonical" href="([^"]+)"/.exec(homeHtml)[1];
      const homeLd = parseJsonLd(homeHtml);
      assert.equal(homeCanonical, "https://example.com/moyu/");
      assert.equal(homeLd["@type"], "WebSite");
      assert.equal(homeLd.url, homeCanonical);

      const collectionHtml = readFileSync(resolve(outDir, "blogs", "index.html"), "utf8");
      const collectionCanonical = /<link rel="canonical" href="([^"]+)"/.exec(collectionHtml)[1];
      const collectionLd = parseJsonLd(collectionHtml);
      assert.equal(collectionCanonical, "https://example.com/moyu/blogs/");
      assert.equal(collectionLd["@type"], "CollectionPage");
      assert.equal(collectionLd.url, collectionCanonical);

      const entries = sitemapByLoc(outDir);
      assert.equal(entries.get(homeCanonical), undefined);
      assert.equal(entries.get(collectionCanonical), undefined);
      assert.equal(entries.get(canonical), "2025-02-03T04:05:06.000Z");
      assert.deepEqual(
        [...entries.keys()].sort(),
        [
          "https://example.com/moyu/",
          "https://example.com/moyu/blogs/",
          "https://example.com/moyu/blogs/中文-标题/",
        ].sort(),
      );
    },
  );
});

test("custom static routes still work and keep their site-relative URLs consistent", () => {
  const routes = [
    { path: "/", title: "Home", description: "Home", body: "<main>Home</main>" },
    {
      path: "/custom/页面",
      title: "Custom",
      description: "Custom route",
      body: "<main>Custom</main>",
      lastmod: "2025-04-05",
    },
  ];

  withStaticSite({ routes }, (outDir) => {
    const html = readFileSync(resolve(outDir, "custom", "页面", "index.html"), "utf8");
    const ld = parseJsonLd(html);
    assert.equal(ld["@type"], "WebSite");
    assert.equal(ld.url, "https://example.com/moyu/custom/页面/");
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/moyu\/custom\/页面\/">/);
    assert.equal(sitemapByLoc(outDir).get(ld.url), "2025-04-05T00:00:00.000Z");
  });
});

test("default static output for an undated, un-authored document adds no metadata beyond the documented fields", () => {
  const plainDoc = makeDoc({
    type: "doc",
    path: "/docs/plain",
    sourcePath: "docs/plain.md",
    title: "Plain",
    description: "Plain document",
    data: {},
  });

  withStaticSite({ docs: [plainDoc] }, (outDir) => {
    const html = readFileSync(resolve(outDir, "docs", "plain", "index.html"), "utf8");
    const ld = parseJsonLd(html);
    assert.deepEqual(ld, {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Plain",
      description: "Plain document",
      url: "https://example.com/moyu/docs/plain/",
      publisher: { "@type": "Organization", name: "Folio" },
    });
    // No fabricated lastmod for a document without a trusted modification date.
    assert.equal(sitemapByLoc(outDir).get(ld.url), undefined);
  });
});
