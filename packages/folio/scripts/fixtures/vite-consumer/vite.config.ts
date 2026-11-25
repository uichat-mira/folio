import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";

// One fixture serves several checks, so every input that differs between them
// is an explicit override instead of a second config file: the content
// directory and output directory (bundle check and its no-Markdown control),
// plus the deployment base, site URL and static-generation switch (static
// output check and its staticRoutes-off control). FOL-027 adds a separate SEO
// mode with its own content directory so the default four-URL sitemap fixture
// keeps asserting exactly what it did before.
const seoMode = process.env.FOLIO_CONSUMER_SEO === "on";
const contentDir =
  process.env.FOLIO_CONSUMER_CONTENT_DIR ?? (seoMode ? "content-seo" : "content");
const outDir = process.env.FOLIO_CONSUMER_OUT_DIR ?? "dist";
const base = process.env.FOLIO_CONSUMER_BASE ?? "/";
const siteUrl = process.env.FOLIO_CONSUMER_SITE_URL;
const staticRoutes = process.env.FOLIO_CONSUMER_STATIC === "on";
const homeMode = process.env.FOLIO_CONSUMER_HOME_MODE ?? "default";
const feedsMode = process.env.FOLIO_CONSUMER_FEEDS === "on";

// FOL-028: the fixture opts into the site-level indexing policy only through
// this explicit environment switch. Nothing in the installed package inspects
// the host, deployment base, `github.io`, `localhost` or environment names, so
// a noindex build can only happen because this line said so.
const rawSiteIndexing = process.env.FOLIO_CONSUMER_SITE_INDEXING;
if (
  rawSiteIndexing !== undefined &&
  rawSiteIndexing !== "" &&
  rawSiteIndexing !== "index" &&
  rawSiteIndexing !== "noindex"
) {
  throw new Error(
    `unsupported FOLIO_CONSUMER_SITE_INDEXING ${JSON.stringify(rawSiteIndexing)}; expected "index" or "noindex"`,
  );
}
const siteIndexing =
  rawSiteIndexing === "index" || rawSiteIndexing === "noindex"
    ? rawSiteIndexing
    : undefined;

const config = {
  title: "Folio Vite consumer fixture",
  description:
    "Standalone Vite + React consumer of the published Folio package.",
  ...(siteUrl ? { siteUrl } : {}),
  // FOL-027: the site-level default author. Articles with an explicit
  // frontmatter author must override it; articles without one must use it.
  ...(seoMode
    ? {
        author: {
          name: "Consumer Default Author",
          url: "https://example.test/authors/default",
        },
      }
    : {}),
  collections: [
    { path: "/blogs", title: "博客" },
    { path: "/projects", title: "项目" },
    ...(homeMode === "configured" ? [{ path: "/docs", title: "Docs" }] : []),
  ],
  ...(homeMode === "configured"
    ? {
        home: {
          template: "editorial" as const,
          meta: { left: "CONFIGURED HOME", right: "TARBALL" },
          sections: [
            { type: "intro" as const, title: "Configured consumer home" },
            { type: "featured" as const, collection: "/docs", label: "Consumed" },
            { type: "recent" as const, collection: "/docs", limit: 2 },
            { type: "collections" as const, paths: ["/blogs", "/projects"] },
          ],
        },
      }
    : {}),
};

// FOL-026 feed evidence uses two route directories on purpose: `/docs` already
// has one dated document, while the configured `/blogs` collection has no
// documents (zero-item RSS, no Atom because no `<updated>` can be derived).
const feedOptions = [
  { path: "/docs", title: "文档", rss: "rss.xml", atom: "atom.xml" },
  { path: "/blogs", rss: "feeds/blogs.xml", atom: "feeds/blogs.atom.xml" },
];

const baseStaticOptions =
  homeMode === "override"
    ? {
        home: () => ({
          title: "Advanced static home",
          description: "Explicit static-only home override.",
          body:
            '<main class="folio-static-home-override">' +
            "<h1>Advanced static home</h1>" +
            '<a href="' + base + 'docs/hello/">Open fixture document</a>' +
            "</main>",
        }),
      }
    : seoMode
      ? {
          // FOL-027 evidence for the explicit per-route sitemap <lastmod>
          // override (validated and normalized by the installed tarball).
          home: () => ({
            title: "Consumer static home",
            description: "SEO fixture home.",
            body:
              '<main class="folio-static-home-seo">' +
              "<h1>Consumer static home</h1>" +
              "</main>",
            lastmod: "2025-05-06T07:08:09Z",
          }),
        }
      : true;

// FOL-026 and FOL-028 are independent static options, so each one composes with
// the default, home-override and SEO fixtures instead of replacing them.
const staticOptions = feedsMode
  ? {
      ...(typeof baseStaticOptions === "object" ? baseStaticOptions : {}),
      feeds: feedOptions,
    }
  : baseStaticOptions;

const staticOptionsWithIndexing =
  siteIndexing === undefined
    ? staticOptions
    : {
        ...(typeof staticOptions === "object" ? staticOptions : {}),
        siteIndexing,
      };

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir,
      config,
      // Static HTML generation stays off by default so the client-bundle
      // checks keep their original build shape; the static-output check turns
      // it on to prove writeBundle produces the real site files.
      staticRoutes: staticRoutes ? staticOptionsWithIndexing : false,
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
