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

## Article metadata, authors and sitemap `lastmod`

For every route that does not supply its own `jsonLd`, Folio generates a
conservative Schema.org object. `route.jsonLd` always wins untouched and is
never merged with the generated values.

- `/` becomes `WebSite` (`name`, `description`, absolute `url` when `siteUrl` is configured).
- A route whose normalized path matches a configured `collections[].path` becomes `CollectionPage` (`name`, `description`, absolute `url`).
- A document becomes `Article` when its type is `article`, otherwise `TechArticle`. It carries `headline`, `description`, the absolute canonical `url`, `image` only when one resolves, a `publisher` organization named after `config.title`, and the optional fields below.
- Any other custom static route without a document keeps the conservative `WebSite` shape.

Article pages already emit `og:type=article` through the route `type`
(`doc.type === "article"` maps to `article` in the default route set). Share
images keep the existing single resolution order — `route.image` >
`defaultImage` > `config.logo` — and the same `og:image` / `twitter:image`
output. Folio does not run a second image engine for structured data.

### Author precedence

Set a site-level default once:

```ts
folio({
  config: {
    title: "My site",
    description: "Documentation",
    author: { name: "Jane Doe", url: "https://example.com/about" },
  },
});
```

`config.author` accepts one entry or an array; an entry is either a name or
`{ name, url? }`. For a page, the JSON-LD `author` list is chosen by one rule:

1. the document's explicit frontmatter `author` (an array, or one string split on `|`, `,` or `，`; array entries may also be `{ name, url }` objects);
2. otherwise `config.author`;
3. otherwise the `author` property is omitted.

Folio never emits `author: []` and never fabricates a person or organization. A
`Person` is emitted only for a non-empty name.

### Trustworthy dates

`datePublished` and `dateModified` come only from the verified Folio dates
(`doc.publishedAt` / `doc.updatedAt`) and their `dateSources` provenance:

| JSON-LD field | Allowed provenance | Value |
| --- | --- | --- |
| `datePublished` | `frontmatter`, `legacy-date` | `doc.publishedAt` |
| `dateModified` | `frontmatter`, `git-last-commit` | `doc.updatedAt` |

`git-first-commit` is never an original publication date: the first commit in
the current repository may be later than the real publication (for example
after a migration). Build time, deployment time and file mtimes are never
used. When a value is not trustworthy, the property is omitted instead of
emitted as an empty or fabricated date. Documents with no `dateSources` emit
neither field.

### Sitemap `lastmod`

Each sitemap `<url>` gets a `<lastmod>` only when a trustworthy modification
date exists, in this order:

1. an explicit `route.lastmod` from the consumer (date-only `YYYY-MM-DD` or a date-time with `Z` / numeric offset; it is normalized to ISO 8601 UTC). An invalid value fails the static build with `folio static route "<path>" lastmod ...` before any page is written;
2. otherwise the document's trusted `updatedAt` (`frontmatter` or `git-last-commit`);
3. otherwise no `<lastmod>`.

`publishedAt`, build time and `git-first-commit` are never used as a
modification date, so home and collection indexes without an explicit
`route.lastmod` keep only `<loc>`. `404.html` is never listed. `lastmod`
values and `loc` URLs follow the same base/canonical rules as the pages.


## Site-level indexing policy (preview builds)

A build can declare itself a non-indexed preview with one explicit option:

```ts
const staticBuild: FolioStaticBuildOptions = {
  siteIndexing: "noindex",
};
```

`siteIndexing` is `"index" | "noindex"` and defaults to `"index"`. Omitting it
keeps the previous output byte-for-byte; the policy is opt-in only. Folio never
infers "preview" from the hostname, `github.io`, `localhost`, the deployment
sub-path, environment variables or the repository name, because a guessed
preview is exactly how a real site silently loses its search visibility.
An unsupported value (for example the typo `"no-index"`) throws before any
static file is written instead of falling back to the indexable default.

### Effective page robots value

| Source | Value | Notes |
| --- | --- | --- |
| `FolioStaticRoute.robots` | verbatim | Highest priority in both modes; a non-empty per-route value always wins. |
| `siteIndexing: "noindex"` | `noindex,nofollow` | Applies to every default route (home, collection indexes, document/article pages) and every custom `routes` page. |
| `siteIndexing: "index"` or omitted | `index,follow` | The unchanged default. |
| `404.html` without an explicit value | `noindex,nofollow` | The not-found default wins over the site policy in both modes; an explicit `robots` on the `notFound` route still overrides it. |

Falsy per-route values (`undefined`, `""`) fall back to the policy instead of
emitting an empty `content=""` attribute.

### robots.txt in each mode

Default mode is unchanged:

```text
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

Preview mode writes an explicit marker and deliberately keeps crawling allowed:

```text
# Preview build: site-wide noindex. Crawling stays allowed so crawlers can read the page-level noindex.
User-agent: *
Allow: /
```

Preview mode does not advertise a `Sitemap:` line. `sitemap.xml` is still
generated from the same routes (unless `sitemap: false` is set), it is simply
not advertised; the pages themselves are `noindex`, so a search engine that
discovers a listed URL still sees the removal signal. Consumers that want no
preview sitemap file at all already have `sitemap: false`.

`robots: false` remains independent: it only controls whether `robots.txt` is
written, never whether pages are indexable. Both `robots.txt` and `sitemap.xml`
stay gated on a configured `siteUrl`.

### Why `Allow: /` and not `Disallow: /`

`Disallow: /` in `robots.txt` blocks crawling, so a crawler never fetches the
pages and never reads their `<meta name="robots" content="noindex,nofollow">`.
That hides the strongest removal signal and can leave already-known URLs
indexed. Keeping crawling allowed and serving page-level `noindex` is the
combination search engines document for preview sites. It is also why
`robots.txt` is not a removal mechanism at all: a `Disallow` only asks crawlers
not to fetch, and it does not remove URLs from search results. URLs from a
preview site that were already indexed need a separate removal request through
the search engine's own tools, independently of this option.

Canonical, Open Graph, JSON-LD and base/sub-path handling are not changed by the
policy. A preview build keeps stating its real `siteUrl` and base path; it never
fabricates a production URL. If a production URL exists and is the intended
canonical destination, point `siteUrl` at it (or supply per-route metadata) as a
separate, explicit decision.

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
first: `./rss.xml`, `rss.xml` and `RSS.XML` all mean the same target. A feed
output path may not equal, contain, or be nested below a static output file
path. This rejects both overwrites and file/directory conflicts with generated
pages (`<route>/index.html`, including `index.html` for `/`), `404.html`,
`sitemap.xml` or `robots.txt` before the first file is written.
`sitemap.xml` and `robots.txt` are only reserved while the build actually
enables them (`sitemap: false` / `robots: false` releases the name). Feed
output paths are also checked against one another: equal paths and either
ancestor/descendant overlap at a path-segment boundary are rejected before the
first write, so two feeds cannot require the same path to be both a file and a
directory. Comparison is case-insensitive and folds Windows-ambiguous trailing
dots/spaces, so the same configuration fails identically on every platform. Existing `<link
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
