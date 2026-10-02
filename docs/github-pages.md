# GitHub Pages deployment

The official Folio site is deployed by `.github/workflows/pages.yml`.

The Vite base path is derived from `GITHUB_REPOSITORY`:

- project repository: `/<repository-name>/`
- `<owner>.github.io`: `/`
- local development: `/`

During production builds, the Folio Vite plugin also emits route-level `index.html` files, `404.html`, `sitemap.xml`, and `robots.txt`.

Only the `prod` branch may deploy the production Pages artifact.
