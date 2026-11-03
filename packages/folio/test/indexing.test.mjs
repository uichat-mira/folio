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
import {
  renderFolioStaticHtml,
  writeFolioStaticSite,
} from "../dist/vite.js";

// FOL-028 / Issue #127. The indexing policy has no new public helpers: every
// assertion below goes through the already-public `/vite` exports
// `renderFolioStaticHtml()` and `writeFolioStaticSite()`, and reads the files a
// real build actually wrote. The internal helpers stay free to change.

const PREVIEW_ROBOTS_TXT =
  "# Preview build: site-wide noindex. Crawling stays allowed so crawlers can read the page-level noindex.\n" +
  "User-agent: *\n" +
  "Allow: /\n";

const DEFAULT_ROBOTS_TXT =
  "User-agent: *\nAllow: /\nSitemap: https://preview.example.test/moyu/sitemap.xml\n";

// The template already carries stale SEO tags: the renderer must replace them,
// so a passing assertion cannot come from the template itself.
const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"><meta name="robots" content="stale"><link rel="canonical" href="https://stale.test/"></head><body><div id="root"></div></body></html>`;

const SITE_URL = "https://preview.example.test";

function articleDoc(path = "/notes/first") {
  return {
    id: "first",
    path,
    sourcePath: "notes/first.md",
    type: "article",
    title: "First note",
    description: "First note description",
    group: "Notes",
    collection: "Notes",
    section: "Notes",
    order: 1,
    tags: [],
    body: "## Section\nBody",
    headings: [{ depth: 2, text: "Section", id: "section" }],
    data: {},
  };
}

function docPage(path = "/notes/guide") {
  return {
    id: "guide",
    path,
    sourcePath: "notes/guide.md",
    type: "doc",
    title: "Guide",
    description: "Guide description",
    group: "Notes",
    collection: "Notes",
    section: "Start",
    order: 2,
    tags: [],
    body: "## Start\nGuide body",
    headings: [{ depth: 2, text: "Start", id: "start" }],
    data: {},
  };
}

function makeContext(
  outDir,
  { base = "/moyu/", siteUrl = SITE_URL, docs = [] } = {},
) {
  const config = {
    title: "Preview Site",
    description: "Preview documentation",
    collections: [{ path: "/notes", title: "Notes" }],
  };
  // `null` means "no siteUrl configured"; a default parameter would otherwise
  // swallow an explicit `undefined`.
  if (siteUrl !== null) config.siteUrl = siteUrl;

  return {
    config,
    docs,
    roots: ["notes"],
    base,
    outDir,
  };
}

function withBuildDir(prefix, run) {
  const base = mkdtempSync(resolve(tmpdir(), prefix));
  const outDir = resolve(base, "out");
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");
    return run({ outDir, read: (path) => readFileSync(resolve(outDir, path), "utf8") });
  } finally {
    rmSync(base, { recursive: true, force: true });
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

function indexedPageCount(sitemap) {
  return (sitemap.match(/<url>/g) ?? []).length;
}

test("renderFolioStaticHtml resolves robots precedence without changing SEO metadata", () => {
  const route = {
    path: "/notes/first",
    title: "First note",
    description: "First note description",
    body: "<main>First</main>",
    type: "article",
    doc: articleDoc(),
  };
  const context = makeContext("/tmp/folio-indexing", { docs: [articleDoc()] });
  const render = (options = {}, routeOverride = {}) =>
    renderFolioStaticHtml(template, { ...route, ...routeOverride }, context, options);

  // Built-in defaults and the explicit "index" policy are identical.
  assert.equal(robotsOf(render()), "index,follow");
  assert.equal(robotsOf(render({ siteIndexing: "index" })), "index,follow");

  // The policy only applies when the route has no explicit value.
  assert.equal(robotsOf(render({ siteIndexing: "noindex" })), "noindex,nofollow");

  // Explicit route.robots always wins over the policy, in both directions.
  assert.equal(
    robotsOf(render({ siteIndexing: "noindex" }, { robots: "index,follow" })),
    "index,follow",
  );
  assert.equal(
    robotsOf(render({ siteIndexing: "index" }, { robots: "noindex,nofollow" })),
    "noindex,nofollow",
  );
  assert.equal(
    robotsOf(render({ siteIndexing: "noindex" }, { robots: "noindex,follow" })),
    "noindex,follow",
  );

  // Falsy route.robots values keep their historical fallback semantics instead
  // of emitting an empty content="" attribute.
  assert.equal(
    robotsOf(render({ siteIndexing: "noindex" }, { robots: "" })),
    "noindex,nofollow",
  );
  assert.equal(
    robotsOf(render({ siteIndexing: "index" }, { robots: "" })),
    "index,follow",
  );

  // The policy changes indexing signals only: canonical, Open Graph and JSON-LD
  // stay identical, including the /moyu/ base path.
  const indexable = render();
  const preview = render({ siteIndexing: "noindex" });
  assert.notEqual(robotsOf(indexable), robotsOf(preview));
  for (const html of [indexable, preview]) {
    assert.equal(canonicalOf(html), `${SITE_URL}/moyu/notes/first/`);
    assert.match(html, /property="og:title" content="First note · Preview Site"/);
    assert.match(html, /property="og:url" content="https:\/\/preview\.example\.test\/moyu\/notes\/first\/"/);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ld, "expected JSON-LD in the rendered page");
    assert.deepEqual(JSON.parse(ld[1]), JSON.parse(indexable.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]));
  }
});

