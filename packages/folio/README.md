# @uichat-mira/folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It keeps Markdown, navigation, routing, SEO, and static deployment inside a stable package contract while allowing every consumer to keep its own UI, branding, and product-specific behavior.

## 0.1.x consumer contract

Markdown rendering is trusted-content-only: raw HTML, `::: html`, and Callout bodies are preserved without sanitization. `styles.css` is a whole-site stylesheet, not an isolated embed stylesheet. The default static document shell works without JavaScript, while custom static route bodies are site-owned.

The canonical boundary list, trusted Markdown example, stylesheet caveats, static-mode comparison, and known limitations live in the [Folio consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md). That file is the single source of truth for these rules. It also records the independent [FOL-014 tarball/UI acceptance](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) and the original missing ambient TypeScript declaration for `virtual:folio/content`, included in the published package.

## Install

Folio `0.1.1` is publicly released through [GitHub Release `folio-v0.1.1`](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1) and the [OIDC publish workflow](https://github.com/uichat-mira/folio/actions/runs/41282326983), following the manual `0.1.0` bootstrap. The patch retains the same public API and ships the corrected installation README. Install the latest Folio with:

```bash
npm install @uichat-mira/folio
```

The independent `registry:consumer` test installs the real npm package and verifies strict TypeScript, public exports, Vite content discovery and static output. Source changes continue through `pack:consumer`. For TypeScript projects that import only the virtual module, register `@uichat-mira/folio` in `compilerOptions.types`.

Within this repository the official site in `apps/site` consumes the package through the npm workspace link, not through the registry. The UIChat Mira documentation site (`uichat-mira/uichat-mira-docs`) is the intended first downstream production consumer, but it still depends on `@uichat-mira/docs` and has not migrated yet.

## Vite integration

```ts
import { defineConfig } from "vite";
import { folio } from "@uichat-mira/folio/vite";

export default defineConfig({
  plugins: [
    folio({
      contentDir: "content",
      config: {
        title: "My docs",
        description: "Documentation",
        siteUrl: "https://example.com",
      },
      staticRoutes: true,
    }),
  ],
});
```

The plugin discovers Markdown, parses YAML Frontmatter, and exposes content through `virtual:folio/content`. It can also generate route-level HTML, canonical and social metadata, JSON-LD, `404.html`, `sitemap.xml`, and `robots.txt`.

## Home page customization

The built-in home page has three supported levels. Without any configuration the
current default editorial home, navigation, SEO metadata and static HTML stay
as they are. `FolioConfig.collections` remains the only source for collection
routes; home sections do not hardcode `/blogs` or `/projects`.

1. **Use the default home.** Set no `home` and no `slots.home`.
2. **Configure the built-in home.** `FolioConfig.home` controls block order,
   visibility, the featured/recent collection source, limits and the small
   amount of copy the default design needs. React and the default static build
   consume the same resolved model.
3. **Take full control.** `slots.home` replaces only the React `/` route.
   `staticRoutes.home` replaces only the generated static `/` route body and
   metadata; it does not require copying every other static route. For a fully
   custom static route list, `renderFolioStaticHome({ config, docs, ... })`
   exposes the same configured body and `resolveFolioHome()` exposes the
   platform-neutral model.

```ts
const config = defineFolioConfig({
  title: "Field notes",
  description: "A small journal",
  collections: [
    { path: "/notes", title: "Notes" },
    { path: "/projects", title: "Projects" },
  ],
  home: {
    sections: [
      { type: "intro", title: "Notes from the workshop" },
      { type: "featured", collection: "/notes" },
      { type: "recent", collection: "/notes", limit: 3 },
      { type: "collections", paths: ["/projects"], limit: 2 },
      { type: "about", path: "/info/about", linkLabel: "Read more" },
    ],
  },
});
```

Section order is the array order. Omitting `home.sections` keeps the default
`intro`, `featured`, `recent`, `collections`, `about` order; an empty array
renders only the optional meta strip. Empty collections produce an explicit
empty state, a featured/recent block without entries is omitted or shows the
empty/end message, and a configured `path` that does not match a document fails
the build instead of silently falling back.

For static-only customization, keep the default route set and override `/`:

```ts
const staticBuild: FolioStaticBuildOptions = {
  home: () => ({
    title: "My home",
    description: "The same site, with a custom static home",
    body: '<main><h1>My home</h1><a href="/notes/">Read the notes</a></main>',
  }),
};
```

`staticRoutes.home` is an explicit HTML contract. A React node in `slots.home`
is not serialized into static HTML automatically, and Folio does not add an SSR
renderer for it. Consumers who server-render React own that integration; they
can reuse `resolveFolioHome()` for selection and ordering. When a consumer
supplies a complete `staticRoutes.routes` array, that array remains
authoritative for every route; `home` patches only the `/` route and requires
that array to contain `/`.
The published `0.1.1` package has a built-in home and `slots.home`, but does not
expose the `home` configuration or `staticRoutes.home` contract described here.
See the [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md).

## React runtime

Use the default lightweight runtime:

```tsx
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
```

Or consume the content model and virtual manifest from an existing React application while preserving its current pages and visual system.

`@uichat-mira/folio/styles.css` is a whole-site default stylesheet: it targets `:root`, `*`, `body`, `a`, and `button, input`, so it assumes Folio owns the document. Importing it into an existing branded page affects that page globally, and 0.1.0 has no scoped embed entry. The [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md) lists the affected rules and the override guidance.

## Markdown compatibility rendering

Consumers with custom page shells can reuse Folio's compatibility renderer instead of maintaining a second static Markdown pipeline:

```ts
import { renderFolioMarkdown } from "@uichat-mira/folio";

const html = renderFolioMarkdown(source, {
  removeH1: true,
});
```

It preserves `::: html` blocks, renders `::: tip` blocks, escapes fenced code, provides a readable Mermaid fallback, and adds stable anchors to level-two through level-four headings (`h2`–`h4`).

> **Trusted content only.** The renderer preserves raw HTML and does not sanitize event attributes, `javascript:` URLs, or unsafe SVG/MathML content. Pass only Markdown that was reviewed and merged by people you trust to publish on the site. Unreviewed pull requests, user submissions, and scraped pages are not supported input in 0.1.0. See the [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md).

## What the package owns

- Content parsing and normalized entry types
- Configurable built-in home selection, ordering and static home override
- Vite content discovery and hot updates
- Stable route and navigation data
- Markdown and HTML heading extraction
- Reusable Markdown compatibility rendering
- Static publishing and metadata contracts
- GitHub Pages base-path handling

Consumer applications remain responsible for branding, page composition, custom author models, and product-specific interaction.

## Exports

- `@uichat-mira/folio` — content model, React runtime, Markdown rendering, and configuration helpers
- `@uichat-mira/folio/vite` — Markdown discovery, virtual manifests, and static output
- `@uichat-mira/folio/styles.css` — whole-site default stylesheet (not an isolated embed stylesheet)

## Project status

Verified on 2026-11-01:

- **Done** — `0.1.0` public npm bootstrap, independent Registry consumer verification, public entrypoints, local tarball checks and official site's workspace build.
- **Release lineage** — `0.1.0` was bootstrapped manually without a Folio GitHub Release. `0.1.1` is the first actual OIDC-published [Folio GitHub Release](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1). The initial post-publish Registry visibility probe timed out while npm processed the package; the workflow rerun passed full Registry consumer acceptance without republishing. This README is not a live status feed.
- **Separate work** — migrate downstream Mira Docs consumers from `@uichat-mira/docs`. Historical MiraDocs tag `v0.1.0` remains untouched. The OIDC publish is evidenced by GitHub Actions; the private npm settings dashboard is a distinct administrative UI.

The predecessor `@uichat-mira/docs` package stays available for existing consumers during migration.
