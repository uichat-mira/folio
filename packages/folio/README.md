# @uichat-mira/folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It keeps Markdown, navigation, routing, SEO, and static deployment inside a stable package contract while allowing every consumer to keep its own UI, branding, and product-specific behavior.

## Install

The first Folio package release is `0.1.0`, and it is **not published to the npm registry yet**. The command below is the intended installation once that release exists:

```bash
npm install @uichat-mira/folio
```

Until then, the verified consumption path is the packed tarball: `npm pack` in `packages/folio` produces `uichat-mira-folio-<version>.tgz`, and `npm run pack:consumer -w @uichat-mira/folio` installs that exact tarball into a throwaway consumer, resolves the declared entrypoints and types, and builds a Vite site from it.

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

## Markdown compatibility rendering

Consumers with custom page shells can reuse Folio' compatibility renderer instead of maintaining a second static Markdown pipeline:

```ts
import { renderFolioMarkdown } from "@uichat-mira/folio";

const html = renderFolioMarkdown(source, {
  removeH1: true,
});
```

It preserves `::: html` blocks, renders `::: tip` blocks, safely escapes code, provides a readable Mermaid fallback, and adds stable anchors to level-two and level-three headings.

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
- `@uichat-mira/folio/styles.css` — default lightweight styles

## Project status

Verified on 2026-11-01:

- **Done** — package identity, the public entrypoints listed above, and isolated tarball verification in `npm run release:check`. The official site in `apps/site` builds against the package through the workspace link.
- **Pending** — the first npm registry publication (the registry does not serve `@uichat-mira/folio` yet), npm Trusted Publishing (`.github/workflows/publish.yml` exists, but no Folio GitHub Release has triggered it), and the downstream migration of `uichat-mira/uichat-mira-docs`, which still depends on `@uichat-mira/docs@^0.1.1`.
- **Unconfirmed** — whether the Trusted Publisher entry already exists on npmjs.com; that setting is not publicly readable.

The predecessor `@uichat-mira/docs` package stays available for existing consumers during migration.
