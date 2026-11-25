# My Folio site

Generated using `@uichat-mira/create-folio`. The starter uses APIs available
in the published Folio 0.1.1 package. Content lives in `content/*.md`.
Folio owns the navigation, reading layouts, appearance and static rendering.

```sh
npm install
npm run dev
npm run build
```

Before publishing, replace `siteUrl: "https://example.com"` in `folio.config.ts` and update the metadata in `index.html`.

For lists of books, projects or external articles, use the public `FolioListPage` / `FolioEntryList` API when your installed Folio version includes those exports.
