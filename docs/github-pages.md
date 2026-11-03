# GitHub Pages deployment

The official Folio site is deployed by `.github/workflows/pages.yml`.

The Vite base path is derived from `GITHUB_REPOSITORY`:

- project repository: `/<repository-name>/`
- `<owner>.github.io`: `/`
- local development: `/`

During production builds, the Folio Vite plugin also emits route-level `index.html` files, `404.html`, `sitemap.xml`, and `robots.txt`.

The Pages build checks out full Git history (`fetch-depth: 0`) so content dates can use a file's first commit as `publishedAt`. A shallow clone cannot prove a first commit, so that field is left unset there. Other CI jobs keep the default shallow checkout; see the content-date contract in [`consumer-contract.md`](consumer-contract.md).

Only the `prod` branch may deploy the production Pages artifact.