test("an ambiguous siteIndexing value throws instead of indexing silently", () => {
  const context = makeContext("/tmp/folio-indexing");
  const route = {
    path: "/notes/first",
    title: "First note",
    description: "First note description",
    body: "<main>First</main>",
  };

  for (const invalid of ["no-index", "noindex,nofollow", "true", "", "NOINDEX", false]) {
    assert.throws(
      () =>
        // A plain-JavaScript consumer can pass any value; the runtime guard is
        // the only contract that exists for them.
        renderFolioStaticHtml(template, route, context, { siteIndexing: invalid }),
      (error) => {
        assert.match(error.message, /siteIndexing/);
        assert.ok(
          error.message.includes(JSON.stringify(invalid)),
          `the error must name the received value ${JSON.stringify(invalid)}: ${error.message}`,
        );
        return true;
      },
      `expected siteIndexing ${JSON.stringify(invalid)} to be rejected`,
    );
  }
});

test("writeFolioStaticSite rejects an ambiguous siteIndexing before writing anything", () => {
  withBuildDir("folio-indexing-invalid-", ({ outDir, read }) => {
    assert.throws(
      () =>
        writeFolioStaticSite(makeContext(outDir, { docs: [articleDoc()] }), {
          siteIndexing: "no-index",
        }),
      (error) => {
        assert.match(error.message, /siteIndexing/);
        assert.ok(error.message.includes('"no-index"'));
        return true;
      },
    );

    // The pre-existing index.html is untouched and no static output exists.
    assert.equal(read("index.html"), template);
    for (const file of [
      "404.html",
      "sitemap.xml",
      "robots.txt",
      "notes/index.html",
      "notes/first/index.html",
    ]) {
      assert.equal(existsSync(resolve(outDir, file)), false, `must not write ${file}`);
    }
  });
});

