# FOL-015 · Folio 0.1.0 Release Candidate — preflight and reconciliation

Status: **candidate-preparation only; not promoted or released**. This is a branch-diff and release-integrity record, **not** a claim that FOL-015 acceptance is complete.

## Immutable starting point (2026-11-01)

- Folio repository `uichat-mira/folio`, npm `@uichat-mira/folio@0.1.0`.
- Post-#91 `dev` source integration: `e67fd2943e6ae83f317c580caa1ae01f17fd2ee8`. #91 merged after FOL-012 #88 (`d53769da`), FOL-014 #89 (`1efd8c10`), FOL-013 #87 (`8c20d8de`) and documentation hygiene #90 (`04c2b284`).
- Initial `test` HEAD: `e0214878ecb9dbcc6fec03bf7578580830cd092e`.
- Initial `prod` HEAD: `9db880c6dff8dd75bd0c694638ebc4af9ab2ac7f`.
- Their common `dev` merge base: `5fb13a69bd895b4dd7e2a240f7ddebfe23b83bac`.
- Compare results at this point: `test...dev` = **25 dev-only, 4 test-only**; `prod...dev` = **25 dev-only, 7 prod-only**. Historical branches are **diverged**, not fast-forwardable. These counts are before this candidate documentation PR.
- This PR changes release guard, candidate evidence gate and docs. It is **not yet the final release commit**: after review and merge, re-read `dev` and pin the resulting **full SHA** in Issue #85 before promotion. Do not use a predicted merge SHA.

## What the diverged environment branches contain

`test` has these four unique commits:
- `5d7f011b` — staged Folio standalone Reviewer workflow
- `420a6925` — corrected Reviewer workflow
- `a2772b2c` — PR timeline review comment permissions
- `e0214878` — FOL-011 paid Worker caller staged on test

`prod` has seven commits beyond the common merge base, largely matching Reviewer workflow changes carried through explicit merge commits (`a8fb1cc7`, `aab2f18d`, `8b21894f`) plus the FOL-011 Worker caller promotion `9db880c6`. These are **existing production history**, not disposable divergence.

The code delta from `dev` includes package content/heading fixes, independent tarball checks, canonical consumer documentation, researcher fixtures and site UI. The stage-specific differences include `.github/workflows/mira-ai-review.yml` and `.github/workflows/mira-external-worker.yml`. **Do not overwrite or blindly prefer `dev` on these files**; reconcile each workflow against the current effective test/prod state and the organization caller configuration.

Promotion sequence, after separate maintainer authorization:
1. Prepare a real `dev → test` PR. Preserve test-only history. Inspect conflicts and merge results; test exact target SHA with Linux, Windows, Pages/site build and independent Chrome candidate acceptance.
2. Then prepare `test → prod` PR. Preserve prod-only Reviewer/Worker changes and compare production-only workflow outcomes; validate exact PR merge and production target. No force push, no `main` publication.
3. Only after authorized target checks and the final accepted `prod` commit is known may FOL-016 create a new release tag.

## Candidate evidence and release blockers

Already established (source PRs, not evidence of test/prod deploy):
- FOL-012: trusted Markdown and whole-site CSS contract, static/custom shell limits.
- FOL-013: heading TOC/HTML ID parity and regression, existing body anchor preservation.
- FOL-014: real tarball, Chrome 156 desktop 1440/mobile 375 screenshots & interactions; the original run exposed virtual-module TS2307 and 21px mobile targets.
- #91: package-owned ambient declaration, strict tarball NodeNext/Bundler type checks (including virtual-only program with **package types registration**, no local module shim), 40px touch targets for both React buttons and static summary controls.

**Still required before marking candidate accepted**:
- This PR's exact SHA checks including `release:check`, Windows package check and Pages build.
- Fresh `docs/research/fol-014/run.mjs` against the selected merged candidate; no reuse of historical `results/acceptance.json`. Candidate PR / promotion PRs run a dedicated Chrome job and upload 7-day evidence. Require zero FAIL, valid navigation, no JS console errors, and ≥40px actual React mobile controls.
- Static no-JS touch visual verification remains a separate inspection limit: the React consumer harness does not exercise the `<details>/<summary>` static shell. Keep the new CSS and static generation regression intact, and explicitly record whether the final acceptance has also checked static summary bounding boxes.
- Both environment branches' unique CI/Worker changes reconciled and target commits validated after authorization.
- Registry bootstrap and Trusted Publishing remain strictly FOL-016 tasks; no initial npm publication yet.

## Tag, package version, provenance and rollback

- `packages/folio/package.json` and workspace package version remain `0.1.0`; no version bump/lockfile mutation is needed in this candidate PR.
- Existing `refs/tags/v0.1.0` points to **historical MiraDocs** SHA `7cbf4b9bebee948f9bcc76ea5d157955fe9be608` (2026-07-25). It belongs to historical `prod` ancestry and must not be moved, deleted or reused.
- New tag contract for **future** Folio release: `folio-v<package-version>`, starting `folio-v0.1.0`. `publish.yml` checks this exact name, package version, and `prod` ancestry. This prevents a historical `v0.1.0` Release from satisfying Folio's gate.
- No new tag, GitHub Release, npm publish, Pages deploy, stage branch merge or history rewrite occurs in this PR.
- Preserve initial stage refs above as rollback comparison anchors. If later promotion must be rolled back, use reviewed revert/forward-fix under the branch policy, never reset production history with force push. The brand-migration historical anchor from `.github/ENVIRONMENT.md` is `b75b1ebeb9800788041162436486159359b17794` but is **not** a shortcut to undo release-candidate promotion.

## Work-item disposition

Issue #85 stays OPEN until separately authorized `dev → test → prod` advancement is verified and the sole final candidate SHA is pinned to the Issue. FOL-016 remains a separate public side-effect boundary.
