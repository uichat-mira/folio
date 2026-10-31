# @uichat-mira/folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It keeps Markdown, navigation, routing, SEO, and static deployment inside a stable package contract while allowing every consumer to keep its own UI, branding, and product-specific behavior.

## 0.1.x consumer contract

Markdown rendering is trusted-content-only: raw HTML, `::: html`, and Callout bodies are preserved without sanitization. `styles.css` is a whole-site stylesheet, not an isolated embed stylesheet. The default static document shell works without JavaScript, while custom static route bodies are site-owned.

The canonical boundary list, trusted Markdown example, stylesheet caveats, static-mode comparison, and known limitations live in the [Folio consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md). That file is the single source of truth for these rules. It also records the independent [FOL-014 tarball/UI acceptance](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) and the original missing ambient TypeScript declaration for `virtual:folio/content`, included in the published package.

## Install

Folio `0.1.1` is the next patch release after the manually published `0.1.0`. It retains the same public API, ships the corrected installation README, and is distributed from the npm Registry after its GitHub release succeeds. Install the latest Folio with:

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
- **Release lineage** — `0.1.0` was bootstrapped manually without a Folio GitHub Release. `0.1.1` is the first planned `folio-v0.1.1` GitHub Release / npm OIDC publish. Check the [GitHub Releases](https://github.com/uichat-mira/folio/releases) and [npm version](https://www.npmjs.com/package/@uichat-mira/folio) for actual publication status; this bundled README is not a live status feed.
- **Separate work** — migrate downstream Mira Docs consumers from `@uichat-mira/docs`. Historical MiraDocs tag `v0.1.0` remains untouched. npm Trusted Publisher binding and its OIDC publish result must be verified through npm settings and GitHub Actions, not inferred from this README.

The predecessor `@uichat-mira/docs` package stays available for existing consumers during migration.
