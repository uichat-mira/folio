# FOL-026 / FOL-027 / FOL-028 joint acceptance

- Date: 2026-11-03 (Asia/Shanghai)
- Baseline: `origin/dev @ c828e8a6a00fdf3c0ecdf2f2dd613ad8d68c0be7`
  (merge of `feat/fol-025-content-dates`, PR #139)
- Integration branch: `feat/integration-fol-026-027-028`; three-feature merge
  `2bf99e6`, initial static-output collision fix `f9d97fb`, and path-prefix
  fix sync commits `9810d8d`, `57e5c75`, `1fc1d4c`. This report was updated
  after those code commits; the branch contains the combined features and both fixes.
- Status: three independently reviewable Draft PRs + one integration branch.
  **Nothing was merged, closed, promoted or deployed.**

## 1. Goal

Deliver three independent features on the same locked baseline, each through
its own `feat/` branch and Draft PR to `dev`, then prove they compose:

1. FOL-026 (#125): native RSS 2.0 / Atom 1.0 feeds with HTML auto-discovery.
2. FOL-027 (#126): article structured metadata (JSON-LD), author precedence
   and sitemap `<lastmod>`.
3. FOL-028 (#127): explicit site-level indexing policy (`siteIndexing`) and
   `robots.txt` consistency.

Each worker ran in an isolated worktree with its own `npm ci`; the Lead then
merged the exact branch heads in a fourth worktree, resolved conflicts by hand,
and ran the joint acceptance below.

## 2. Branches and pull requests

| Feature | Branch | Head commit | Draft PR | Issue |
| --- | --- | --- | --- | --- |
| FOL-026 feeds | `feat/fol-026-rss-atom` | `0a39a5a` (P2 + path-prefix fixes; features at `6a90499`) | [#142](https://github.com/uichat-mira/folio/pull/142) | #125 |
| FOL-027 structured metadata | `feat/fol-027-structured-metadata` | `8dc00e0b197ded5488d990ca595c4e159f56f876` | [#141](https://github.com/uichat-mira/folio/pull/141) | #126 |
| FOL-028 site indexing | `feat/fol-028-indexing` | `85507f753c161dfbce2ac5b5eba4558d07a51ccd` | [#140](https://github.com/uichat-mira/folio/pull/140) | #127 |
| Integration | `feat/integration-fol-026-027-028` | `1fc1d4c` (combined code tip; report-only updates follow) | none (branch only) | — |

All three PRs are `draft`, target `dev`, use `Refs #…` (never `Closes`), carry
the dsh badge, and were authored from the same baseline.

## 3. Feature summaries

### FOL-026 — RSS 2.0 / Atom 1.0 feeds

- Public API: `FolioStaticBuildOptions.feeds?: FolioStaticFeedOptions[]` with
  `{ path, title?, description?, rss?: "file" | false, atom?: "file" | false }`;
  defaults `rss.xml` / `atom.xml`. Exported from the `/vite` entry.
- Feeds are per route directory, select documents recursively (all doc types),
  and require `config.siteUrl`; without it no feed file and no alternate link
  is produced. Output names are normalized (`./rss.xml`, `rss.xml`, `RSS.XML`
  are one target) and checked against each other and every static output the
  same build writes: page targets (`<route>/index.html`), `404.html`,
  `sitemap.xml` and `robots.txt` when enabled. Equal paths and ancestor /
  descendant overlaps at path-segment boundaries throw before the first write;
  disabled fixed outputs release their names.
- Every generated page (including `404.html`) gets absolute
  `rel="alternate"` links only for files actually written; pre-existing
  RSS/Atom alternates in a consumer template are stripped first.
- Dates reuse the frozen FOL-025 provenance: RSS `pubDate` / Atom `published`
  only from `frontmatter` / `legacy-date`; Atom `updated` from trusted
  `frontmatter` / `git-last-commit`, falling back to the trusted published
  date. An undated document stays in RSS without `pubDate` and is excluded
  from Atom. Empty source → valid zero-item RSS, no Atom.
- New `src/build/feed.ts`, `test/feeds.test.mjs` (20 tests, including the
  post-review static-output collision regression), test-only
  `scripts/checks/xml.mjs`, plus consumer fixture/checks and
  `docs/static-build.md`.

### FOL-027 — structured metadata, authors, sitemap `lastmod`

- Public API: `FolioConfig.author?: FolioAuthor | FolioAuthor[]`,
  `FolioAuthor = string | { name: string; url?: string }` (exported from the
  root entry), and `FolioStaticRoute.lastmod?: string`.
- Default JSON-LD page types: home `WebSite`, configured collection
  `CollectionPage`, documents `Article` (article type) / `TechArticle`, any
  other doc-less custom route `WebSite`. A consumer `route.jsonLd` still wins
  untouched.
- Author precedence: document frontmatter (`author` array, `|`/`,`/`，`
  string, `{ name, url }` objects) → `config.author` → omit the property.
  Never `author: []` and never a fabricated person.
- `datePublished` only when `dateSources.publishedAt` is `frontmatter` or
  `legacy-date`; `dateModified` only when `updatedAt` exists with
  `frontmatter` / `git-last-commit`. `git-first-commit`, build time and file
  mtimes are never used.
- Sitemap `<lastmod>`: explicit validated `route.lastmod` (normalized to ISO
  8601 UTC; invalid throws before the first page write) else trusted
  `doc.updatedAt`; otherwise `<loc>` only. `404` is never listed.
- New `src/build/structured-data.ts`, `test/structured-metadata.test.mjs`
  (20 tests), shared XML helper `test/helpers/xml.mjs`, SEO consumer fixture.

### FOL-028 — site-level indexing policy

- Public API: `FolioStaticBuildOptions.siteIndexing?: "index" | "noindex"`,
  default `"index"`. Explicit opt-in only: no hostname, `github.io`,
  `localhost`, base-path, environment or repository-name sniffing.
- Page robots precedence: explicit `route.robots` (verbatim) → policy →
  `"index,follow"`. `404.html` stays `noindex,nofollow` in both modes; an
  explicit not-found `robots` still wins.
- `noindex` writes the preview `robots.txt` marker with `Allow: /` and no
  `Sitemap:` line (crawling must stay allowed so crawlers can read the
  page-level `noindex`). `sitemap.xml` is still generated unless
  `sitemap: false`; default mode output is byte-identical to before.
- Invalid runtime values throw before any file is written.
- New internal `src/build/indexing.ts`, `test/indexing.test.mjs`, consumer
  noindex mode, README/docs updates.

## 4. Integration

Worktree: `D:\folio-worktrees\integration`, branch
`feat/integration-fol-026-027-028`, created from `c828e8a`.

Merges (`--no-ff`, in this order):

| Merge commit | Branch | Result |
| --- | --- | --- |
| `682daac` | FOL-027 `8dc00e0` | clean |
| `0729ff5` | FOL-028 `85507f7` | conflicts: `docs/static-build.md`, `packages/folio/scripts/checks/static-consumer.mjs` |
| `2bf99e6` | FOL-026 `6a90499` | conflicts: `src/static.ts`, `scripts/checks/static-consumer.mjs`, `fixtures/vite-consumer/vite.config.ts`, `docs/static-build.md` |
| `f9d97fb` | FOL-026 `6f1d654` (P2 fix) | conflict: `src/static.ts` only (kept both the sitemap-lastmod preflight and the feed plan with reserved outputs) |

Conflict log and resolution:

1. `packages/folio/src/static.ts`
   - imports: kept all three import blocks (`build/indexing`, `build/feed`,
     `build/structured-data`).
   - `FolioStaticBuildOptions`: kept both `feeds` and `siteIndexing` with their
     original doc comments.
   - feed helpers: FOL-026's `buildStaticFeedPlan` / stale-alternate regex were
     kept where FOL-027 had removed the old local `dataList` / `defaultJsonLd`;
     the removal stays, and `renderFolioStaticHtml` uses
     `defaultFolioJsonLd` for JSON-LD. No duplicate JSON-LD generator exists.
   - the single render path now resolves `robots` through
     `resolveFolioIndexingRobots`, injects feed `alternates`, and projects
     structured data; the write path resolves `sitemapLastmods` and builds
     `feedPlan` (with the reserved static outputs) before the first write, then
     writes pages/404/sitemap/robots and finally the feed files. Trusted-date
     sets are identical in `feed.ts` and `structured-data.ts`.
   - the post-review fix merge `f9d97fb` conflicted only in the ordering block:
     the bookkeeping order is `sitemapLastmods` → `feedPlan` → route write, and
     the feed plan receives `staticReservedOutputs(...)` derived from the
     home-overridden route set plus `404.html` and the enabled fixed outputs.
2. `packages/folio/scripts/checks/static-consumer.mjs`
   - kept both test-only XML helpers (FOL-026 `./xml.mjs` for RSS/Atom,
     FOL-027 `../../test/helpers/xml.mjs` for sitemap), combined `runBuild`
     options (`seoMode`, `feedsMode`, `siteIndexing`, `contentDir`), kept all
     env switches, and kept both the FOL-028 noindex block and the FOL-026
     feeds block (plus the feeds-off counter-check).
3. `packages/folio/scripts/fixtures/vite-consumer/vite.config.ts`
   - `baseStaticOptions` (default / home override / SEO home with explicit
     `lastmod`) → `staticOptions` adds `feeds` when `FOLIO_CONSUMER_FEEDS=on`
     → `staticOptionsWithIndexing` adds `siteIndexing`. Each mode composes
     instead of replacing the others; no mode loses its previous assertions.
4. `docs/static-build.md`
   - one document now contains the FOL-027 article/author/date/lastmod
     sections, the FOL-028 indexing sections and the FOL-026 feed sections,
     without duplicated contract text.

No worker test was changed or weakened; `npm test` runs all suites
(151 tests total).

## 5. Verification

All commands run on Windows (node v24.9.0, win32/x64) in
`D:\folio-worktrees\integration` unless noted.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | pass | 274 packages |
| `npm run build -w @uichat-mira/folio` | pass | tsup ESM + DTS |
| `npm run typecheck` | pass | folio + site `tsc --noEmit` |
| `npm test` | pass | 151 / 151 tests |
| `npm run release:check` | pass | validate + `pack:verify` + tarball `pack:consumer`; consumer source `f9d97fb` (also re-run on the FOL-026 fix branch at `6f1d654`) |
| combined smoke (`D:\folio-worktrees\combined-smoke`) | pass | 57 / 57 assertions, re-built and re-run from the merged tree after the P2 fix |
| joint matrix (`D:\folio-worktrees\acceptance`) | pass | 10 / 10 scenarios, 49 assertions, Python 3.10.6 + lxml 5.3.0, re-built and re-run after the P2 fix |
| tarball consumer (`D:\folio-worktrees\tarball-acceptance`) | pass | 26 assertions, tarball sha256 `687815…0ba1` |
| FOL-026 static-output collision regression | pass | `feeds.test.mjs` 20/20 on the branch + tarball consumer `collision.mjs`: 12 rejected names (index/404/sitemap/robots/document/collection/`./`/case/trailing-dot/atom/traversal/drive-letter), 1 allowed disabled-output case, no partial writes |

The tarball consumer is a real `npm pack` artifact from the integration
branch, extracted into a clean consumer `node_modules`; its single Vite build
enables feeds + `siteIndexing: "noindex"` + structured metadata + `lastmod`
together at base `/moyu/`. (The pre-existing `release:check` consumer also ran
all of its default/noindex/feeds/SEO/home modes against the same tarball.)

## 6. Joint acceptance matrix

Fixtures: `D:\folio-worktrees\acceptance\{root-index,subpath-noindex,empty}`,
each built with Vite from the integration `dist/vite.js`.
Parser: `python verify_acceptance.py` (lxml for RSS/Atom/sitemap,
`json.loads` for JSON-LD).

| # | Scenario | Checks | Result |
| --- | --- | --- | --- |
| 1 | Root-path deployment (`base: "/"`) | canonical/JSON-LD/feed/sitemap URLs at `https://example.test/…`, explicit home `lastmod` | PASS (8) |
| 2 | `/moyu/` sub-path deployment | canonical, feed alternates and sitemap `loc` all base-prefixed | PASS (4) |
| 3 | Article without any trusted publication date | no `datePublished`/`dateModified`, RSS item without `pubDate`, excluded from Atom, no sitemap `lastmod` | PASS (5) |
| 4 | Article without author (no `config.author`) | no `author` key, never `[]`, Atom feed-level author is the site title | PASS (3) |
| 5 | Empty-content site | zero-item RSS parses, no `atom.xml`, sitemap parses with 2 routes, no Atom alternate | PASS (5) |
| 6 | Preview site | every page `noindex,nofollow`, exact preview `robots.txt`, no `Sitemap:` line, sitemap still generated | PASS (5) |
| 7 | Production default | exact legacy `robots.txt` bytes, home `index,follow`, 404 still noindex | PASS (3) |
| 8 | 404 policy | `noindex,nofollow` in both modes, discovery links present, never in sitemap/RSS | PASS (4) |
| 9 | XML with an independent real parser | RSS 2.0, Atom 1.0 (namespace), sitemap urlset parse via lxml; JSON-LD via `json.loads` | PASS (6) |
| 10 | Multi-collection metadata | two `CollectionPage` indexes, nested doc in its own feed only, cross-collection exclusion, nested sitemap `loc`, `Article` with trusted `datePublished` | PASS (6) |

Empty-row counter-check: a build without `feeds` writes no feed file and adds
no alternate link; the static consumer asserts this explicitly.

### 6.1 Post-review fix: FOL-026 feed/static output collision (P2)

Maintainer review found that the feed plan compared output names only with
other feeds. Because feed files are written after the pages, `404.html`,
`sitemap.xml` and `robots.txt`, a legal name such as `sitemap.xml`,
`index.html`, `404.html` or `blogs/post/index.html` silently overwrote that
artifact. The fix (branch commit `6f1d654`, merged as `f9d97fb`):

- `feed.ts` normalizes every output name first: `"./rss.xml"`, `"rss.xml"` and
  `"\\"`-free POSIX paths become one target; `.`/`..` segments, NUL,
  backslash, `:` (drive/stream targets) and empty names are rejected by the
  feed preflight instead of the late writer.
- `static.ts` passes the exact reserved target set into the planner before the
  first write: every final (home-overridden) route target
  (`index.html`, `<route>/index.html`), `404.html`, and `sitemap.xml` /
  `robots.txt` only when this build actually enables them.
- Comparison is case-insensitive and folds Windows-ambiguous trailing dots and
  spaces, so `SITEMAP.XML` and `sitemap.xml.` collide on every platform and the
  configuration fails identically on Linux, macOS and Windows.
- Collisions throw `folio static feed output conflict: …` while rendering the
  plan, i.e. before any page, fixed output or feed is written; the new tests
  assert the template is unchanged and no file appeared.
- `sitemap: false` / `robots: false` release those names, which is covered by
  an explicit positive test.

Regression evidence for the first fix: `test/feeds.test.mjs` 20/20 (branch +
integration), the packaged tarball `collision.mjs` (12 rejected names + 1
allowed case, real filesystem), full `release:check` on the branch and merged
tree, and the matrix/combined-smoke rebuilds above (`10/10`, `57/57`). No
other feature was modified; the merge conflicted only in the `static.ts`
write-ordering block.

### 6.2 Follow-up: feed/static file-directory prefix conflicts (P2)

A second pass found that exact normalized equality still missed paths where
one output file would need to be a directory for the other:

- Feed output `blogs` is an ancestor of the generated collection page
  `blogs/index.html`.
- Feed output `blogs/index.html/feed.xml` is nested below a generated HTML
  file.
- Feed output `sitemap.xml/feed.xml` is nested below the fixed Sitemap file.

`feed.ts` now compares normalized paths at segment boundaries and rejects
equality or either ancestor/descendant relationship against the reserved
static-output set. The check remains before the first write. The disabled
Sitemap / Robots behavior is unchanged.

Regression cases in `feeds.test.mjs` cover both page-path directions and a
fixed-file descendant; they assert that no route directory, page, fixed output
or feed is written before rejection. PR #142 current head
`0a39a5a` passed `npm run release:check` (124/124 tests, package verification
and isolated tarball consumer) and the Windows `build`, `pack:verify` and
`pack:consumer` checks (Validate run `41663239416`, both required jobs pass).

The same source, regression and documentation changes were synchronized to
the combined integration branch as `9810d8d`, `57e5c75`, `1fc1d4c`.
No new Issue or PR was created, #140 / #141 were not modified, and the full
10-scenario joint matrix was not rerun.

## 7. CI status

| Ref | Workflow / jobs | Result |
| --- | --- | --- |
| FOL-026 `0a39a5a` (PR #142, path-prefix fix) | Validate run 41663239416: `validate`, `windows-package-check` | pass, pass |
| FOL-027 `8dc00e0` (PR #141) | Validate: `validate`, `windows-package-check` | pass, pass |
| FOL-028 `85507f7` (PR #140) | Validate: `validate`, `windows-package-check` | pass, pass |
| Integration `2bf99e6` (branch push) | Validate run 41650121997: `validate`, `windows-package-check` | pass, pass |
| Integration `6e42147` report commit | Validate run 41651741152 | pass |
| Integration `f9d97fb` (P2-fix merge) | Validate run 41658185466: `validate`, `windows-package-check` | pass, pass |

Local Windows results are listed in section 5; CI `ubuntu` + Windows
`windows-package-check` both passed for every measured head. No unexecuted
check is claimed as passed.

## 8. PR compliance audit

| PR | Draft | Base | `Refs` | `Closes` | dsh badge | Files in scope |
| --- | --- | --- | --- | --- | --- | --- |
| #140 | yes | `dev` | #127 | no | yes | 7 files, FOL-028 only |
| #141 | yes | `dev` | #126 | no | yes | 12 files, FOL-027 only |
| #142 | yes | `dev` | #125 | no | yes | 9 files, FOL-026 only |

Diff review: each PR contains only its feature module/tests/fixture/docs plus
the shared static entry points it must touch; none mutates `dev`/`test`/`prod`,
workflows, release scripts, or another feature's implementation.

## 9. Authority compliance

- Issues #125, #126, #127 are still **open**.
- No PR was merged; all three remain draft and open. PR #142 received
  `6f1d654` and `0a39a5a` on its branch (still draft, not merged).
- The combined integration branch received the matching FOL-026 source,
  regression and documentation updates; #140 and #141 feature branches were
  not changed.
- `origin/dev` is still `c828e8a6a00fdf3c0ecdf2f2dd613ad8d68c0be7`.
- No change to Project status, milestones or labels.
- No promotion to `test`/`prod`, no deployment, no npm publish.
- No extra PR, no extra task card, no change to the main `D:\folio` checkout
  (clean on `dev`), no change to the three feature worktrees (each matches its
  pushed head).

## 10. Known limitations and risks

1. Feed output equality and file/directory prefix conflicts against Folio-owned
   static outputs are fixed in `6f1d654` and `0a39a5a`. Residual scope: names
   are compared against the outputs Folio itself writes, not arbitrary files a
   consumer drops into the output directory before the plugin runs (for
   example a hand-written `favicon.svg`); those are outside the static writer's
   target set.
2. No public W3C Feed Validator run (it needs a publicly reachable URL).
   Structural parsing, an independent XML parser and an independent feed
   reader were used instead.
3. FOL-027 intentionally omits `datePublished` when the only evidence is
   `git-first-commit` (including shallow clones); dates need `dateSources`
   provenance, so hand-built `FolioDoc`s without provenance emit no dates.
4. Home `WebSite` JSON-LD carries `config.description`, while the home route
   `description` drives the page/meta description. This is the frozen FOL-027
   contract; verify it is the intended mismatch-free shape before merging.
5. Preview mode still writes a `robots.txt` marker and (by default) a
   `sitemap.xml`; crawling intentionally stays allowed. `robots.txt` is not a
   search-result removal tool; already-indexed preview URLs need a separate
   removal request.
6. Intermediate integration commit `0729ff5` briefly contained a leftover
   documentation conflict marker; it was removed in `2bf99e6` and the tip has
   no marker anywhere. Review the tip diff, not the intermediate commit.
7. FOL-026 and FOL-027 each carry their own XML parser (test-only), by design
   to keep test infrastructure owned by its feature; neither is shipped.

## 11. Maintainer next actions

1. Review the three Draft PRs individually (they are independent and can be
   reviewed in any order): #142, #141, #140.
2. Merge to `dev` through the normal PR flow; merge order does not matter for
   the product, but re-run `npm run release:check` after the last merge.
3. Verify the combined behavior on the integration branch if desired:
   `feat/integration-fol-026-027-028` (branch only, no PR) already contains the
   three features plus this report.
4. Promote `dev → test → prod` through the existing workflow; deployment and
   npm publish remain limited to the `prod` lineage and were not performed here.

## 12. Explicit statement

Nothing in this round was merged, closed, promoted, deployed, published, or
moved on a GitHub Project board. The only repository side effects are the
three feature branches + Draft PRs, the integration branch, and this report
committed on the integration branch.
