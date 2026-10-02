# Folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It turns structured Markdown in a repository into a stable content model, Vite integration, navigable runtime, and static deployment artifacts while allowing every consumer to keep its own visual identity.

## Install

```bash
npm install @uichat-mira/folio
```

Folio starts a new npm package line at `0.1.0`.

## What Folio provides

- Markdown and YAML Frontmatter content model
- Documentation, article, project, and page entry types
- Vite content discovery and `virtual:folio/content`
- Generated routes, navigation roots, and heading extraction
- Configurable static HTML generation
- Canonical, Open Graph, Twitter, and JSON-LD metadata
- `404.html`, `sitemap.xml`, and `robots.txt`
- GitHub Pages project-path and root-path support
- A lightweight React runtime that consumers may use or replace
- Reusable Markdown compatibility rendering

## Package exports

- `@uichat-mira/folio` — content model, configuration helpers, React runtime, and Markdown rendering
- `@uichat-mira/folio/vite` — Markdown discovery, virtual manifests, and static output
- `@uichat-mira/folio/styles.css` — default lightweight styles

## Development

```bash
npm ci
npm run release:check
npm run dev
```

The official self-hosted site lives in `apps/site`. The reusable package lives in `packages/folio`.

## Branch and release model

```text
feat/* -> dev -> test -> prod
```

- `feat/*`: CI only
- `dev`: development integration
- `test`: acceptance candidate
- `prod`: production site and release lineage
- `main`: historical/import compatibility only; no production publication

See [`.github/ENVIRONMENT.md`](.github/ENVIRONMENT.md) for repository-specific deployment and release semantics.

## Migration from MiraDocs

Folio is the successor to the former MiraDocs package line.

- predecessor: `@uichat-mira/docs`
- canonical package: `@uichat-mira/folio`
- predecessor Vite module: `virtual:mira-docs/content`
- canonical Vite module: `virtual:folio/content`

Folio itself does not carry compatibility aliases for the predecessor API. Existing consumers should migrate deliberately, then the predecessor npm package can remain deprecated as a pointer to Folio.

## Repository roles

- **uichat-mira/.github** — Organization policy, SOP, and canonical reusable Skills
- **folio** — runtime, schemas, package, official site, and release pipeline
- **uichat-mira-docs** — Mira website and first downstream migration target