test("default and noindex builds over the same /moyu/ fixture write consistent output", () => {
  const docs = [articleDoc(), docPage()];
  const build = (siteIndexing) =>
    withBuildDir("folio-indexing-pair-", ({ outDir, read }) => {
      writeFolioStaticSite(
        makeContext(outDir, { docs }),
        siteIndexing ? { siteIndexing } : {},
      );
      return {
        home: read("index.html"),
        collection: read("notes/index.html"),
        article: read("notes/first/index.html"),
        doc: read("notes/guide/index.html"),
        notFound: read("404.html"),
        robots: read("robots.txt"),
        sitemap: read("sitemap.xml"),
      };
    });

  const indexable = build();
  const preview = build("noindex");

  // Default mode: unchanged byte-compatible behavior. The two documents plus
  // the home page and the /notes collection index are the default route set.
  for (const page of ["home", "collection", "article", "doc"]) {
    assert.equal(robotsOf(indexable[page]), "index,follow", `${page} must stay indexable`);
  }
  assert.equal(robotsOf(indexable.notFound), "noindex,nofollow");
  assert.equal(indexable.robots, DEFAULT_ROBOTS_TXT);
  assert.equal(canonicalOf(indexable.home), `${SITE_URL}/moyu/`);
  assert.equal(canonicalOf(indexable.collection), `${SITE_URL}/moyu/notes/`);
  assert.equal(canonicalOf(indexable.article), `${SITE_URL}/moyu/notes/first/`);
  assert.equal(canonicalOf(indexable.doc), `${SITE_URL}/moyu/notes/guide/`);
  assert.equal(indexedPageCount(indexable.sitemap), 4);
  assert.ok(!indexable.sitemap.includes("404"));

  // Preview mode: every default route page is noindex, 404 keeps its explicit
  // noindex, and canonical/OG URLs still state the real preview URL.
  for (const page of ["home", "collection", "article", "doc"]) {
    assert.equal(robotsOf(preview[page]), "noindex,nofollow", `${page} must be noindex`);
    assert.ok(
      !preview[page].includes('<meta name="robots" content="index,follow">'),
      `${page} must not keep an indexable robots tag`,
    );
  }
  assert.equal(robotsOf(preview.notFound), "noindex,nofollow");
  assert.equal(canonicalOf(preview.home), canonicalOf(indexable.home));
  assert.equal(canonicalOf(preview.collection), canonicalOf(indexable.collection));
  assert.equal(canonicalOf(preview.article), canonicalOf(indexable.article));
  assert.equal(canonicalOf(preview.doc), canonicalOf(indexable.doc));

  // robots.txt: explicit preview marker, no Sitemap line, crawling still
  // allowed so crawlers can read the page-level noindex.
  assert.equal(preview.robots, PREVIEW_ROBOTS_TXT);
  assert.ok(!preview.robots.includes("Sitemap:"));
  assert.ok(!preview.robots.includes("Disallow"));

  // The preview sitemap still exists (unadvertised): it lists the same routes
  // and never the 404 page.
  assert.equal(indexedPageCount(preview.sitemap), 4);
  assert.ok(!preview.sitemap.includes("404"));
});

test("custom route pages and 404 inherit the policy at the root path", () => {
  const notFoundWithoutRobots = () => ({
    path: "/404",
    title: "Page not found",
    description: "The requested page could not be found.",
    body: "<main>Missing</main>",
  });
  const customRoutes = () => [
    {
      path: "/",
      title: "Home",
      description: "Custom home",
      body: "<main>Home</main>",
    },
    {
      path: "/custom",
      title: "Custom",
      description: "Custom route",
      body: "<main>Custom</main>",
    },
    {
      path: "/custom-explicit",
      title: "Explicit",
      description: "Explicitly indexable route",
      body: "<main>Explicit</main>",
      robots: "index,follow",
    },
    {
      path: "/custom-noindex",
      title: "Explicit noindex",
      description: "Explicitly noindex route",
      body: "<main>Noindex</main>",
      robots: "noindex,follow",
    },
  ];

  const build = (siteIndexing) =>
    withBuildDir("folio-indexing-custom-", ({ outDir, read }) => {
      writeFolioStaticSite(makeContext(outDir, { base: "/" }), {
        routes: customRoutes,
        notFound: notFoundWithoutRobots,
        ...(siteIndexing ? { siteIndexing } : {}),
      });
      return {
        home: read("index.html"),
        custom: read("custom/index.html"),
        explicit: read("custom-explicit/index.html"),
        explicitNoindex: read("custom-noindex/index.html"),
        notFound: read("404.html"),
        robots: read("robots.txt"),
      };
    });

  const indexable = build();
  const preview = build("noindex");

  // Root build: default mode stays indexable; an omitted notFound robots still
  // gets the not-found default instead of the index policy.
  assert.equal(robotsOf(indexable.home), "index,follow");
  assert.equal(robotsOf(indexable.custom), "index,follow");
  assert.equal(robotsOf(indexable.explicit), "index,follow");
  assert.equal(robotsOf(indexable.explicitNoindex), "noindex,follow");
  assert.equal(robotsOf(indexable.notFound), "noindex,nofollow");
  assert.equal(
    indexable.robots,
    "User-agent: *\nAllow: /\nSitemap: https://preview.example.test/sitemap.xml\n",
  );

  // Noindex mode: default custom pages are noindex; route.robots still wins and
  // the not-found page stays noindex even though the consumer omitted robots.
  assert.equal(robotsOf(preview.home), "noindex,nofollow");
  assert.equal(robotsOf(preview.custom), "noindex,nofollow");
  assert.equal(robotsOf(preview.explicit), "index,follow");
  assert.equal(robotsOf(preview.explicitNoindex), "noindex,follow");
  assert.equal(robotsOf(preview.notFound), "noindex,nofollow");
  assert.equal(preview.robots, PREVIEW_ROBOTS_TXT);

  // Canonical URLs are not fabricated or rewritten by the policy.
  assert.equal(canonicalOf(preview.home), `${SITE_URL}/`);
  assert.equal(canonicalOf(preview.custom), `${SITE_URL}/custom/`);
  assert.equal(canonicalOf(preview.home), canonicalOf(indexable.home));
  assert.equal(canonicalOf(preview.custom), canonicalOf(indexable.custom));
});

