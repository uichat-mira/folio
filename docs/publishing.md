# Publishing @uichat-mira/folio

The npm package is published from `packages/folio`. The workspace root and official site remain private.

The consumer-facing installation status, trusted-content boundary, and stylesheet scope are summarized in [docs/consumer-contract.md](consumer-contract.md).

## Release gate

From the repository root:

```bash
npm ci
npm run release:check
```

`release:check` runs type checking, tests, the official-site build, an `npm pack --dry-run` audit, and an isolated tarball consumer check. The audit verifies the package manifest and required `dist` files and rejects leaked source or test files; the consumer check installs the packed tarball into a throwaway project, resolves the declared entrypoints and types, and builds a Vite site from it.

## First release candidate: unresolved gates

The package's existing `release:check` verifies exported package entrypoints and an isolated Vite consumer. It does **not** currently prove that a TypeScript user can import `virtual:folio/content` without a local declaration: [FOL-014](research/fol-014-default-ui-acceptance.md) reproduced `TS2307` on a real tarball. Before 0.1.0 publication, ship the package-owned ambient declaration and rerun strict `tsc` from a fresh tarball consumer **without** any consumer declaration; rerun the FOL-014 UI/navigation acceptance on the final merged candidate after FOL-013.

There is an independent **release-tag identity conflict**: the existing `v0.1.0` tag points to the 2026-07-25 historical MiraDocs commit `7cbf4b9`, even though it is an ancestor of `prod`. The current `publish.yml` checks the exact `v${VERSION}` name plus `prod` ancestry, but this is **not evidence that the tag denotes Folio's accepted release candidate**. FOL-015 must explicitly resolve the tag/version/workflow strategy while preserving historical provenance; do not move or delete the legacy tag silently, and do not create a Folio Release from it.

FOL-015 owns candidate validation, safe `dev → test → prod` lineage and the tag strategy. FOL-016 owns any authorized first npm Registry publication, Trusted Publisher validation and Registry-installed consumer evidence. Neither a green PR nor this documentation authorizes a release.

## Bootstrap the new package name

Folio is a new npm package name rather than a rename-in-place of `@uichat-mira/docs`.

As of 2026-11-01 this bootstrap has not happened: the registry returns 404 for `@uichat-mira/folio`, and the repository has no Folio GitHub Release, so `publish.yml` has never run.

The first `@uichat-mira/folio@0.1.0` publication must establish the package under the existing `@uichat-mira` npm organization. Perform that bootstrap only from the accepted `prod` candidate:

```bash
cd packages/folio
npm login
npm publish --access public
```

After the package exists, configure its npm Trusted Publisher and use GitHub Releases for subsequent versions.

## Trusted Publisher

Configure the `@uichat-mira/folio` package with:

- GitHub owner: `uichat-mira`
- Repository: `folio`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

The workflow uses a GitHub-hosted runner, OIDC via `id-token: write`, Node 24, and npm 11.

Do not create a long-lived npm automation token for normal Folio publishing.

## Predecessor package

`@uichat-mira/docs` remains available for existing consumers while they migrate. Once known consumers have moved, deprecate the predecessor package with a message pointing to `@uichat-mira/folio`; do not unpublish it.
