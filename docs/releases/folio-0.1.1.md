# Folio 0.1.1 — published release

**Status:** Published on 2026-11-01 through [GitHub Release `folio-v0.1.1`](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1), with npm Trusted Publishing / OIDC and verified public Registry consumer.

## Final release evidence

- Release tag `folio-v0.1.1` points to accepted production candidate `e4af1f7de3a8d6004f052fcb99f0b412405fcc3c`; historical MiraDocs `v0.1.0` was not moved.
- [Publish workflow #41282326983](https://github.com/uichat-mira/folio/actions/runs/41282326983), attempt 1: successful `npm publish --access public` with signed provenance; npm reported post-publish processing. The public Registry returned `E404` during the original ~2-minute visibility gate, so the first attempt failed only at the post-publish Registry acceptance step.
- Attempt 2: package `0.1.1` was already visible; publishing was skipped safely, and the independent Registry-installed consumer (SRI, JS/types/CSS equality, strict TypeScript, Vite and static HTML) passed. Entire workflow concluded **success**.
- [PRs #101](https://github.com/uichat-mira/folio/pull/101), [#102](https://github.com/uichat-mira/folio/pull/102), and [#103](https://github.com/uichat-mira/folio/pull/103) promoted the bounded ~30-minute scan/propagation poll fix through `dev → test → prod`. The resulting `prod` head is `711c6c6350abfd15e47f0ce04f6f3a35b8d64843`; its Linux validation, Windows package check, Pages build/deploy succeeded. This workflow repair did **not** modify or re-publish `0.1.1`.
- Downstream `uichat-mira-docs@prod` still uses `@uichat-mira/docs`; GitHub Pages deployment is distinct from a separately executed public HTTP smoke. The current private npm Trusted Publisher dashboard badge has not been read back independently.

The following scope and constraints are the **historical pre-release candidate contract**, retained for traceability.

## Scope

Patch-only release following the public manual `@uichat-mira/folio@0.1.0` bootstrap. No Folio runtime behavior, public API, routing, parser, static generation, or CSS changes.

- Align root, Folio package, official-site workspace dependency, and npm lockfile to `0.1.1`.
- Ship corrected, up-to-date package README instead of the 0.1.0 tarball's historical “not published” text.
- Strengthen the production `publish.yml` path: after real OIDC `npm publish`, read public Registry metadata with bounded propagation retries and run the existing `registry:consumer` to verify SRI, JavaScript/types/CSS provenance and real NodeNext/Bundler/Vite/static consumption.

## Original candidate and release constraints (historical)

- Follow `feat/* → dev → test → prod` with reviewed merge PRs; preserve source/target history and check both Linux and Windows packaging plus official-site build on exact promotion trees.
- Pin the final `prod` SHA in the GitHub Release; tag must be **`folio-v0.1.1`**, not historical `v0.1.0` (MiraDocs). Ensure it resolves to the reviewed production commit.
- The `publish.yml` `release.published` trigger requires the tag commit to be an ancestor of `prod`; checks package version against the tag.
- npm Trusted Publisher must be configured on the already-existing public package with GitHub owner `uichat-mira`, repo `folio`, workflow filename `publish.yml`, **Allow npm publish** checked, optional environment left blank. Publisher must successfully publish within 2 days of a new configuration; configure immediately before release.
- No npm automation tokens or local re-publish. Failure to authenticate via OIDC blocks publication; do not fall back to a human token from CI.
- After `0.1.1` Registry verification, confirm published metadata, new dist tarball, README and provenance (if public source allows). Keep Issue #86 open pending explicit closure authority.

## Rollback

The previous public `@uichat-mira/folio@0.1.0` remains immutable. A broken release cannot be overwritten; preserve history and correct forward with a newly reviewed patch. Do not move old release tags.
