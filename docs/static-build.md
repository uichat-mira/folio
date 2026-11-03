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

## Folio responsibilities

- Write route HTML into the Vite output directory.
- Inject title, description, robots, canonical, Open Graph, and Twitter metadata.
- Inject JSON-LD supplied by the site, or generate a conservative default.
- Resolve relative social images against the deployment base path.
- Generate `404.html`, `sitemap.xml`, and `robots.txt`.

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
