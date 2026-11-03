# Static build contract

Folio owns static file generation while each site keeps control of its brand, page markup, authorship rules, and structured-data content.

```ts
import { folio } from "@uichat-mira/folio/vite";
import type {
  FolioStaticBuildOptions,
  FolioStaticRoute,
} from "@uichat-mira/folio/vite";

const staticBuild: FolioStaticBuildOptions = {
  routes: ({ docs }) =>
    docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description,
      body: `<main><h1>${doc.title}</h1></main>`,
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  notFound: () => ({
    path: "/404",
    title: "Page not found",
    description: "The requested page could not be found.",
    body: "<main><h1>Page not found</h1></main>",
    robots: "noindex,nofollow",
  }),
  defaultImage: "logo.png",
  sitemap: true,
  robots: true,
};

export default {
  plugins: [
    folio({
      contentDir: "content",
      config: {
        title: "My site",
        description: "Documentation",
        siteUrl: "https://example.com",
      },
      staticRoutes: staticBuild,
    }),
  ],
};
```

## Home-only override

`FolioStaticBuildOptions.routes` replaces every route. When only the `/` page
should differ, use `home` instead and keep the default route set:

```ts
const staticBuild: FolioStaticBuildOptions = {
  home: {
    title: "My home",
    description: "The same content graph, with one custom static page",
    body: '<main><h1>My home</h1><a href="/notes/">Read the notes</a></main>',
  },
};
```

`home` may also be a function `(context, defaultHome) => route`. It replaces the
body and metadata of the `/` route only; other routes, `404.html`,
`sitemap.xml`, `robots.txt`, canonical URLs and base-path link handling keep
their normal output. Supplying `routes` still makes that array authoritative for
the full route set; `home` patches only its `/` entry and fails explicitly when
the array has no `/` route. A returned `path` must normalise to `/`.

For custom route arrays that still want the built-in selection, the public
`renderFolioStaticHome(context)` returns the same built-in body that the default
route uses (`config.home` included), and `resolveFolioHome(config, docs)` returns
the platform-neutral model. A React node is never serialized automatically;
`home` and `renderFolioStaticHome` produce HTML strings only.

## RSS 2.0 and Atom 1.0 feeds

`feeds` declares one or more subscription feeds. Each entry names a **route
directory** (not a content type, not a fixed blog folder); every document under
that route — at any depth, regardless of `doc.type` — becomes an entry:

```ts
const staticBuild: FolioStaticBuildOptions = {
  feeds: [
    { path: "/blogs" },
    { path: "/docs", title: "Documentation", rss: "docs/rss.xml", atom: "docs/atom.xml" },
    // A feed is RSS-only when atom is false, and vice versa.
    { path: "/projects", rss: "projects.xml", atom: false },
  ],
};
```

`FolioStaticFeedOptions` fields:

- `path` (required): absolute route directory, for example `/blogs` or
  `/docs/guide`. Root `/` is not a valid feed path. Descendants are selected
  recursively with `selectFolioCollectionDocs`, so `/docs` includes
  `/docs/guide/...` as well.
- `title`: discovery/channel title. Defaults to the matching configured
  collection title (`config.collections`), then `config.title`.
- `description`: channel/subtitle text. Defaults to the matching collection
  description, then `config.description`; an empty description omits the Atom
  `<subtitle>`.
- `rss`: site-root-relative output file, default `rss.xml`. `false` disables RSS.
- `atom`: site-root-relative output file, default `atom.xml`. `false` disables
  Atom.

Omitting `feeds` (or passing an empty array) writes no feed and changes no page
head. Output names are relative to the static site root and are normalized
first: `./rss.xml`, `rss.xml` and `RSS.XML` all mean the same target. A feed may
never overwrite a static artifact: names that resolve to a generated page
(`<route>/index.html`, including `index.html` for `/`), `404.html`,
`sitemap.xml` or `robots.txt` are rejected before the first file is written.
`sitemap.xml` and `robots.txt` are only reserved while the build actually
enables them (`sitemap: false` / `robots: false` releases the name). Duplicate
output names across feeds throw under the same rules. Comparison is
case-insensitive and folds Windows-ambiguous trailing dots/spaces, so the same
configuration fails identically on every platform. Existing `<link
rel="alternate" type="application/rss+xml|application/atom+xml">` elements
supplied by a page template are removed before Folio injects its own, so a page
never advertises a duplicate feed.

