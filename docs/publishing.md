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

Install the current published release:

```bash
npm install @uichat-mira/folio@0.1.1
```

**Do not republish 0.1.0:** npm versions are immutable. Its already-published README was packed before the manual bootstrap and still contains historical pre-publication wording; that immutable `0.1.0` Registry tarball cannot be edited in place. The subsequent `0.1.1` release contains the corrected package README, and the repository/official-site documentation is being reconciled separately.

### Release lineage and current state

- The historical MiraDocs tag `v0.1.0` remains unchanged. The Folio `0.1.0` npm package was manually bootstrapped and has no Folio GitHub Release.
- The first Folio OIDC-backed GitHub Release is [`folio-v0.1.1`](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1), published on 2026-11-01. Its immutable tag resolves to `e4af1f7de3a8d6004f052fcb99f0b412405fcc3c` in the `prod` history, with package version `0.1.1`.
- The initial [Publish npm package #41282326983](https://github.com/uichat-mira/folio/actions/runs/41282326983) used npm 11 on Node 24 with `id-token: write`. The actual `npm publish --access public` step succeeded and published a signed provenance statement to the transparency log. npm reported that the package was still being processed; the public Registry returned `E404` for the original ~2-minute gate, so the overall first attempt failed **after** publishing.
- [Attempt 2 of the same release workflow](https://github.com/uichat-mira/folio/actions/runs/41282326983) completed successfully: the already-published-version check skipped the publish step, then the real Registry-installed consumer verified SRI, matching JS/types/CSS, strict TypeScript, Vite discovery, and static output. **Do not re-publish `0.1.1`.** A green rerun alone is not evidence of a second publish.
- [PR #101](https://github.com/uichat-mira/folio/pull/101) → [#102](https://github.com/uichat-mira/folio/pull/102) → [#103](https://github.com/uichat-mira/folio/pull/103) improved the future publish workflow's bounded Registry visibility polling to 60 probes at 30-second intervals. This code landed on `prod` commit `711c6c6350abfd15e47f0ce04f6f3a35b8d64843` without changing the released tarball or tag. Production Linux Validate, Windows package check and Pages build/deploy checks passed on this commit.
- The maintainer previously confirmed the npm website's private Trusted Publisher configuration for `uichat-mira/folio`, workflow `publish.yml`, with direct `npm publish` permission. The successful OIDC publication is independent execution evidence. The npm dashboard's current private UI validation badge is not directly readable through GitHub and should not be reported as independently checked.
- The previous `@uichat-mira/docs` package remains available while downstream consumers migrate. No new version, deprecation, or migration is authorized by these release records.

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
