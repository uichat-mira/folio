# Publishing @uichat-mira/folio

The npm package is published from `packages/folio`. The workspace root and official site remain private.

## Release gate

From the repository root:

```bash
npm ci
npm run release:check
```

`release:check` runs type checking, tests, the official-site build, an `npm pack --dry-run` audit, and an isolated tarball consumer check. The audit verifies the package manifest and required `dist` files and rejects leaked source or test files; the consumer check installs the packed tarball into a throwaway project, resolves the declared entrypoints and types, and builds a Vite site from it.

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
