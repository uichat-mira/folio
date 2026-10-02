# MiraDocs

MiraDocs is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It turns structured Markdown in a repository into navigable content, a virtual Vite manifest, and static deployment artifacts while allowing each consumer to keep its own visual identity. Content stays reviewable through Git, site behavior stays configurable, and automation can operate stable contracts instead of editing UI implementation files.

## Repository identity

The repository now lives at [`uichat-mira/folio`](https://github.com/uichat-mira/folio).

This organization-alignment stage does **not** rename the published package or public API. Until the explicit Folio package migration lands, the canonical package remains `@uichat-mira/docs` and the implementation directory remains `packages/mira-docs`.

## Current status

- Public npm package: `@uichat-mira/docs@0.1.1`
- Source rollback anchor for organization alignment: `6ea6dd4023ed3fad32f1eb309ce7a4e75c1cbdb4`
- Publishing uses npm Trusted Publishing and GitHub OIDC; the publisher must target `uichat-mira/folio` before the next real release
- `uichat-mira-docs` is the first production consumer and compatibility benchmark
- The production consumer installs MiraDocs from npm rather than a Git commit

```bash
npm install @uichat-mira/docs
```

## What MiraDocs provides

- Markdown and YAML Frontmatter content model
- Compatibility fallback for existing loose Frontmatter content
- Documentation, article, project, and page entry types
- Vite content discovery and `virtual:mira-docs/content`
- Generated routes, navigation roots, and heading extraction
- Configurable static HTML generation
- Canonical, Open Graph, Twitter, and JSON-LD metadata
- `404.html`, `sitemap.xml`, and `robots.txt`
- GitHub Pages project-path and root-path support
- A lightweight React runtime that consumers may use or replace

## Boundaries

MiraDocs is not a hosted CMS, a GitHub API wrapper, or a mandatory site theme. It owns the content and static-build contracts; consumer applications own their branding, page composition, and product-specific behavior.

The canonical MiraDocs Skill lives in UIChat Mira. It operates repository content, configuration, branches, pull requests, and publishing workflows through stable GitHub capabilities. The `skill-backup` directory in this repository is a read-only reference copy.

## Package exports

- `@uichat-mira/docs` — content model, configuration helpers, React runtime, and Markdown compatibility rendering
- `@uichat-mira/docs/vite` — Markdown discovery, virtual manifests, and static output
- `@uichat-mira/docs/styles.css` — default lightweight styles

## Development

```bash
npm ci
npm run release:check
npm run dev
```

The official self-hosted site lives in `apps/site`. The reusable package lives in `packages/mira-docs`. Static build extension points are documented in [`docs/static-build.md`](docs/static-build.md).

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

## Repository roles

- **uichat-mira/.github** — Organization policy, SOP, and canonical reusable Skills
- **folio** — current MiraDocs runtime, schemas, package, official site, and release pipeline
- **uichat-mira-docs** — first production consumer and migration benchmark
