// T3 static-output check (FOL-009): the isolated tarball consumer installed by
// verify-tarball-consumer.mjs runs one more real Vite build with static
// generation enabled, and every assertion below reads the files that build
// actually wrote.
//
// The generated pages must come from the public plugin entry. This module
// imports Node built-ins only and never calls writeFolioStaticSite(), so a
// passing run is evidence that the published tarball produces the static site
// through folio() -> writeBundle() by itself.
//
// Staged failures so a red run names the broken link in the chain:
//   [static]          the static-mode vite build did not succeed
//   [static:home]     index.html is missing or wrong
//   [static:doc]      the Markdown content page is missing or wrong
//   [static:404]      404.html is missing or is not noindex
//   [static:sitemap]  sitemap.xml is missing or does not describe the routes
//   [static:robots]   robots.txt is missing or points at the wrong sitemap
//   [static:seo]      FOL-027 SEO fixture: JSON-LD author/dates or sitemap
//                     <lastmod> is missing or invalid
//   [static:noindex]  the explicit siteIndexing: "noindex" build is not a
//                     consistent preview (page meta, robots.txt or canonical)
//   [static:feeds]    RSS/Atom files or their HTML discovery links are wrong
//   [static:control]  the staticRoutes-off control emitted static files
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isW3cDatetime, parseSitemapXml } from "../../test/helpers/xml.mjs";
import { parseXml, xmlAttribute, xmlElements, xmlText } from "./xml.mjs";

// A fixed, non-production deployment shape: an unrelated test domain plus a
// non-root base path, so canonical URLs, sitemap entries and internal links
// cannot accidentally match a root deployment.
const STATIC_SITE_URL = "https://example.test";
const STATIC_BASE = "/folio-smoke/";

const MARKER_PLACEHOLDER = "{{FOLIO_STATIC_MARKER}}";
const CONFIG_TITLE = "Folio Vite consumer fixture";
const DOC_TITLE = "Consumer discovery fixture";
const DOC_ROUTE = "/docs/hello";
const STATIC_OUT_DIR = "dist-static";
const NOINDEX_OUT_DIR = "dist-static-noindex";
const CONTROL_OUT_DIR = "dist-static-off";
const SEO_OUT_DIR = "dist-static-seo";
// verify-vite-consumer.mjs commits the fixture with GIT_COMMITTER_DATE
// "2024-01-02T03:04:05+08:00"; the trusted git-last-commit value is its UTC form.
const GIT_COMMIT_UPDATED_AT = "2024-01-01T19:04:05.000Z";
const SEO_SITE_PREFIX = `${STATIC_SITE_URL}${STATIC_BASE}`;

function check(stage, condition, message) {
  if (!condition) throw new Error(`[${stage}] FAIL ${message}`);
}

function readGenerated(stage, path, what) {
  check(stage, existsSync(path), `${what} was not generated at ${path}`);
  return readFileSync(path, "utf8");
}

function parseJsonLdScript(stage, html) {
  const scripts = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ];
  check(
    stage,
    scripts.length === 1,
    `expected exactly one JSON-LD script, found ${scripts.length}`,
  );
  try {
    return JSON.parse(scripts[0][1]);
  } catch (error) {
    throw new Error(`[${stage}] FAIL JSON-LD is not valid JSON: ${error.message}`);
  }
}

function parseSitemapOrFail(stage, xml) {
  try {
    return parseSitemapXml(xml);
  } catch (error) {
    throw new Error(`[${stage}] FAIL sitemap.xml did not parse as XML: ${error.message}`);
  }
}