test("an explicit notFound robots value still wins over the 404 default", () => {
  withBuildDir("folio-indexing-notfound-", ({ outDir, read }) => {
    writeFolioStaticSite(makeContext(outDir, { base: "/" }), {
      siteIndexing: "noindex",
      routes: () => [
        { path: "/", title: "Home", description: "Home", body: "<main>Home</main>" },
      ],
      notFound: () => ({
        path: "/404",
        title: "Page not found",
        description: "The requested page could not be found.",
        body: "<main>Missing</main>",
        robots: "index,follow",
      }),
    });
    assert.equal(robotsOf(read("404.html")), "index,follow");
  });
});

test("robots and sitemap options stay independent from siteIndexing", () => {
  // robots: false still only means "do not write robots.txt"; pages are still
  // governed by the indexing policy.
  withBuildDir("folio-indexing-robots-off-", ({ outDir, read }) => {
    writeFolioStaticSite(makeContext(outDir, { docs: [articleDoc()] }), {
      siteIndexing: "noindex",
      robots: false,
    });
    assert.equal(existsSync(resolve(outDir, "robots.txt")), false);
    assert.equal(robotsOf(read("index.html")), "noindex,nofollow");
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), true);
  });

  // No siteUrl: robots.txt and sitemap.xml stay gated off, pages stay noindex.
  withBuildDir("folio-indexing-no-siteurl-", ({ outDir, read }) => {
    writeFolioStaticSite(
      makeContext(outDir, { docs: [articleDoc()], siteUrl: null }),
      { siteIndexing: "noindex" },
    );
    assert.equal(existsSync(resolve(outDir, "robots.txt")), false);
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), false);
    assert.equal(robotsOf(read("index.html")), "noindex,nofollow");
  });

  // sitemap: false already lets a consumer omit the preview sitemap; the
  // preview robots.txt still carries the marker instead of a Sitemap line.
  withBuildDir("folio-indexing-sitemap-off-", ({ outDir, read }) => {
    writeFolioStaticSite(makeContext(outDir, { docs: [articleDoc()] }), {
      siteIndexing: "noindex",
      sitemap: false,
    });
    assert.equal(read("robots.txt"), PREVIEW_ROBOTS_TXT);
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), false);
  });

  // robots: true in default mode keeps the exact historical robots.txt.
  withBuildDir("folio-indexing-robots-on-", ({ outDir, read }) => {
    writeFolioStaticSite(makeContext(outDir, { docs: [articleDoc()] }), {
      robots: true,
    });
    assert.equal(read("robots.txt"), DEFAULT_ROBOTS_TXT);
    assert.equal(existsSync(resolve(outDir, "sitemap.xml")), true);
  });
});
