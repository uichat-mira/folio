# GitHub Pages deployment

The official Folio site is deployed by `.github/workflows/pages.yml`.

The Vite base path is derived from `GITHUB_REPOSITORY`:

- project repository: `/<repository-name>/`
- `<owner>.github.io`: `/`
- local development: `/`

During production builds, the Folio Vite plugin also emits route-level `index.html` files, `404.html`, `sitemap.xml`, and `robots.txt`.

When a collection opts into Article archives (`collections[].archive`), the
same static build emits `<collection>/category/<slug>/index.html` and
`<collection>/tag/<slug>/index.html`. These pages inherit the Vite `base`, so
they work at `/` and under the GitHub Pages `/folio/` project path, and they are
listed in the same `sitemap.xml`. A preview build using
`siteIndexing: "noindex"` marks them `noindex,nofollow` like every other default
page. The official site exercises this under the `/blogs` collection; the
behavior is not hardcoded to `/blogs`.

A Pages deployment that is only a public preview should say so explicitly with `siteIndexing: "noindex"` in its static build options; see [`static-build.md`](static-build.md#site-level-indexing-policy-preview-builds). The deploy workflow is unchanged, and Folio never infers preview status from the `github.io` hostname or the deployment base path.

The Pages build checks out full Git history (`fetch-depth: 0`) so content dates can use a file's first commit as `publishedAt`. A shallow clone cannot prove a first commit, so that field is left unset there. Other CI jobs keep the default shallow checkout; see the content-date contract in [`consumer-contract.md`](consumer-contract.md).

Only the `prod` branch may deploy the production Pages artifact.
