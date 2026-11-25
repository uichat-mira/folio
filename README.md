# Folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It turns structured Markdown in a repository into a stable content model, Vite integration, navigable runtime, and static deployment artifacts while allowing every consumer to keep its own visual identity.

## Install

Folio `0.2.0` is the current public release on the npm Registry. Install the published package:

```bash
npm install @uichat-mira/folio
```

Every release candidate must pass the independent tarball consumer gate before promotion, and the publish workflow verifies the real Registry-installed package after npm publication. Continue using the local gate for source changes:

```bash
npm run release:check
```

That builds the package, audits the packed file list, and installs the resulting tarball into an isolated Vite + React consumer.

### One-command project initialization (dev candidate)

A new, independently packed CLI lives at `packages/create-folio`:

```sh
# Available only after @uichat-mira/create-folio is published:
npx @uichat-mira/create-folio my-site --install
# Equivalent npm initializer:
npm create @uichat-mira/folio my-site -- --install
```

The CLI scaffolds a working Vite/React/Folio site with Markdown content, config,
static build and a safe no-overwrite policy. `--install` is optional; without
it, run `cd my-site && npm install`. The candidate has been exercised as a
**local npm tarball through npm exec**, but is **not yet on the public Registry**.
Do not confuse source verification with publication.


## Consumer contract

The 0.2.x consumer boundaries are defined once in [docs/consumer-contract.md](docs/consumer-contract.md):

- Markdown rendering is trusted-content-only. Raw HTML, `::: html` blocks, and Callout bodies are preserved without sanitization, so unreviewed submissions, scraped pages, and external PR previews must not be rendered.
- `@uichat-mira/folio/styles.css` is a whole-site default stylesheet. It is not an isolated embed stylesheet, and importing it into an existing branded page affects that page globally.
- The default `staticRoutes` document shell supports sidebar, TOC, and previous/next navigation without JavaScript. Sites that supply custom static route bodies own that markup and do not get the shell.
- The npm package ships `virtual:folio/content` declarations; NodeNext/Bundler and virtual-only strict TS imports passed against the real published Registry package.

## Publication status

`@uichat-mira/folio@0.1.0` was manually bootstrapped from accepted `prod` commit `40db582b` on 2026-11-01. Folio `0.1.1` was published through GitHub Release `folio-v0.1.1` from tag commit `e4af1f7` using the npm Trusted Publishing / OIDC workflow. The initial run's Registry visibility check expired while npm processed the new package; its second attempt passed the real Registry consumer, SRI, TypeScript, Vite and static-site acceptance. The later `prod` workflow polling fix is in [PR #103](https://github.com/uichat-mira/folio/pull/103) (current `prod` `711c6c6`), without moving the release tag or republishing the version. The pre-release Chrome candidate passed 23/23 checks; live Pages HTTP smoke and downstream Mira Docs migration are separate.

Folio `0.2.0` promotes the post-0.1.1 contract: PWA entrypoints, feeds and richer static metadata, Git-derived dates, Article category/tag archives, expanded React composition, appearance presets/code palettes, and reusable list surfaces.

The [migration status page](https://uichat-mira.github.io/folio/reference/migration-status/) records the current state with its evidence.

## What Folio provides

- Markdown and YAML Frontmatter content model
- Documentation, article, project, and page entry types
- Vite content discovery and `virtual:folio/content`
- Generated routes, navigation roots, and heading extraction
- Theme-aware `FolioEntryList` / `FolioListPage` for first-party or external publications
- Configurable static HTML generation
- Portal default home, explicit Editorial template, and home-only static override
- Canonical, Open Graph, Twitter, and JSON-LD metadata
- `404.html`, `sitemap.xml`, and `robots.txt`
- GitHub Pages project-path and root-path support
- A lightweight React runtime that consumers may use or replace
- Reusable Markdown compatibility rendering for reviewed content

## Package exports

- `@uichat-mira/folio` — content model, configuration helpers, React runtime, and Markdown rendering
- `@uichat-mira/folio/vite` — Markdown discovery, virtual manifests, and static output
- `@uichat-mira/folio/pwa` — optional PWA build integration
- `@uichat-mira/folio/pwa/react` — optional React update prompt/hooks
- `@uichat-mira/folio/styles.css` — whole-site default stylesheet (not an isolated embed stylesheet)

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
- **uichat-mira-docs** — Mira website and first downstream migration target; it still depends on `@uichat-mira/docs`
