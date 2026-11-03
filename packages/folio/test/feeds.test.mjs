import assert from "node:assert/strict";
import { createRequire } from "node:module";
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

import { writeFolioStaticSite } from "../dist/vite.js";
const require = createRequire(import.meta.url);
const externalFeedReader =
  process.env.FOLIO_EXTERNAL_FEED_READER === "1"
    ? require("@rowanmanning/feed-parser")
    : undefined;

import {
  parseXml,
  xmlAttribute,
  xmlElements,
  xmlFind,
  xmlText,
} from "../scripts/checks/xml.mjs";

const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>`;

function makeDoc({
  path,
  title,
  description = "",
  type = "article",
  order = 99,
  publishedAt,
  publishedSource = "frontmatter",
  updatedAt,
  updatedSource = "frontmatter",
  body = "",
}) {
  const hasDates = publishedAt !== undefined || updatedAt !== undefined;
  return {
    id: path,
    path,
    sourcePath: `content${path}.md`,
    type,
    title,
    description,
    group: "Test",
    order,
    publishedAt,
    updatedAt,
    dateSources: hasDates
      ? {
          publishedAt: publishedAt === undefined ? "unknown" : publishedSource,
          updatedAt: updatedAt === undefined ? "unknown" : updatedSource,
        }
      : undefined,
    tags: [],
    body,
    headings: [],
    data: {},
  };
}

function makeContext({ outDir, siteUrl = "https://example.com", base = "/", docs = [], config = {} }) {
  return {
    config: {
      title: "Test Site",
      description: "Test description",
      siteUrl,
      ...config,
    },
    docs,
    roots: [],
    base,
    outDir,
  };
}

function runBuild(
  outDir,
  {
    docs = [],
    base = "/",
    siteUrl = "https://example.com",
    config = {},
    feeds,
    routes,
    sitemap,
    robots,
    templateHtml = template,
  } = {},
) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "index.html"), templateHtml, "utf8");
  const options = {};
  if (feeds !== undefined) options.feeds = feeds;
  if (routes !== undefined) options.routes = routes;
  if (sitemap !== undefined) options.sitemap = sitemap;
  if (robots !== undefined) options.robots = robots;
  return writeFolioStaticSite(
    makeContext({ outDir, siteUrl, base, docs, config }),
    options,
  );
}

function withSite(run) {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-feeds-"));
  try {
    return run(outDir);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function htmlPath(outDir, route) {
  if (route === "/") return resolve(outDir, "index.html");
  if (route === "/404") return resolve(outDir, "404.html");
  return resolve(outDir, route.replace(/^\/+/, ""), "index.html");
}

function parseFeed(file) {
  const source = readFileSync(file, "utf8");
  assert.equal(
    (source.match(/<\?xml/g) ?? []).length,
    1,
    "the feed must contain exactly one XML declaration",
  );
  assert.ok(
    source.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    "the feed must start with a UTF-8 XML declaration",
  );
  return { source, root: parseXml(source) };
}

function child(node, name) {
  return xmlElements(node).find((element) => element.name === name);
}

function children(node, name) {
  return xmlElements(node).filter((element) => element.name === name);
}

function childText(node, name) {
  const element = child(node, name);
  return element ? xmlText(element) : undefined;
}

function rssChannel(root) {
  assert.equal(root.name, "rss");
  assert.equal(xmlAttribute(root, "version"), "2.0");
  const channel = child(root, "channel");
  assert.ok(channel, "RSS feed has no <channel>");
  return channel;
}

function itemByTitle(items, title) {
  return items.find((item) => childText(item, "title") === title);
}

function alternateLinks(html) {
  return [...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(
    (match) => match[0],
  );
}

test("RSS 2.0 and Atom 1.0 use absolute sub-path URLs and trusted dates", () =>
  withSite((outDir) => {
    const doc = makeDoc({
      path: "/blogs/hello",
      title: "Hello",
      description: "Hello world",
      publishedAt: "2025-06-07T00:09:10.000Z",
      updatedAt: "2025-06-08T10:11:12.000Z",
    });

    runBuild(outDir, {
      base: "/moyu/",
      docs: [doc],
      config: {
        collections: [
          { path: "/blogs", title: "博客", description: "博客描述" },
        ],
      },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const channel = rssChannel(rss.root);
    assert.equal(childText(channel, "title"), "博客");
    assert.equal(childText(channel, "link"), "https://example.com/moyu/");
    assert.equal(childText(channel, "description"), "博客描述");

    const self = child(channel, "atom:link");
    assert.ok(self, "RSS channel has no atom:link self reference");
    assert.equal(xmlAttribute(self, "rel"), "self");
    assert.equal(xmlAttribute(self, "type"), "application/rss+xml");
    assert.equal(xmlAttribute(self, "href"), "https://example.com/moyu/rss.xml");

    const items = children(channel, "item");
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(childText(item, "title"), "Hello");
    assert.equal(childText(item, "link"), "https://example.com/moyu/blogs/hello/");
    const guid = child(item, "guid");
    assert.equal(xmlAttribute(guid, "isPermaLink"), "true");
    assert.equal(xmlText(guid), "https://example.com/moyu/blogs/hello/");
    assert.equal(childText(item, "description"), "Hello world");
    assert.equal(childText(item, "pubDate"), "Sat, 07 Jun 2025 00:09:10 GMT");
    assert.equal(child(item, "lastBuildDate"), undefined);

    const atom = parseFeed(resolve(outDir, "atom.xml"));

    // Add an independent real-world feed reader to the XML structure checks.
    if (externalFeedReader) {
      const parsedRss = externalFeedReader.parseFeed(rss.source);
      assert.equal(parsedRss.meta.type, "rss");
      assert.equal(parsedRss.meta.version, "2.0");
      assert.equal(parsedRss.title, "博客");
      assert.equal(parsedRss.items.length, 1);
      assert.equal(parsedRss.items[0].title, "Hello");
      assert.equal(parsedRss.items[0].url, "https://example.com/moyu/blogs/hello/");
      assert.equal(parsedRss.items[0].published.toISOString(), "2025-06-07T00:09:10.000Z");

      const parsedAtom = externalFeedReader.parseFeed(atom.source);
      assert.equal(parsedAtom.meta.type, "atom");
      assert.equal(parsedAtom.meta.version, "1.0");
      assert.equal(parsedAtom.title, "博客");
      assert.equal(parsedAtom.items.length, 1);
      assert.equal(parsedAtom.items[0].title, "Hello");
      assert.equal(parsedAtom.items[0].url, "https://example.com/moyu/blogs/hello/");
      assert.equal(parsedAtom.items[0].published.toISOString(), "2025-06-07T00:09:10.000Z");
      assert.equal(parsedAtom.items[0].updated.toISOString(), "2025-06-08T10:11:12.000Z");
    }

    assert.equal(atom.root.name, "feed");
    assert.equal(
      xmlAttribute(atom.root, "xmlns"),
      "http://www.w3.org/2005/Atom",
    );
    assert.equal(childText(atom.root, "id"), "https://example.com/moyu/atom.xml");
    assert.equal(childText(atom.root, "title"), "博客");
    assert.equal(childText(atom.root, "subtitle"), "博客描述");
    assert.equal(
      childText(atom.root, "updated"),
      "2025-06-08T10:11:12.000Z",
    );

    const links = children(atom.root, "link");
    const selfLink = links.find((link) => xmlAttribute(link, "rel") === "self");
    assert.equal(xmlAttribute(selfLink, "type"), "application/atom+xml");
    assert.equal(
      xmlAttribute(selfLink, "href"),
      "https://example.com/moyu/atom.xml",
    );
    const alternate = links.find(
      (link) => xmlAttribute(link, "rel") === "alternate",
    );
    assert.equal(xmlAttribute(alternate, "type"), "text/html");
    assert.equal(xmlAttribute(alternate, "href"), "https://example.com/moyu/");
    assert.equal(childText(child(atom.root, "author"), "name"), "Test Site");

    const entries = children(atom.root, "entry");
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.equal(childText(entry, "id"), "https://example.com/moyu/blogs/hello/");
    assert.equal(
      xmlAttribute(child(entry, "link"), "href"),
      "https://example.com/moyu/blogs/hello/",
    );
    assert.equal(
      childText(entry, "updated"),
      "2025-06-08T10:11:12.000Z",
    );
    assert.equal(
      childText(entry, "published"),
      "2025-06-07T00:09:10.000Z",
    );
    assert.equal(childText(entry, "summary"), "Hello world");

    // Discovery must be exactly what was written, on every page shape.
    for (const route of ["/", "/blogs", "/blogs/hello", "/404"]) {
      const html = readFileSync(htmlPath(outDir, route), "utf8");
      const links = alternateLinks(html);
      assert.equal(links.length, 2, `unexpected alternate link count on ${route}`);
      assert.ok(
        links.includes(
          '<link rel="alternate" type="application/rss+xml" title="博客" href="https://example.com/moyu/rss.xml">',
        ),
        `missing RSS alternate on ${route}`,
      );
      assert.ok(
        links.includes(
          '<link rel="alternate" type="application/atom+xml" title="博客" href="https://example.com/moyu/atom.xml">',
        ),
        `missing Atom alternate on ${route}`,
      );
    }
  }));

test("root deployments keep folioAbsoluteRouteUrl trailing-slash conventions", () =>
  withSite((outDir) => {
    const doc = makeDoc({
      path: "/blogs/hello",
      title: "Hello",
      publishedAt: "2025-06-07T00:09:10.000Z",
    });

    runBuild(outDir, {
      base: "/",
      docs: [doc],
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const channel = rssChannel(rss.root);
    assert.equal(childText(channel, "link"), "https://example.com/");
    assert.equal(
      xmlAttribute(child(channel, "atom:link"), "href"),
      "https://example.com/rss.xml",
    );
    const item = children(channel, "item")[0];
    assert.equal(childText(item, "link"), "https://example.com/blogs/hello/");
    assert.equal(xmlText(child(item, "guid")), "https://example.com/blogs/hello/");

    const atom = parseFeed(resolve(outDir, "atom.xml"));
    assert.equal(childText(atom.root, "id"), "https://example.com/atom.xml");
    assert.equal(
      childText(children(atom.root, "entry")[0], "id"),
      "https://example.com/blogs/hello/",
    );
  }));

test("mixed document types under a route directory all serialize", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Article post",
        type: "article",
        order: 1,
        publishedAt: "2025-01-04T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/note",
        title: "Doc note",
        type: "doc",
        order: 2,
        publishedAt: "2025-01-03T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/about",
        title: "Page about",
        type: "page",
        order: 3,
        publishedAt: "2025-01-02T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/tool",
        title: "Project tool",
        type: "project",
        order: 4,
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      docs,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const items = children(rssChannel(rss.root), "item");
    assert.deepEqual(
      items.map((item) => childText(item, "title")),
      ["Article post", "Doc note", "Page about", "Project tool"],
    );

    const atom = parseFeed(resolve(outDir, "atom.xml"));
    const entries = children(atom.root, "entry");
    assert.deepEqual(
      entries.map((entry) => childText(entry, "title")),
      ["Article post", "Doc note", "Page about", "Project tool"],
    );
  }));

test("feed selection is recursive by route directory and titles fall back correctly", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/docs/guide/start",
        title: "Guide start",
        type: "doc",
        order: 1,
        publishedAt: "2025-01-03T00:00:00.000Z",
      }),
      makeDoc({
        path: "/docs/guide/deep/advanced",
        title: "Advanced",
        type: "article",
        order: 2,
        publishedAt: "2025-01-02T00:00:00.000Z",
      }),
      makeDoc({
        path: "/projects/other",
        title: "Other project",
        type: "project",
        order: 3,
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      docs,
      config: {
        collections: [{ path: "/docs/guide", title: "Guide" }],
      },
      feeds: [
        { path: "/docs/guide" },
        { path: "/docs/guide/deep", rss: "deep.xml", atom: "deep-atom.xml" },
      ],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const channel = rssChannel(rss.root);
    assert.equal(childText(channel, "title"), "Guide");
    assert.deepEqual(
      children(channel, "item").map((item) => childText(item, "title")),
      ["Guide start", "Advanced"],
    );

    // No configured collection for this deeper route: the site title is used.
    const deep = parseFeed(resolve(outDir, "deep.xml"));
    const deepChannel = rssChannel(deep.root);
    assert.equal(childText(deepChannel, "title"), "Test Site");
    assert.deepEqual(
      children(deepChannel, "item").map((item) => childText(item, "title")),
      ["Advanced"],
    );
    assert.equal(existsSync(resolve(outDir, "deep-atom.xml")), true);
  }));

test("dates are trusted by provenance: no Git first commit, mtime or build time", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/trusted",
        title: "Trusted",
        publishedAt: "2025-01-02T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/git-first",
        title: "Git first",
        publishedAt: "2024-01-01T00:00:00.000Z",
        publishedSource: "git-first-commit",
      }),
      makeDoc({
        path: "/blogs/updated-only",
        title: "Updated only",
        updatedAt: "2024-03-03T00:00:00.000Z",
        updatedSource: "git-last-commit",
      }),
      makeDoc({
        path: "/blogs/undated",
        title: "Undated",
      }),
    ];

    runBuild(outDir, {
      docs,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const items = children(rssChannel(rss.root), "item");
    assert.equal(items.length, 4, "every selected document must stay in RSS");

    assert.equal(
      childText(itemByTitle(items, "Trusted"), "pubDate"),
      "Thu, 02 Jan 2025 00:00:00 GMT",
    );
    for (const title of ["Git first", "Updated only", "Undated"]) {
      assert.equal(
        child(itemByTitle(items, title), "pubDate"),
        undefined,
        `${title} must not receive a guessed pubDate`,
      );
    }

    const atom = parseFeed(resolve(outDir, "atom.xml"));
    const entries = children(atom.root, "entry");
    assert.deepEqual(
      entries.map((entry) => childText(entry, "title")),
      ["Trusted", "Updated only"],
      "Atom must exclude entries with no trustworthy date",
    );
    const updatedOnly = entries.find(
      (entry) => childText(entry, "title") === "Updated only",
    );
    assert.equal(
      childText(updatedOnly, "updated"),
      "2024-03-03T00:00:00.000Z",
      "a trusted Git last commit is allowed as the Atom updated value",
    );
    assert.equal(child(updatedOnly, "published"), undefined);

    // Derived only from entry dates, never the build clock.
    assert.equal(childText(atom.root, "updated"), "2025-01-02T00:00:00.000Z");
    assert.equal(child(atom.root, "lastBuildDate"), undefined);
  }));

test("undated documents keep a valid RSS but produce no Atom feed", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({ path: "/blogs/first", title: "First", order: 1 }),
      makeDoc({ path: "/blogs/second", title: "Second", order: 2 }),
    ];

    runBuild(outDir, {
      docs,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const items = children(rssChannel(rss.root), "item");
    assert.equal(items.length, 2);
    for (const item of items) assert.equal(child(item, "pubDate"), undefined);
    assert.equal(existsSync(resolve(outDir, "atom.xml")), false);
    assert.equal(
      alternateLinks(readFileSync(htmlPath(outDir, "/"), "utf8")).length,
      1,
      "only the RSS file that was actually written may be advertised",
    );
  }));

test("an empty route directory writes a valid zero-item RSS and no Atom", () =>
  withSite((outDir) => {
    runBuild(outDir, {
      config: {
        collections: [{ path: "/blogs", title: "博客", description: "空" }],
      },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const channel = rssChannel(rss.root);
    assert.equal(childText(channel, "title"), "博客");
    assert.equal(children(channel, "item").length, 0);
    assert.equal(existsSync(resolve(outDir, "atom.xml")), false);
    assert.equal(
      alternateLinks(readFileSync(htmlPath(outDir, "/404"), "utf8")).length,
      1,
    );
  }));

test("entry order is publication date desc, then order, then path", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/b",
        title: "B same date order 1",
        order: 1,
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/a",
        title: "A same date order 2",
        order: 2,
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
      makeDoc({
        path: "/blogs/newest",
        title: "Newest",
        order: 9,
        publishedAt: "2025-03-01T00:00:00.000Z",
      }),
      makeDoc({ path: "/blogs/undated", title: "Undated order 0", order: 0 }),
      makeDoc({ path: "/blogs/z", title: "Undated z order 5", order: 5 }),
      makeDoc({ path: "/blogs/a2", title: "Undated a2 order 5", order: 5 }),
    ];

    runBuild(outDir, {
      docs,
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    assert.deepEqual(
      children(rssChannel(rss.root), "item").map((item) => childText(item, "title")),
      [
        "Newest",
        "B same date order 1",
        "A same date order 2",
        "Undated order 0",
        "Undated a2 order 5",
        "Undated z order 5",
      ],
    );
  }));

test("rss/atom false and custom nested names control the written files", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Blog post",
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
      makeDoc({
        path: "/docs/start",
        title: "Docs start",
        publishedAt: "2025-01-02T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      docs,
      config: {
        collections: [
          { path: "/blogs", title: "博客" },
          { path: "/docs", title: "文档" },
        ],
      },
      feeds: [
        { path: "/blogs", rss: false, atom: "feeds/atom.xml" },
        { path: "/docs", rss: "feeds/rss.xml", atom: false },
      ],
    });

    assert.equal(existsSync(resolve(outDir, "rss.xml")), false);
    assert.equal(existsSync(resolve(outDir, "atom.xml")), false);
    assert.equal(existsSync(resolve(outDir, "feeds", "atom.xml")), true);
    assert.equal(existsSync(resolve(outDir, "feeds", "rss.xml")), true);

    const atom = parseFeed(resolve(outDir, "feeds", "atom.xml"));
    assert.equal(
      childText(atom.root, "id"),
      "https://example.com/feeds/atom.xml",
    );
    assert.equal(childText(atom.root, "title"), "博客");

    const rss = parseFeed(resolve(outDir, "feeds", "rss.xml"));
    assert.equal(childText(rssChannel(rss.root), "title"), "文档");

    const links = alternateLinks(readFileSync(htmlPath(outDir, "/"), "utf8"));
    assert.deepEqual(links.sort(), [
      '<link rel="alternate" type="application/atom+xml" title="博客" href="https://example.com/feeds/atom.xml">',
      '<link rel="alternate" type="application/rss+xml" title="文档" href="https://example.com/feeds/rss.xml">',
    ]);
  }));

test("feed output paths cannot conflict with pages, 404, sitemap or robots", () => {
  const docs = [
    makeDoc({
      path: "/blogs/post",
      title: "Post",
      publishedAt: "2025-01-01T00:00:00.000Z",
    }),
  ];
  const config = { collections: [{ path: "/blogs", title: "Blogs" }] };
  const customRoutes = () => [
    { path: "/", title: "Home" },
    { path: "/custom/page", title: "Custom page" },
  ];
  const cases = [
    { feeds: [{ path: "/blogs", rss: "index.html", atom: false }], target: "index.html" },
    { feeds: [{ path: "/blogs", rss: "404.html", atom: false }], target: "404.html" },
    { feeds: [{ path: "/blogs", rss: "sitemap.xml", atom: false }], target: "sitemap.xml" },
    { feeds: [{ path: "/blogs", rss: "robots.txt", atom: false }], target: "robots.txt" },
    { feeds: [{ path: "/blogs", rss: false, atom: "blogs/post/index.html" }], target: "blogs/post/index.html" },
    { feeds: [{ path: "/blogs", rss: "blogs/index.html", atom: false }], target: "blogs/index.html" },
    // A feed file cannot be an ancestor of a generated page file.
    { feeds: [{ path: "/blogs", rss: "blogs", atom: false }], target: "blogs/index.html" },
    // Nor can it be nested below a generated page file.
    { feeds: [{ path: "/blogs", rss: false, atom: "blogs/index.html/feed.xml" }], target: "blogs/index.html" },
    // Fixed outputs such as sitemap.xml are files too, not directories.
    { feeds: [{ path: "/blogs", rss: "sitemap.xml/feed.xml", atom: false }], target: "sitemap.xml" },
    { feeds: [{ path: "/blogs", rss: "./sitemap.xml", atom: false }], target: "sitemap.xml" },
    { feeds: [{ path: "/blogs", rss: "SITEMAP.XML", atom: false }], target: "sitemap.xml" },
    { feeds: [{ path: "/blogs", rss: "sitemap.xml.", atom: false }], target: "sitemap.xml" },
    {
      feeds: [{ path: "/blogs", rss: "custom/page/index.html", atom: false }],
      target: "custom/page/index.html",
      routes: customRoutes,
    },
  ];

  for (const scenario of cases) {
    withSite((outDir) => {
      assert.throws(
        () =>
          runBuild(outDir, {
            docs,
            config,
            feeds: scenario.feeds,
            routes: scenario.routes,
          }),
        (error) => {
          assert.match(error.message, /folio static feed output conflict/);
          assert.ok(
            error.message.includes(scenario.target),
            `error must name ${scenario.target}, got: ${error.message}`,
          );
          return true;
        },
      );

      // The conflict is rejected before any page, fixed output or feed is
      // written: the existing template is untouched and no file appeared.
      assert.equal(
        readFileSync(resolve(outDir, "index.html"), "utf8"),
        template,
      );
      assert.equal(
        existsSync(resolve(outDir, "blogs")),
        false,
        "no route directory is created before a path-prefix conflict is rejected",
      );
      for (const file of [
        "blogs/index.html",
        "blogs/index.html/feed.xml",
        "blogs/post/index.html",
        "404.html",
        "sitemap.xml",
        "sitemap.xml/feed.xml",
        "robots.txt",
        "rss.xml",
        "atom.xml",
        "custom/page/index.html",
      ]) {
        assert.equal(
          existsSync(resolve(outDir, file)),
          false,
          `no partial output after a feed/static-output conflict: ${file}`,
        );
      }
    });
  }
});

test("a feed may reuse sitemap.xml or robots.txt only when that output is disabled", () => {
  const docs = [
    makeDoc({
      path: "/blogs/post",
      title: "Post",
      publishedAt: "2025-01-01T00:00:00.000Z",
    }),
  ];
  const config = { collections: [{ path: "/blogs", title: "Blogs" }] };

  withSite((outDir) => {
    runBuild(outDir, {
      docs,
      config,
      feeds: [{ path: "/blogs", rss: "sitemap.xml", atom: false }],
      sitemap: false,
    });
    assert.ok(
      readFileSync(resolve(outDir, "sitemap.xml"), "utf8").startsWith(
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"',
      ),
    );
    assert.equal(existsSync(resolve(outDir, "robots.txt")), true);
  });

  withSite((outDir) => {
    runBuild(outDir, {
      docs,
      config,
      feeds: [{ path: "/blogs", rss: "robots.txt", atom: false }],
      robots: false,
    });
    assert.ok(
      readFileSync(resolve(outDir, "robots.txt"), "utf8").startsWith(
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"',
      ),
    );
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), true);
  });
});

test("duplicate feed output names throw before any page or feed is written", () => {
  const cases = [
    {
      feeds: [{ path: "/blogs" }, { path: "/docs" }],
      expected: '"rss.xml"',
    },
    {
      feeds: [
        { path: "/blogs", rss: "feed.xml", atom: "feed.xml" },
        { path: "/docs", rss: false, atom: false },
      ],
      expected: '"feed.xml"',
    },
    {
      // "./feed.xml" normalizes to the same output as "feed.xml".
      feeds: [
        { path: "/blogs", rss: "./feed.xml", atom: false },
        { path: "/docs", rss: "feed.xml", atom: false },
      ],
      expected: '"feed.xml"',
    },
    {
      // Case and Windows-ambiguous trailing dots must not hide a duplicate.
      feeds: [
        { path: "/blogs", rss: "Feed.XML", atom: false },
        { path: "/docs", rss: "feed.xml.", atom: false },
      ],
      expected: '"feed.xml."',
    },
  ];

  for (const scenario of cases) {
    withSite((outDir) => {
      const docs = [
        makeDoc({
          path: "/blogs/post",
          title: "Blog post",
          publishedAt: "2025-01-01T00:00:00.000Z",
        }),
      ];
      assert.throws(
        () =>
          runBuild(outDir, {
            docs,
            config: {
              collections: [
                { path: "/blogs", title: "博客" },
                { path: "/docs", title: "文档" },
              ],
            },
            feeds: scenario.feeds,
          }),
        (error) => {
          assert.match(error.message, /folio static feed output conflict/);
          assert.ok(
            error.message.includes(scenario.expected),
            `error must name the colliding file, got: ${error.message}`,
          );
          return true;
        },
      );

      // The duplicate is rejected before the route writer runs.
      assert.equal(
        readFileSync(resolve(outDir, "index.html"), "utf8"),
        template,
      );
      for (const file of [
        "blogs/index.html",
        "blogs/post/index.html",
        "404.html",
        "sitemap.xml",
        "robots.txt",
        "rss.xml",
        "atom.xml",
        "feed.xml",
      ]) {
        assert.equal(
          existsSync(resolve(outDir, file)),
          false,
          `no partial output after duplicate feeds: ${file}`,
        );
      }
    });
  }
});

test("feed XML is structural, escaped and keeps Chinese and emoji", () =>
  withSite((outDir) => {
    const controls = "\u0000\u0001\u0008\u000B\u000C\u000E\u001F";
    const doc = makeDoc({
      path: "/blogs/特殊-路径",
      title: `章节 & <tag> "quote" 'apos' 🚀${controls}`,
      description: `<b>富文本</b> & "quotes" 中文 🚀${controls}`,
      publishedAt: "2025-01-01T00:00:00.000Z",
    });

    runBuild(outDir, {
      base: "/moyu/",
      docs: [doc],
      config: {
        title: `Site <&> "中文" 🚀${controls}`,
        description: `Desc & < > " ' 🚀${controls}`,
        collections: [{ path: "/blogs", title: `Feed <&> "quoted" 'apos' 🚀${controls}` }],
      },
      feeds: [{ path: "/blogs" }],
    });

    const rss = parseFeed(resolve(outDir, "rss.xml"));
    const channel = rssChannel(rss.root);
    const item = children(channel, "item")[0];

    assert.equal(
      childText(channel, "title"),
      'Feed <&> "quoted" \'apos\' 🚀',
    );
    assert.equal(
      childText(item, "title"),
      '章节 & <tag> "quote" \'apos\' 🚀',
    );
    assert.equal(
      childText(item, "description"),
      '<b>富文本</b> & "quotes" 中文 🚀',
    );
    assert.equal(
      xmlFind(item, "tag"),
      undefined,
      "rich text must be escaped as text, not interpreted as XML",
    );
    assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(rss.source));

    const atom = parseFeed(resolve(outDir, "atom.xml"));
    assert.equal(
      childText(atom.root, "title"),
      'Feed <&> "quoted" \'apos\' 🚀',
    );
    assert.equal(
      childText(children(atom.root, "entry")[0], "summary"),
      '<b>富文本</b> & "quotes" 中文 🚀',
    );
    assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(atom.source));

    // Attribute values are escaped as well (self link uses the base).
    assert.equal(
      xmlAttribute(child(channel, "atom:link"), "href"),
      "https://example.com/moyu/rss.xml",
    );
  }));

