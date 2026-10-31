# @uichat-mira/folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It keeps Markdown, navigation, routing, SEO, and static deployment inside a stable package contract while allowing every consumer to keep its own UI, branding, and product-specific behavior.

## 0.1.0 consumer contract

Markdown rendering is trusted-content-only: raw HTML, `::: html`, and Callout bodies are preserved without sanitization. `styles.css` is a whole-site stylesheet, not an isolated embed stylesheet. The default static document shell works without JavaScript, while custom static route bodies are site-owned.

The canonical boundary list, trusted Markdown example, stylesheet caveats, static-mode comparison, and known limitations live in the [Folio consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md). That file is the single source of truth for these rules. It also records the independent [FOL-014 tarball/UI acceptance](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) and the original missing ambient TypeScript declaration for `virtual:folio/content`, now addressed in the source candidate.

## Install

The first Folio package release is `0.1.0`, and it is **not published to the npm registry yet**. The command below is the intended installation once that release exists:

```bash
npm install @uichat-mira/folio
```

Until then, the verified consumption path is the packed tarball: `npm pack` in `packages/folio` produces `uichat-mira-folio-<version>.tgz`, and `npm run pack:consumer -w @uichat-mira/folio` installs that exact tarball into a throwaway consumer, resolves the declared package entrypoints and their types, and builds a Vite site from it. The strict NodeNext and Bundler consumer fixtures now additionally check importing `virtual:folio/content` without declaring that virtual module locally. In a TypeScript program that only imports the virtual module and no Folio package entry, register `@uichat-mira/folio` under `compilerOptions.types` to load its published declaration; see the canonical consumer contract.

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

- **Done** — package identity, the public entrypoints listed above, and isolated tarball verification in `npm run release:check`. The official site in `apps/site` builds against the package through the workspace link.
- **Pending** — final release-candidate and Registry verification of the package-owned virtual-module types, the first npm registry publication (the registry does not serve `@uichat-mira/folio` yet), the historical `v0.1.0` tag conflict, npm Trusted Publishing (`.github/workflows/publish.yml` exists, but no Folio GitHub Release has triggered it), and the downstream migration of `uichat-mira/uichat-mira-docs`, which still depends on `@uichat-mira/docs@^0.1.1`.
- **Unconfirmed** — whether the Trusted Publisher entry already exists on npmjs.com; that setting is not publicly readable.

The predecessor `@uichat-mira/docs` package stays available for existing consumers during migration.
