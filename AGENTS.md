# Folio Repository AI Instructions

This repository is owned by the `uichat-mira` GitHub Organization and follows the current Organization instructions in `uichat-mira/.github/AGENTS.md`.

## Repository identity

This repository is **Folio**.

Canonical runtime/package identity:

- repository: `uichat-mira/folio`
- npm package: `@uichat-mira/folio`
- reusable package directory: `packages/folio`
- Vite virtual module: `virtual:folio/content`

The predecessor package `@uichat-mira/docs` belongs to the pre-Folio MiraDocs line. Do not reintroduce compatibility aliases or old public API names into Folio unless a future task explicitly demonstrates a required consumer.

## Ownership boundaries

- `packages/folio` owns the reusable Folio package.
- `apps/site` owns the official self-hosted Folio site/demo.
- `schemas` owns repository-local content schemas.
- Canonical Organization Skills live in `uichat-mira/.github`; this repository does not keep a second Skill copy.
- Downstream consumer sites, including the Mira website, own their own branding and page composition.

## Verification

Use the repository scripts rather than inventing parallel checks.

```bash
npm ci --no-audit --no-fund
npm run release:check
```

For changes that affect package portability, keep the Windows package verification meaningful as well.

## Environment and release contract

See `.github/ENVIRONMENT.md`.

The repository follows the Mira branch model:

```text
feat/* -> dev -> test -> prod
```

`main` is retained only as a historical/import compatibility branch. It must not publish npm packages or deploy the production site.

Production publication is allowed only from the `prod` lineage:

- GitHub Pages deploys only from `prod`.
- npm publication is triggered by a GitHub Release whose tag commit is contained in `prod`.
- npm Trusted Publishing must identify `uichat-mira/folio` and `publish.yml`.

## Change boundaries

- Preserve Folio's public API unless the active task explicitly changes it.
- Do not silently weaken package verification, release checks, or static-site build checks to make CI green.
- Remove verified-obsolete migration paths instead of maintaining duplicate contracts.
- Keep repository-specific rules here; do not copy Organization policy into this repository.
