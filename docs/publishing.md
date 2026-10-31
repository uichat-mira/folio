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

## First public release and evidence

FOL-014's historical tarball test originally reproduced `TS2307` on `virtual:folio/content`. FOL-013 and the packaged virtual module fix are included in the accepted 0.1.0 production commit. FOL-015's Chrome candidate acceptance passed **23 PASS / 0 FAIL** at desktop and mobile viewports with measured 40px React mobile controls; physical-touch and non-Chromium behavior remain outside this evidence.

On 2026-11-01 the maintainer **manually bootstrapped** `@uichat-mira/folio@0.1.0` from accepted production commit `40db582b20b5be7a070ab936a99255a75ca15232`. The npm CLI reported success. Independent [FOL-016 Registry consumer CI](https://github.com/uichat-mira/folio/actions/runs/41247604056) then:

- Read the public `npm view` metadata and confirmed `0.1.0` and `dist.integrity`;
- Installed the exact package from `https://registry.npmjs.org/` in a fresh external project, validated the `package-lock.json` Registry URL and SRI;
- Compared installed JS, declaration and stylesheet contents with the accepted source, allowing only CRLF/LF differences in Windows-published text;
- Passed strict NodeNext/Bundler and virtual-only TypeScript consumer checks, real Vite Markdown discovery and negative control, and staticRoutes on/off with 404, sitemap and robots files.

The public install command is now:

```bash
npm install @uichat-mira/folio@0.1.0
```

**Do not republish 0.1.0:** npm versions are immutable. Its already-published README was packed before the manual bootstrap and still contains historical pre-publication wording; that specific Registry README cannot be edited in place and must be corrected in a future version. This repository's current README and official site documents are corrected in FOL-016.

### Release lineage and remaining work

- Legacy MiraDocs tag `v0.1.0` belongs to historical commit `7cbf4b9` and is unchanged.
- Future Folio GitHub Release tag is `folio-v0.1.0`; as of this record it has not been created. `publish.yml` requires this prefix plus `prod` ancestry and safely skips `npm publish` when the version already exists. Its OIDC path **has not** been exercised by the first manual publish.
- Trusted Publisher is a separate **npm package-admin private setting** and is unverified. Exact future binding: GitHub organization `uichat-mira`, repository `folio`, workflow filename `publish.yml`, allow `npm publish`. The workflow uses GitHub-hosted runners, `id-token: write`, Node 24/npm 11.
- npm's current rule requires first successful OIDC publish within **48 hours of configuring a new Trusted Publisher**; coordinate configuration with the next approved version release so it does not expire unused. Do not create a long-lived npm automation token.
- The previous `@uichat-mira/docs` package remains supported while downstream consumers migrate. Neither FOL-016 nor this doc authorizes a new npm version, tag, GitHub Release or deprecation.

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
