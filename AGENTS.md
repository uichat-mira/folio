# Folio Repository AI Instructions

This repository is owned by the `uichat-mira` GitHub Organization and follows the current Organization instructions in `uichat-mira/.github/AGENTS.md`.

## Repository identity

The repository is named **Folio**. During the current migration stage, the published runtime and package still use the **MiraDocs** identity and the package name `@uichat-mira/docs`.

Do not rename the public package, package directory, exported API, or consumer-facing compatibility contracts merely because the repository has been renamed. A Folio brand/package migration is a separate work item and must be explicit.

## Ownership boundaries

- `packages/mira-docs` owns the reusable package currently published as `@uichat-mira/docs`.
- `apps/site` owns the repository's official self-hosted site/demo.
- `schemas` owns repository-local content schemas.
- `skill-backup` is a reference copy only. Canonical Organization Skills live in `uichat-mira/.github`.
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
- npm Trusted Publishing must identify the current repository, `uichat-mira/folio`, before the next real publish.

## Change boundaries

- Preserve the current public API unless the active task explicitly changes it.
- Do not silently weaken package verification, release checks, or static-site build checks to make CI green.
- Remove migration-only compatibility paths once they no longer have a verified consumer.
- Keep repository-specific rules here; do not copy Organization policy into this repository.