test("existing template alternate links are replaced, never duplicated", () =>
  withSite((outDir) => {
    const templateWithFeeds = `<!doctype html><html><head><title>Old</title><link type="application/rss+xml" rel="alternate" href="/old.xml"><link rel="alternate" type="application/atom+xml" href="/old-atom.xml"></head><body><div id="root"></div></body></html>`;
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Blog post",
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      docs,
      templateHtml: templateWithFeeds,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
    });

    const html = readFileSync(htmlPath(outDir, "/"), "utf8");
    const links = alternateLinks(html);
    assert.equal(links.length, 2, "stale template links must not survive");
    assert.ok(!html.includes("/old.xml"), "pre-existing RSS alternate survived");
    assert.ok(!html.includes("/old-atom.xml"), "pre-existing Atom alternate survived");
    assert.ok(
      links.includes(
        '<link rel="alternate" type="application/rss+xml" title="博客" href="https://example.com/rss.xml">',
      ),
    );
    assert.ok(
      links.includes(
        '<link rel="alternate" type="application/atom+xml" title="博客" href="https://example.com/atom.xml">',
      ),
    );
  }));

test("omitted feeds leave the page head and the file set unchanged", () =>
  withSite((outDir) => {
    const templateWithFeeds = `<!doctype html><html><head><title>Old</title><link rel="alternate" type="application/rss+xml" href="/kept.xml"></head><body><div id="root"></div></body></html>`;
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Blog post",
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, { docs, templateHtml: templateWithFeeds });

    const html = readFileSync(htmlPath(outDir, "/"), "utf8");
    assert.ok(
      html.includes('<link rel="alternate" type="application/rss+xml" href="/kept.xml">'),
      "omitting feeds must not touch a consumer's existing head links",
    );
    for (const file of ["rss.xml", "atom.xml"]) {
      assert.equal(existsSync(resolve(outDir, file)), false);
    }
    assert.equal(existsSync(resolve(outDir, "feeds")), false);
  }));

