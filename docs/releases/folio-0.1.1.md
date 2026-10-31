# Folio 0.1.1 — release candidate

**Status:** source candidate; not published until GitHub Release `folio-v0.1.1` succeeds through npm Trusted Publishing.

## Scope

Patch-only release following the public manual `@uichat-mira/folio@0.1.0` bootstrap. No Folio runtime behavior, public API, routing, parser, static generation, or CSS changes.

- Align root, Folio package, official-site workspace dependency, and npm lockfile to `0.1.1`.
- Ship corrected, up-to-date package README instead of the 0.1.0 tarball's historical “not published” text.
- Strengthen the production `publish.yml` path: after real OIDC `npm publish`, read public Registry metadata with bounded propagation retries and run the existing `registry:consumer` to verify SRI, JavaScript/types/CSS provenance and real NodeNext/Bundler/Vite/static consumption.

## Candidate and release constraints

- Follow `feat/* → dev → test → prod` with reviewed merge PRs; preserve source/target history and check both Linux and Windows packaging plus official-site build on exact promotion trees.
- Pin the final `prod` SHA in the GitHub Release; tag must be **`folio-v0.1.1`**, not historical `v0.1.0` (MiraDocs). Ensure it resolves to the reviewed production commit.
- The `publish.yml` `release.published` trigger requires the tag commit to be an ancestor of `prod`; checks package version against the tag.
- npm Trusted Publisher must be configured on the already-existing public package with GitHub owner `uichat-mira`, repo `folio`, workflow filename `publish.yml`, **Allow npm publish** checked, optional environment left blank. Publisher must successfully publish within 2 days of a new configuration; configure immediately before release.
- No npm automation tokens or local re-publish. Failure to authenticate via OIDC blocks publication; do not fall back to a human token from CI.
- After `0.1.1` Registry verification, confirm published metadata, new dist tarball, README and provenance (if public source allows). Keep Issue #86 open pending explicit closure authority.

## Rollback

The previous public `@uichat-mira/folio@0.1.0` remains immutable. A broken release cannot be overwritten; preserve history and correct forward with a newly reviewed patch. Do not move old release tags.
