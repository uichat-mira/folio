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

[FOL-014](research/fol-014-default-ui-acceptance.md) originally reproduced `TS2307` for `virtual:folio/content` in a fresh independent consumer. The source candidate now packages an ambient declaration referenced by its public type entrypoints and extends `release:check` to cover strict NodeNext/Bundler TypeScript imports from the real tarball without local declarations or `skipLibCheck`. Verify the final 0.1.0 candidate and rerun FOL-014 browser/TOC tests after FOL-013 and the mobile tap-target change.

**Tag identity (FOL-015 candidate strategy):** the existing `v0.1.0` tag belongs to the historical MiraDocs commit `7cbf4b9` (2026-07-25) and remains untouched. Folio's first `@uichat-mira/folio@0.1.0` Release must instead use `folio-v0.1.0`. The `publish.yml` candidate guard requires `folio-v${VERSION}`, verifies the tagged commit is in `prod` history, and runs release checks before publication. **Do not create this tag or a GitHub Release during FOL-015**; FOL-016 owns the separately authorized Registry bootstrap/publish operation. See [the FOL-015 candidate manifest](releases/folio-0.1.0-candidate.md).

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
