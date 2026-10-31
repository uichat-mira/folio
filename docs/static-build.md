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