function runBuild(
  viteCli,
  appDir,
  {
    outDir,
    staticMode,
    homeMode = "default",
    seoMode = false,
    contentDir = "content",
    feedsMode = false,
    siteIndexing,
  },
) {
  // Start from nothing so a file can only exist because this build wrote it.
  rmSync(join(appDir, outDir), { recursive: true, force: true });

  const result = spawnSync(
    process.execPath,
    [viteCli, "build", "--logLevel", "warn"],
    {
      cwd: appDir,
      encoding: "utf8",
      timeout: 300_000,
      env: {
        ...process.env,
        FOLIO_CONSUMER_OUT_DIR: outDir,
        FOLIO_CONSUMER_CONTENT_DIR: contentDir,
        FOLIO_CONSUMER_BASE: STATIC_BASE,
        FOLIO_CONSUMER_SITE_URL: STATIC_SITE_URL,
        FOLIO_CONSUMER_STATIC: staticMode ? "on" : "off",
        FOLIO_CONSUMER_HOME_MODE: homeMode,
        FOLIO_CONSUMER_SEO: seoMode ? "on" : "off",
        FOLIO_CONSUMER_FEEDS: feedsMode ? "on" : "off",
        // Only the explicit switch below can make the fixture a preview. The
        // installed package never infers one from the environment.
        ...(siteIndexing
          ? { FOLIO_CONSUMER_SITE_INDEXING: siteIndexing }
          : {}),
      },
    },
  );

  if (result.error) {
    throw new Error(
      `[static] FAIL vite build could not start: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `[static] FAIL vite build (staticRoutes: ${staticMode ? "on" : "off"}) exited with code ${result.status}\n` +
        `--- stdout ---\n${(result.stdout ?? "").trim()}\n` +
        `--- stderr ---\n${(result.stderr ?? "").trim()}`,
    );
  }

  return join(appDir, outDir);
}

function anchorHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*?\bhref="([^"]*)"/g)].map(
    (match) => match[1],
  );
}

function feedChild(node, name) {
  return xmlElements(node).find((element) => element.name === name);
}

function feedChildText(node, name) {
  const element = feedChild(node, name);
  return element ? xmlText(element) : undefined;
}

function parseGeneratedFeed(stage, path, what) {
  const source = readGenerated(stage, path, what);
  check(
    stage,
    (source.match(/<\?xml/g) ?? []).length === 1,
    `${what} must contain exactly one XML declaration`,
  );
  check(
    stage,
    source.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    `${what} does not start with a UTF-8 XML declaration`,
  );
  try {
    return parseXml(source);
  } catch (error) {
    throw new Error(`[${stage}] FAIL ${what} is not well-formed XML: ${error.message}`);
  }
}

function alternateHrefs(html) {
  return [...html.matchAll(/<link rel="alternate"[^>]*\bhref="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

export function verifyStaticConsumer({ consumerDir, appDir, log }) {
  const viteCli = join(consumerDir, "node_modules", "vite", "bin", "vite.js");
  check(
    "static",
    existsSync(viteCli),
    `the consumer installation has no Vite CLI at ${viteCli}`,
  );

  // A fresh marker per run: it is written into the Markdown immediately before
  // the build, so a generated page containing it cannot be a hardcoded shell
  // page or a leftover from an earlier build.
  const marker = `FOLIO_STATIC_${randomBytes(8).toString("hex")}`;
  const markdownPath = join(appDir, "content", "docs", "hello.md");
  check(
    "static",
    existsSync(markdownPath),
    `the prepared fixture has no Markdown at ${markdownPath}`,
  );
  const markdown = readFileSync(markdownPath, "utf8");
  check(
    "static",
    markdown.includes(MARKER_PLACEHOLDER),
    `${markdownPath} has no ${MARKER_PLACEHOLDER} placeholder`,
  );
  writeFileSync(markdownPath, markdown.replaceAll(MARKER_PLACEHOLDER, marker));

  const distDir = runBuild(viteCli, appDir, {
    outDir: STATIC_OUT_DIR,
    staticMode: true,
  });
  log(
    `[static]   ok  vite build (staticRoutes: on, base ${STATIC_BASE}) wrote ${distDir}`,
  );

  // The build succeeded, so anything missing here was not generated by the
  // plugin: this is the assertion that fails when staticRoutes is off, when the
  // writeBundle stage throws, or when the output escapes the configured outDir.
  const expectedFiles = [
    "index.html",
    join("docs", "hello", "index.html"),
    join("blogs", "index.html"),
    join("projects", "index.html"),
    "404.html",
    "sitemap.xml",
    "robots.txt",
  ];
  const missingFiles = expectedFiles.filter(
    (relative) => !existsSync(join(distDir, relative)),
  );
  check(
    "static",
    missingFiles.length === 0,
    `the static-mode build did not generate ${missingFiles
      .map((relative) => relative.replace(/\\/g, "/"))
      .join(", ")} in ${distDir}; ` +
      "folio()'s writeBundle stage did not produce the configured site",
  );

  // The build's own asset graph must survive static generation: the pages keep
  // referring to the hashed client bundle under the deployment base.
  const staticIndex = readGenerated(
    "static:home",
    join(distDir, "index.html"),
    "the home page",
  );
  const assetRefs = [
    ...staticIndex.matchAll(/["'](\/folio-smoke\/assets\/[^"']+\.js)["']/g),
  ].map((match) => match[1]);
  check(
    "static:home",
    assetRefs.length > 0,
    `the home page has no /folio-smoke/assets/*.js reference; base ${STATIC_BASE} did not reach the static HTML`,
  );
  for (const assetRef of assetRefs) {
    const assetPath = join(distDir, assetRef.replace("/folio-smoke/", ""));
    check(
      "static:home",
      existsSync(assetPath),
      `the home page references ${assetRef} but ${assetPath} does not exist`,
    );
  }

  check(
    "static:home",
    staticIndex.includes(`<title>${CONFIG_TITLE}</title>`),
    `the home page title is not ${JSON.stringify(CONFIG_TITLE)}`,
  );
  check(
    "static:home",
    staticIndex.includes(`<h1>${CONFIG_TITLE}</h1>`),
    "the home page does not contain the configured title heading",
  );
  check(
    "static:home",
    staticIndex.includes(
      '<link rel="canonical" href="https://example.test/folio-smoke/">',
    ),
    "the home page canonical URL is not https://example.test/folio-smoke/",
  );
  check(
    "static:home",
    staticIndex.includes('<meta name="robots" content="index,follow">'),
    "the home page is not indexable",
  );
  check(
    "static:home",
    staticIndex.includes('<div id="root"><main class="folio-home folio-journal-home folio-editorial-home">'),
    "the home page did not receive prerendered content inside #root",
  );
  check(
    "static:home",
    !staticIndex.includes(marker),
    `the home page contains the content marker ${marker}; per-route content is not isolated`,
  );
  log(
    `[static]   ok  index.html  title, canonical https://example.test/folio-smoke/, base-prefixed asset ${assetRefs[0]}`,
  );

  const docIndex = readGenerated(
    "static:doc",
    join(distDir, "docs", "hello", "index.html"),
    `the content page for ${DOC_ROUTE}`,
  );
  check(
    "static:doc",
    docIndex.includes(`<title>${DOC_TITLE} · ${CONFIG_TITLE}</title>`),
    `the content page title is not "${DOC_TITLE} · ${CONFIG_TITLE}"`,
  );
  check(
    "static:doc",
    docIndex.includes(`<h1>${DOC_TITLE}</h1>`),
    "the content page does not contain the Markdown frontmatter title",
  );
  check(
    "static:doc",
    docIndex.includes(
      '<link rel="canonical" href="https://example.test/folio-smoke/docs/hello/">',
    ),
    "the content page canonical URL is not https://example.test/folio-smoke/docs/hello/",
  );

  const article = docIndex.match(
    /<article class="folio-markdown">([\s\S]*?)<\/article>/,
  );
  check(
    "static:doc",
    Boolean(article),
    "the content page has no folio-markdown article body",
  );
  check(
    "static:doc",
    article[1].includes(marker),
    `the content body does not contain this run's marker ${marker}; the HTML did not come from the current Markdown`,
  );
  check(
    "static:doc",
    article[1].includes("Static output section"),
    "the content body is missing the Markdown section heading",
  );
  check(
    "static:doc",
    docIndex.includes(
      '<h2 id="static-output-section">Static output section',
    ),
    "the Markdown section heading was not rendered with a stable id",
  );
  check(
    "static:doc",
    docIndex.includes('href="#static-output-section"'),
    "the in-page table of contents does not link to the section anchor",
  );

  const hrefs = anchorHrefs(docIndex);
  check(
    "static:doc",
    hrefs.length > 0,
    "the content page contains no internal links",
  );
  // In-page anchors and absolute external URLs are unaffected by the deployment
  // base; every other link is a site-relative route and must carry the base.
  const unbased = hrefs.filter(
    (href) =>
      !href.startsWith("#") &&
      !href.startsWith(STATIC_BASE) &&
      !/^[a-z][a-z0-9+.-]*:/i.test(href),
  );
  check(
    "static:doc",
    unbased.length === 0,
    `site-relative links escape the deployment base ${STATIC_BASE}: ${unbased.join(", ")}`,
  );
  check(
    "static:doc",
    hrefs.includes(`${STATIC_BASE}docs/hello/`),
    `the document navigation does not link to ${STATIC_BASE}docs/hello/`,
  );
  check(
    "static:doc",
    /<a\b[^>]*aria-current="page"[^>]*href="\/folio-smoke\/docs\/hello\/"/.test(
      docIndex,
    ),
    "the current document is not marked as the active navigation entry",
  );
  log(
    `[static]   ok  docs/hello/index.html  marker ${marker}, base-prefixed links only (${hrefs.length} anchors)`,
  );

  const notFound = readGenerated(
    "static:404",
    join(distDir, "404.html"),
    "404.html",
  );
  check(
    "static:404",
    notFound.includes('<meta name="robots" content="noindex,nofollow">'),
    "404.html is not noindex,nofollow",
  );
  check(
    "static:404",
    notFound.includes(`<title>Page not found · ${CONFIG_TITLE}</title>`),
    "404.html does not carry the not-found title",
  );
  check(
    "static:404",
    !existsSync(join(distDir, "404", "index.html")),
    "a routable 404/index.html was generated; the not-found page must not be indexable",
  );
  log("[static]   ok  404.html  noindex,nofollow");

  // FOL-022: real collection index routes must survive npm tarball
  // installation and remain readable without a running React client.
  for (const [route, heading, emptyMessage] of [
    ["blogs", "博客", "这里还没有内容。"],
    ["projects", "项目", "这里还没有内容。"],
  ]) {
    const html = readGenerated(
      "static:collection",
      join(distDir, route, "index.html"),
      route + "/index.html",
    );
    check(
      "static:collection",
      html.includes('<h1>' + heading + '</h1>'),
      route + " default index is missing its title",
    );
    check(
      "static:collection",
      html.includes(emptyMessage),
      route + " default index is missing its empty-state content",
    );
    check(
      "static:collection",
      html.includes('<link rel="canonical" href="https://example.test/folio-smoke/' + route + '/">'),
      route + " index canonical is not under the deployment base",
    );
    check(
      "static:collection",
      html.includes('"@type":"CollectionPage"'),
      route + " index is missing CollectionPage structured data",
    );
  }
  log("[static]   ok  blogs/ and projects/ indexes are prerendered");

  const sitemap = readGenerated(
    "static:sitemap",
    join(distDir, "sitemap.xml"),
    "sitemap.xml",
  );
  check(
    "static:sitemap",
    sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    "sitemap.xml has no XML declaration",
  );
  check(
    "static:sitemap",
    sitemap.includes("<loc>https://example.test/folio-smoke/</loc>"),
    "sitemap.xml does not list the home page under the deployment base",
  );
  check(
    "static:sitemap",
    sitemap.includes("<loc>https://example.test/folio-smoke/docs/hello/</loc>"),
    "sitemap.xml does not list the content page under the deployment base",
  );
  for (const route of ["blogs", "projects"]) {
    check(
      "static:sitemap",
      sitemap.includes("<loc>https://example.test/folio-smoke/" + route + "/</loc>"),
      "sitemap.xml is missing the " + route + " collection",
    );
  }
  check(
    "static:sitemap",
    (sitemap.match(/<url>/g) ?? []).length === 4,
    "sitemap.xml does not contain the home, document, and two collection indexes",
  );
  check(
    "static:sitemap",
    !sitemap.includes("404"),
    "sitemap.xml advertises the not-found page",
  );
  // FOL-027: the content document has an explicit `publishedAt` but no
  // `updatedAt`, so the trusted git-last-commit value is the only valid
  // <lastmod>; the home page and collection indexes have no document date and
  // must keep only <loc>.
  const staticSitemap = parseSitemapOrFail("static:sitemap", sitemap);
  const staticSitemapByLoc = new Map(
    staticSitemap.map((entry) => [entry.loc, entry.lastmod]),
  );
  check(
    "static:sitemap",
    staticSitemapByLoc.get(`${SEO_SITE_PREFIX}docs/hello/`) === GIT_COMMIT_UPDATED_AT,
    `the content page lastmod is ${JSON.stringify(staticSitemapByLoc.get(`${SEO_SITE_PREFIX}docs/hello/`))}, expected its trusted git updatedAt`,
  );
  for (const loc of [`${SEO_SITE_PREFIX}`, `${SEO_SITE_PREFIX}blogs/`, `${SEO_SITE_PREFIX}projects/`]) {
    check(
      "static:sitemap",
      staticSitemapByLoc.get(loc) === undefined,
      `${loc} must not fabricate a lastmod without a trusted modification date`,
    );
  }
  log("[static]   ok  sitemap.xml  four base-prefixed routes, trusted lastmod only, no 404");

  const robots = readGenerated(
    "static:robots",
    join(distDir, "robots.txt"),
    "robots.txt",
  );
  const expectedRobots = `User-agent: *\nAllow: /\nSitemap: https://example.test/folio-smoke/sitemap.xml\n`;
  check(
    "static:robots",
    robots === expectedRobots,
    `robots.txt is ${JSON.stringify(robots)}, expected ${JSON.stringify(expectedRobots)}`,
  );
  log("[static]   ok  robots.txt  points at the base-prefixed sitemap");

  // FOL-028: the installed tarball must also be able to build the same fixture
  // as an explicit preview. This is a second real Vite build over the same
  // content, base and site URL, so only the explicit siteIndexing option can
  // explain the difference in indexing signals.
  const noindexDir = runBuild(viteCli, appDir, {
    outDir: NOINDEX_OUT_DIR,
    staticMode: true,
    siteIndexing: "noindex",
  });
  for (const [relative, canonical] of [
    ["index.html", "https://example.test/folio-smoke/"],
    [
      join("docs", "hello", "index.html"),
      "https://example.test/folio-smoke/docs/hello/",
    ],
    [join("blogs", "index.html"), "https://example.test/folio-smoke/blogs/"],
    [
      join("projects", "index.html"),
      "https://example.test/folio-smoke/projects/",
    ],
  ]) {
    const label = relative.replace(/\\/g, "/");
    const html = readGenerated(
      "static:noindex",
      join(noindexDir, relative),
      label,
    );
    check(
      "static:noindex",
      html.includes('<meta name="robots" content="noindex,nofollow">'),
      `${label} is not noindex,nofollow`,
    );
    check(
      "static:noindex",
      !html.includes('<meta name="robots" content="index,follow">'),
      `${label} still declares index,follow`,
    );
    check(
      "static:noindex",
      html.includes(`<link rel="canonical" href="${canonical}">`),
      `${label} canonical changed under siteIndexing: "noindex" (expected ${canonical})`,
    );
  }
  const noindexNotFound = readGenerated(
    "static:noindex",
    join(noindexDir, "404.html"),
    "404.html",
  );
  check(
    "static:noindex",
    noindexNotFound.includes('<meta name="robots" content="noindex,nofollow">'),
    "the preview 404.html is not noindex,nofollow",
  );
  const expectedNoindexRobots = `# Preview build: site-wide noindex. Crawling stays allowed so crawlers can read the page-level noindex.\nUser-agent: *\nAllow: /\n`;
  const noindexRobots = readGenerated(
    "static:noindex",
    join(noindexDir, "robots.txt"),
    "robots.txt",
  );
  check(
    "static:noindex",
    noindexRobots === expectedNoindexRobots,
    `preview robots.txt is ${JSON.stringify(noindexRobots)}, expected ${JSON.stringify(expectedNoindexRobots)}`,
  );
  check(
    "static:noindex",
    !noindexRobots.includes("Sitemap:"),
    "preview robots.txt advertises a sitemap",
  );
  check(
    "static:noindex",
    !/^\s*Disallow:/m.test(noindexRobots),
    "preview robots.txt disallows crawling, which would hide the page-level noindex",
  );
  // The preview sitemap may exist (it is simply not advertised), but it must
  // still describe the real routes and never the not-found page.
  const noindexSitemap = readGenerated(
    "static:noindex",
    join(noindexDir, "sitemap.xml"),
    "sitemap.xml",
  );
  check(
    "static:noindex",
    (noindexSitemap.match(/<url>/g) ?? []).length === 4,
    "the preview sitemap no longer lists the four base-prefixed routes",
  );
  check(
    "static:noindex",
    !noindexSitemap.includes("404"),
    "the preview sitemap advertises the not-found page",
  );
  check(
    "static:noindex",
    noindexNotFound.includes(
      `<title>Page not found · ${CONFIG_TITLE}</title>`,
    ),
    "the preview 404.html does not carry the not-found title",
  );
  check(
    "static:noindex",
    readFileSync(join(noindexDir, "docs", "hello", "index.html"), "utf8").includes(
      marker,
    ),
    `the preview document page does not contain this run's marker ${marker}`,
  );
  log(
    '[static]   ok  siteIndexing: "noindex" build  every page noindex,nofollow, canonicals unchanged, preview robots.txt, sitemap unadvertised',
  );

  // FOL-026 compatibility counter-check: this same build has no `feeds`
  // configured, so it must produce no feed file and no alternate link.
  for (const relative of ["rss.xml", "atom.xml", join("feeds", "blogs.xml")]) {
    check(
      "static",
      !existsSync(join(distDir, relative)),
      `a build without feeds produced ${relative.replace(/\\/g, "/")}`,
    );
  }
  check(
    "static:home",
    !staticIndex.includes('rel="alternate"'),
    "a build without feeds added an alternate discovery link",
  );
  log("[static]   ok  no feeds configured: no feed files and no alternate links");

  // FOL-026: the installed tarball enables feeds from consumer config alone.
  // `/docs` has one dated document; the configured `/blogs` collection has no
  // documents, so it must still publish a valid zero-item RSS and no Atom.
  const feedsDir = runBuild(viteCli, appDir, {
    outDir: "dist-feeds",
    staticMode: true,
    feedsMode: true,
  });
  const rss = parseGeneratedFeed("static:feeds", join(feedsDir, "rss.xml"), "rss.xml");
  const rssChannel = feedChild(rss, "channel");
  check("static:feeds", rss.name === "rss", "rss.xml root element is not <rss>");
  check(
    "static:feeds",
    xmlAttribute(rss, "version") === "2.0",
    "rss.xml is not RSS 2.0",
  );
  check("static:feeds", Boolean(rssChannel), "rss.xml has no <channel>");
  check(
    "static:feeds",
    feedChildText(rssChannel, "title") === "文档",
    "rss.xml channel title is not the configured feed title",
  );
  check(
    "static:feeds",
    feedChildText(rssChannel, "link") === "https://example.test/folio-smoke/",
    "rss.xml channel link is not the base-prefixed site root",
  );
  check(
    "static:feeds",
    xmlAttribute(feedChild(rssChannel, "atom:link"), "href") ===
      "https://example.test/folio-smoke/rss.xml",
    "rss.xml atom:link self is not the absolute feed URL",
  );
  const rssItems = xmlElements(rssChannel).filter((element) => element.name === "item");
  check("static:feeds", rssItems.length === 1, `rss.xml has ${rssItems.length} items, expected 1`);
  const rssItem = rssItems[0];
  check(
    "static:feeds",
    feedChildText(rssItem, "title") === DOC_TITLE,
    "rss.xml item title is not the Markdown title",
  );
  check(
    "static:feeds",
    feedChildText(rssItem, "link") === "https://example.test/folio-smoke/docs/hello/",
    "rss.xml item link is not the absolute base-prefixed permalink",
  );
  const rssGuid = feedChild(rssItem, "guid");
  check(
    "static:feeds",
    xmlAttribute(rssGuid, "isPermaLink") === "true" &&
      xmlText(rssGuid) === "https://example.test/folio-smoke/docs/hello/",
    "rss.xml guid is not isPermaLink=true at the article permalink",
  );
  check(
    "static:feeds",
    feedChildText(rssItem, "pubDate") === "Sat, 07 Jun 2025 00:09:10 GMT",
    "rss.xml pubDate is not the trusted frontmatter publication date",
  );
  log(
    "[static]   ok  rss.xml  one base-prefixed item, absolute GUID, trusted pubDate",
  );

  const atom = parseGeneratedFeed(
    "static:feeds",
    join(feedsDir, "atom.xml"),
    "atom.xml",
  );
  check("static:feeds", atom.name === "feed", "atom.xml root element is not <feed>");
  check(
    "static:feeds",
    feedChildText(atom, "id") === "https://example.test/folio-smoke/atom.xml",
    "atom.xml feed id is not the feed self URL",
  );
  check(
    "static:feeds",
    feedChildText(atom, "title") === "文档",
    "atom.xml title is not the configured feed title",
  );
  check(
    "static:feeds",
    feedChildText(atom, "updated") === "2024-01-01T19:04:05.000Z",
    "atom.xml <updated> is not the trusted Git last-commit modification date",
  );
  check(
    "static:feeds",
    feedChildText(feedChild(atom, "author"), "name") === CONFIG_TITLE,
    "atom.xml feed author is not the site title",
  );
  const atomEntries = xmlElements(atom).filter((element) => element.name === "entry");
  check("static:feeds", atomEntries.length === 1, `atom.xml has ${atomEntries.length} entries, expected 1`);
  const atomEntry = atomEntries[0];
  check(
    "static:feeds",
    feedChildText(atomEntry, "id") === "https://example.test/folio-smoke/docs/hello/",
    "atom.xml entry id is not the article permalink",
  );
  check(
    "static:feeds",
    feedChildText(atomEntry, "updated") === "2024-01-01T19:04:05.000Z",
    "atom.xml entry updated is not the trusted modification date",
  );
  check(
    "static:feeds",
    feedChildText(atomEntry, "published") === "2025-06-07T00:09:10.000Z",
    "atom.xml entry published is not the trusted frontmatter publication date",
  );
  log(
    "[static]   ok  atom.xml  permalink ids and trusted updated/published dates only",
  );

  const blogsRss = parseGeneratedFeed(
    "static:feeds",
    join(feedsDir, "feeds", "blogs.xml"),
    "feeds/blogs.xml",
  );
  const blogsChannel = feedChild(blogsRss, "channel");
  check(
    "static:feeds",
    feedChildText(blogsChannel, "title") === "博客",
    "feeds/blogs.xml does not use the configured collection title",
  );
  check(
    "static:feeds",
    feedChildText(blogsChannel, "link") === "https://example.test/folio-smoke/",
    "feeds/blogs.xml channel link lost the deployment base",
  );
  check(
    "static:feeds",
    xmlElements(blogsChannel).filter((element) => element.name === "item").length === 0,
    "feeds/blogs.xml is not a valid zero-item feed for an empty route directory",
  );
  check(
    "static:feeds",
    !existsSync(join(feedsDir, "feeds", "blogs.atom.xml")),
    "an Atom feed with no derivable <updated> was written",
  );
  log(
    "[static]   ok  feeds/blogs.xml  zero-item RSS for an empty directory, no Atom",
  );

  const expectedAlternates = [
    ["application/rss+xml", "文档", "https://example.test/folio-smoke/rss.xml"],
    ["application/atom+xml", "文档", "https://example.test/folio-smoke/atom.xml"],
    ["application/rss+xml", "博客", "https://example.test/folio-smoke/feeds/blogs.xml"],
  ];
  for (const relative of [
    "index.html",
    join("blogs", "index.html"),
    join("projects", "index.html"),
    join("docs", "hello", "index.html"),
    "404.html",
  ]) {
    const html = readGenerated(
      "static:feeds",
      join(feedsDir, relative),
      relative.replace(/\\/g, "/"),
    );
    const hrefs = alternateHrefs(html);
    check(
      "static:feeds",
      hrefs.length === expectedAlternates.length,
      `${relative.replace(/\\/g, "/")} has ${hrefs.length} alternate links, expected ${expectedAlternates.length}`,
    );
    for (const [type, title, href] of expectedAlternates) {
      check(
        "static:feeds",
        html.includes(
          `<link rel="alternate" type="${type}" title="${title}" href="${href}">`,
        ),
        `${relative.replace(/\\/g, "/")} is missing the ${type} discovery link ${href}`,
      );
    }
    check(
      "static:feeds",
      !hrefs.includes("https://example.test/folio-smoke/feeds/blogs.atom.xml"),
      `${relative.replace(/\\/g, "/")} advertises an Atom feed that was not written`,
    );
  }
  log(
    "[static]   ok  feeds  three absolute base-prefixed alternate links on every page including 404",
  );

  // FOL-030: the same installed tarball also proves a config-driven home and a
  // static-only home override. Each mode is a separate real Vite build so the
  // default, configured and advanced fixtures cannot share stale output.
  const configuredDir = runBuild(viteCli, appDir, {
    outDir: "dist-home-configured",
    staticMode: true,
    homeMode: "configured",
  });
  const configuredIndex = readGenerated(
    "static:home:configured",
    join(configuredDir, "index.html"),
    "the configured home page",
  );
  check(
    "static:home:configured",
    configuredIndex.includes("<h1>Configured consumer home</h1>"),
    "the configured home did not use the configured intro text",
  );
  check(
    "static:home:configured",
    configuredIndex.includes('<span>CONFIGURED HOME</span>'),
    "the configured home did not use the configured meta strip",
  );
  check(
    "static:home:configured",
    configuredIndex.includes(`href="${STATIC_BASE}docs/hello/"`),
    "the configured featured/recent block did not link to the configured collection under the deployment base",
  );
  check(
    "static:home:configured",
    configuredIndex.includes("<h2>Consumer discovery fixture</h2>"),
    "the configured featured story was not selected from the configured route collection",
  );
  for (const relative of [join("blogs", "index.html"), join("projects", "index.html"), "404.html", "sitemap.xml", "robots.txt"]) {
    check(
      "static:home:configured",
      existsSync(join(configuredDir, relative)),
      `configuring home changed unrelated static output: ${relative} is missing`,
    );
  }
  const configuredSitemap = readFileSync(join(configuredDir, "sitemap.xml"), "utf8");
  check(
    "static:home:configured",
    existsSync(join(configuredDir, "docs", "index.html")),
    "configured /docs collection was not prerendered",
  );
  check(
    "static:home:configured",
    (configuredSitemap.match(/<url>/g) ?? []).length === 5,
    "configured home must include root, docs/hello, docs collection, blogs and projects",
  );
  log("[static]   ok  configured home uses config text, collection links and base path");

  const overrideDir = runBuild(viteCli, appDir, {
    outDir: "dist-home-override",
    staticMode: true,
    homeMode: "override",
  });
  const overrideIndex = readGenerated(
    "static:home:override",
    join(overrideDir, "index.html"),
    "the advanced static home page",
  );
  check(
    "static:home:override",
    overrideIndex.includes('<main class="folio-static-home-override"><h1>Advanced static home</h1>'),
    "the static home override body did not reach only the '/' route",
  );
  check(
    "static:home:override",
    overrideIndex.includes(`href="${STATIC_BASE}docs/hello/"`),
    "the static home override did not receive the deployment base",
  );
  check(
    "static:home:override",
    overrideIndex.includes('<link rel="canonical" href="https://example.test/folio-smoke/">'),
    "the static home override changed the home canonical URL",
  );
  check(
    "static:home:override",
    !overrideIndex.includes("folio-editorial-home"),
    "the static home override still rendered the default home body",
  );
  for (const relative of [
    join("docs", "hello", "index.html"),
    join("blogs", "index.html"),
    join("projects", "index.html"),
    "404.html",
    "sitemap.xml",
    "robots.txt",
  ]) {
    check(
      "static:home:override",
      existsSync(join(overrideDir, relative)),
      `overriding home removed unrelated static output: ${relative} is missing`,
    );
  }
  const overrideSitemap = readFileSync(join(overrideDir, "sitemap.xml"), "utf8");
  check(
    "static:home:override",
    (overrideSitemap.match(/<url>/g) ?? []).length === 4,
    "a static-only home override changed the sitemap route set",
  );
  log("[static]   ok  static-only home override keeps every other route, canonical and sitemap entry");

  // FOL-027: the same installed tarball must project real content metadata in
  // SEO mode. A separate `content-seo` fixture keeps every assertion above
  // byte-for-byte about its original four routes.
  const seoDir = runBuild(viteCli, appDir, {
    outDir: SEO_OUT_DIR,
    staticMode: true,
    seoMode: true,
    contentDir: "content-seo",
  });
  const seoArticleUrl = `${SEO_SITE_PREFIX}blogs/frontmatter-author/`;
  const seoArticle = readGenerated(
    "static:seo",
    join(seoDir, "blogs", "frontmatter-author", "index.html"),
    "the SEO article page",
  );
  const seoArticleLd = parseJsonLdScript("static:seo", seoArticle);
  check(
    "static:seo",
    seoArticleLd["@type"] === "Article",
    `the SEO article @type is ${JSON.stringify(seoArticleLd["@type"])}, expected "Article"`,
  );
  check(
    "static:seo",
    seoArticleLd.headline === "Consumer article with explicit metadata",
    `the SEO article headline is ${JSON.stringify(seoArticleLd.headline)}`,
  );
  check(
    "static:seo",
    seoArticleLd.url === seoArticleUrl,
    `the SEO article JSON-LD url is ${JSON.stringify(seoArticleLd.url)}, expected ${seoArticleUrl}`,
  );
  check(
    "static:seo",
    seoArticle.includes(`<link rel="canonical" href="${seoArticleUrl}">`),
    "the SEO article canonical URL does not match its JSON-LD url",
  );
  check(
    "static:seo",
    JSON.stringify(seoArticleLd.author) ===
      JSON.stringify([
        {
          "@type": "Person",
          name: "Frontmatter Author",
          url: "https://example.test/authors/frontmatter",
        },
        { "@type": "Person", name: "Second Author" },
      ]),
    `frontmatter author precedence is wrong: ${JSON.stringify(seoArticleLd.author)}`,
  );
  check(
    "static:seo",
    !JSON.stringify(seoArticleLd).includes("[object Object]"),
    "a frontmatter author object was stringified into a Person name",
  );
  check(
    "static:seo",
    seoArticleLd.datePublished === "2025-02-03T04:05:06.000Z",
    `datePublished is ${JSON.stringify(seoArticleLd.datePublished)}`,
  );
  check(
    "static:seo",
    seoArticleLd.dateModified === "2025-03-04T05:06:07.000Z",
    `dateModified is ${JSON.stringify(seoArticleLd.dateModified)}`,
  );
  check(
    "static:seo",
    seoArticleLd.publisher?.name === CONFIG_TITLE,
    "the SEO article publisher is not the configured site title",
  );
  check(
    "static:seo",
    seoArticle.includes('<meta property="og:type" content="article">'),
    "the SEO article route does not keep og:type=article",
  );

  // config.author is the fallback for an article without a frontmatter author.
  const seoDefaultAuthor = readGenerated(
    "static:seo",
    join(seoDir, "blogs", "default-author", "index.html"),
    "the SEO default-author article",
  );
  const seoDefaultAuthorLd = parseJsonLdScript("static:seo", seoDefaultAuthor);
  check(
    "static:seo",
    JSON.stringify(seoDefaultAuthorLd.author) ===
      JSON.stringify([
        {
          "@type": "Person",
          name: "Consumer Default Author",
          url: "https://example.test/authors/default",
        },
      ]),
    `config.author fallback is wrong: ${JSON.stringify(seoDefaultAuthorLd.author)}`,
  );
  check(
    "static:seo",
    !("datePublished" in seoDefaultAuthorLd),
    "git-first-commit must not become datePublished",
  );
  check(
    "static:seo",
    seoDefaultAuthorLd.dateModified === GIT_COMMIT_UPDATED_AT,
    `dateModified is ${JSON.stringify(seoDefaultAuthorLd.dateModified)}, expected the trusted git commit date`,
  );

  // A document without explicit dates omits datePublished but keeps only
  // trustworthy modification metadata.
  const seoDoc = readGenerated(
    "static:seo",
    join(seoDir, "docs", "hello", "index.html"),
    "the SEO undated document",
  );
  const seoDocLd = parseJsonLdScript("static:seo", seoDoc);
  check(
    "static:seo",
    seoDocLd["@type"] === "TechArticle",
    `the SEO document @type is ${JSON.stringify(seoDocLd["@type"])}, expected "TechArticle"`,
  );
  check(
    "static:seo",
    !("datePublished" in seoDocLd),
    "the undated document must not receive a fabricated datePublished",
  );
  check(
    "static:seo",
    seoDocLd.dateModified === GIT_COMMIT_UPDATED_AT,
    `the undated document dateModified is ${JSON.stringify(seoDocLd.dateModified)}`,
  );

  const seoSitemap = parseSitemapOrFail(
    "static:seo",
    readGenerated("static:seo", join(seoDir, "sitemap.xml"), "the SEO sitemap.xml"),
  );
  const seoSitemapByLoc = new Map(
    seoSitemap.map((entry) => [entry.loc, entry.lastmod]),
  );
  for (const entry of seoSitemap) {
    if (entry.lastmod === undefined) continue;
    check(
      "static:seo",
      isW3cDatetime(entry.lastmod),
      `sitemap lastmod for ${entry.loc} is not a W3C datetime: ${JSON.stringify(entry.lastmod)}`,
    );
  }
  check(
    "static:seo",
    seoSitemapByLoc.get(`${SEO_SITE_PREFIX}`) === "2025-05-06T07:08:09.000Z",
    `the home route explicit route.lastmod is ${JSON.stringify(seoSitemapByLoc.get(`${SEO_SITE_PREFIX}`))}`,
  );
  check(
    "static:seo",
    seoSitemapByLoc.get(seoArticleUrl) === "2025-03-04T05:06:07.000Z",
    `the SEO article lastmod is ${JSON.stringify(seoSitemapByLoc.get(seoArticleUrl))}`,
  );
  check(
    "static:seo",
    seoSitemapByLoc.get(`${SEO_SITE_PREFIX}blogs/default-author/`) === GIT_COMMIT_UPDATED_AT,
    "the default-author article did not use its trusted git-last-commit lastmod",
  );
  check(
    "static:seo",
    seoSitemapByLoc.get(`${SEO_SITE_PREFIX}docs/hello/`) === GIT_COMMIT_UPDATED_AT,
    "the undated document did not use its trusted git-last-commit lastmod",
  );
  check(
    "static:seo",
    seoSitemapByLoc.get(`${SEO_SITE_PREFIX}blogs/`) === undefined,
    "the collection index must not fabricate a lastmod",
  );
  check(
    "static:seo",
    seoSitemap.every((entry) => !entry.loc.endsWith("/404/") && !entry.loc.endsWith("/404")),
    "the SEO sitemap advertises the not-found page",
  );
  log(
    "[static]   ok  SEO fixture: parsed JSON-LD author precedence/dates and parsed sitemap lastmod",
  );

  // Counter-proof: with static generation disabled, the same fixture, base,
  // site URL and Markdown must produce a normal Vite build with no static
  // files at all. If any of them appears, the assertions above were satisfied
  // by something other than folio()'s writeBundle stage.
  const controlDir = runBuild(viteCli, appDir, {
    outDir: CONTROL_OUT_DIR,
    staticMode: false,
  });
  const controlIndexPath = join(controlDir, "index.html");
  check(
    "static:control",
    existsSync(controlIndexPath),
    `the staticRoutes-off control build wrote no index.html at ${controlIndexPath}`,
  );
  for (const relative of [
    join("docs", "hello", "index.html"),
    "404.html",
    "sitemap.xml",
    "robots.txt",
  ]) {
    check(
      "static:control",
      !existsSync(join(controlDir, relative)),
      `staticRoutes: false still produced ${relative.replace(/\\/g, "/")}; the static assertions do not depend on the plugin's writeBundle stage`,
    );
  }
  check(
    "static:control",
    !readFileSync(controlIndexPath, "utf8").includes(marker),
    `staticRoutes: false still emitted the content marker ${marker} into index.html`,
  );
  log(
    "[static]   ok  staticRoutes: false produced no static files (counter-proof)",
  );
}