### URLs, base paths, and discovery

Feeds require `config.siteUrl`. Without it, feed generation and alternate links
are skipped entirely — a feed with relative URLs would be unusable in a reader.
With a sub-path deployment such as `siteUrl: "https://example.com"` and
`base: "/moyu/"`, a document at `/blogs/hello` is published as
`https://example.com/moyu/blogs/hello/`, the RSS self link is
`https://example.com/moyu/rss.xml`, and the channel/site link is
`https://example.com/moyu/`. GUIDs and Atom entry ids equal the article
permalink; the trailing slash matches `folioAbsoluteRouteUrl`.

Every generated page (home, collection indexes, docs/articles, custom routes,
and `404.html`) gets a discovery link only for a feed file that was actually
written:

```html
<link rel="alternate" type="application/rss+xml" title="Blogs" href="https://example.com/moyu/rss.xml">
<link rel="alternate" type="application/atom+xml" title="Blogs" href="https://example.com/moyu/atom.xml">
```

The advertised MIME types are `application/rss+xml` and
`application/atom+xml`. Files end in `.xml`; serve `.xml` as XML (`application/xml`
or `text/xml`) from the static host. GitHub Pages does this by extension; a
custom host must not serve `.xml` as `text/html`.

### Dates and empty sources

Feed dates reuse the frozen FOL-025 provenance instead of guessing:

- RSS `<pubDate>` and Atom `<published>` are emitted only when
  `dateSources.publishedAt` is `frontmatter` or `legacy-date`. A document without
  a trusted publication date is still included in RSS, just without
  `<pubDate>`.
- Atom requires `<updated>`: it uses a trusted `updatedAt` (`frontmatter` or
  `git-last-commit`), falling back to the trusted publication date. Entries
  with neither are excluded from Atom.
- Atom's feed-level `<updated>` is the latest entry date; it is never the build
  clock. If no entry has a derivable date, no Atom file is written and no Atom
  alternate link is emitted.
- Git first-commit timestamps, file mtimes, and build time are never emitted as
  publication dates.
- Atom requires an author when entries do not provide one, so the feed-level
  author is the site itself (`config.title`); no person is invented.

An empty or missing source directory is deterministic: the RSS file is still
written with zero `<item>` elements, and Atom is not written because no
`<updated>` can be derived. Entry order is trusted publication date descending
(undated entries last), then `order`, then route path, so repeated builds of the
same content produce the same feed. XML is escaped for text and attributes,
Chinese and emoji are preserved, and XML-1.0-invalid control characters are
removed.

## Folio responsibilities

- Write route HTML into the Vite output directory.
- Inject title, description, robots, canonical, Open Graph, and Twitter metadata.
- Inject JSON-LD supplied by the site, or generate a conservative default.
- Resolve relative social images against the deployment base path.
- Generate `404.html`, `sitemap.xml`, and `robots.txt`.
- Generate declared RSS 2.0 / Atom 1.0 feeds and their discovery links.

## Site responsibilities

- Choose which routes exist and resolve intentional collisions.
- Render home, area, document, and not-found body markup.
- Map site-specific authors, merged documents, and content categories.
- Supply brand-specific images, locale, title rules, and JSON-LD.

## Document shell and no-JS navigation

When `staticRoutes` is `true`, Folio renders its default document shell: sidebar, in-page TOC, previous/next pager, and article body. Those links target real generated files, so a reader can navigate the collection, jump to sections, and reach adjacent documents with JavaScript disabled.

When a site supplies its own `routes`, its body replaces that shell on every route. Folio still writes the file and metadata, but the site owns navigation, TOC, and pager markup. The official `apps/site` uses custom routes, so its static document pages are readable without JavaScript but do not offer a cross-document sidebar, in-page TOC, or previous/next links.

The consumer-facing comparison, including the trailing-slash difference between static directory URLs and React routes, is maintained in [docs/consumer-contract.md](consumer-contract.md).

The UIChat Mira documentation site is the intended first downstream consumer of this contract. Its migration — frozen dependency installation, real content routes, GitHub Pages base paths, canonical URLs, JSON-LD, 404 indexing rules, sitemap coverage, and `robots.txt` output — is still pending, because that site has not moved off `@uichat-mira/docs` yet.