test("no siteUrl skips feed generation and alternate links entirely", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Blog post",
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      siteUrl: null,
      docs,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
    });

    assert.equal(existsSync(resolve(outDir, "rss.xml")), false);
    assert.equal(existsSync(resolve(outDir, "atom.xml")), false);
    assert.equal(
      alternateLinks(readFileSync(htmlPath(outDir, "/"), "utf8")).length,
      0,
    );
    assert.equal(
      alternateLinks(readFileSync(htmlPath(outDir, "/404"), "utf8")).length,
      0,
    );
  }));

test("custom route sets still receive feed discovery on every page", () =>
  withSite((outDir) => {
    const docs = [
      makeDoc({
        path: "/blogs/post",
        title: "Blog post",
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ];

    runBuild(outDir, {
      docs,
      config: { collections: [{ path: "/blogs", title: "博客" }] },
      feeds: [{ path: "/blogs" }],
      routes: () => [
        { path: "/", title: "Custom home", description: "Custom", body: "<main>Custom home</main>" },
        { path: "/custom", title: "Custom route", description: "Custom", body: "<main>Custom route</main>" },
      ],
    });

    for (const route of ["/", "/custom", "/404"]) {
      const links = alternateLinks(readFileSync(htmlPath(outDir, route), "utf8"));
      assert.equal(links.length, 2, `custom route set lost discovery on ${route}`);
    }
    assert.equal(existsSync(htmlPath(outDir, "/blogs/post")), false);
  }));

test("the structural XML helper rejects malformed documents", () => {
  assert.throws(() => parseXml("<a><b></a>"), /mismatched XML closing tag/);
  assert.throws(() => parseXml("<a>broken & entity</a>"), /invalid XML entity/);
  assert.throws(() => parseXml("<a></a><b></b>"), /exactly one root/);
  assert.throws(() => parseXml("<a>\u0001</a>"), /invalid control character/);
});

test("an invalid feed output name is rejected before any static file is written", () => {
  const base = mkdtempSync(resolve(tmpdir(), "folio-feed-escape-"));
  const outDir = resolve(base, "out");
  const outside = resolve(base, "outside");
  try {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(outside, { recursive: true });
    const sentinel = resolve(outside, "escape.xml");
    writeFileSync(sentinel, "sentinel", "utf8");

    assert.throws(
      () =>
        runBuild(outDir, {
          docs: [makeDoc({ path: "/blogs/post", title: "Blog post" })],
          feeds: [{ path: "/blogs", rss: "../escape.xml", atom: false }],
        }),
      (error) => {
        assert.match(
          error.message,
          /folio static feed "\/blogs" rss output name "\.\.\/escape\.xml"/,
        );
        assert.match(error.message, /escapes the static site root/);
        return true;
      },
    );

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
    assert.equal(
      readFileSync(resolve(outDir, "index.html"), "utf8"),
      template,
      "no page is written before the invalid feed name is rejected",
    );
    assert.equal(existsSync(resolve(outDir, "rss.xml")), false);

    // A drive-letter name would resolve outside outDir on Windows; it is
    // rejected by the same preflight instead of after the pages are written.
    assert.throws(
      () =>
        runBuild(outDir, {
          docs: [makeDoc({ path: "/blogs/post", title: "Blog post" })],
          feeds: [{ path: "/blogs", rss: "C:/escape.xml", atom: false }],
        }),
      (error) => {
        assert.match(error.message, /not valid in a static output path/);
        return true;
      },
    );
    assert.equal(
      readFileSync(resolve(outDir, "index.html"), "utf8"),
      template,
      "no page is written before the drive-letter name is rejected",
    );
    assert.equal(existsSync(resolve(outDir, "rss.xml")), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("an invalid feed source route fails with the feed path in the error", () =>
  withSite((outDir) => {
    assert.throws(
      () =>
        runBuild(outDir, {
          docs: [],
          feeds: [{ path: "/" }],
        }),
      (error) => {
        assert.match(error.message, /folio static feed "\/"/);
        assert.match(error.message, /non-root absolute route/);
        return true;
      },
    );
    assert.equal(existsSync(resolve(outDir, "rss.xml")), false);
  }));
