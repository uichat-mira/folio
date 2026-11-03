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
