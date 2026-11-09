# Architecture

Folio separates three concerns:

1. **Runtime** — parses and renders content.
2. **Product repository** — stores Markdown, configuration, and project data.
3. **Mira Skill** — interprets user intent and uses GitHub tools to operate the stable contract.

The runtime must not contain product-specific author identities or workflow rules. Those belong to the consuming site or the canonical Organization Skill.

## Dogfood rule

The official site in this repository uses `@uichat-mira/folio`. The existing UIChat Mira website is the first downstream migration target and should consume the same public package contract rather than repository internals.

## Article category and tag archives (FOL-040)

Article archives are a pure, caller-driven Core contract, not a content type,
routing layer or second content database.

- `category` is one optional string per document (`FolioDoc.category`); `tags`
  remain zero or more strings. Neither changes `collection`, `group`, `section`,
  Article URLs, search or collection recursion. A category is an archive
  dimension only: no columns, trees, inheritance, CMS or per-category routes.
- `buildFolioArticleArchiveIndex(docs, config?)` is React/DOM-free and ignores
  every document whose `type` is not `article`. It returns `categories`, `tags`,
  `uncategorized` and `untagged`; group `docs` are the original complete
  `FolioDoc` objects. Nothing is re-parsed or persisted. `config` accepts the
  same `true` / `false` / object shape as the collection option below.
- Frontmatter validity: only a non-empty string is a category. An empty or
  whitespace-only value means uncategorized; arrays, objects, numbers and
  booleans are invalid shapes and also resolve to uncategorized instead of
  being guessed. Tags keep the existing string-array and `|`/`,` split parsing.
- Identity normalization for category and tag labels: NFC, trim, collapse
  whitespace, lowercase. `Frontend` and `frontend` are therefore one archive.
  Category identity comes from the frontmatter value, never from a configured
  display name.
- The category/tag `id` is that normalized identity. The group `title` is a
  display label: for categories it is the opt-in
  `FolioCollectionConfig.archive.categoryLabels` override keyed by id (or any
  spelling that normalizes to it), falling back to the spelling from the first
  article in Article order. Empty overrides fall back too. Tags always use the
  first source spelling in Article order.
- The `slug` is `slugify(id)`: Chinese is preserved, ASCII is lowercased and
  punctuation is stripped, so consumers must `encodeURIComponent` it when
  building a URL segment. Two distinct ids that produce the same slug
  (`C++` / `C#`) throw, as does an id with no URL-safe character; different
  labels never silently share one archive URL. Conflicting display overrides
  and two categories resolving to the same display label also throw.
- Articles inside one group use the existing Article ordering
  (`compareFolioDocs`: date descending with missing dates last, then `order`)
  with a stable `path` tie-break. Groups are ordered by `slug` in Unicode
  code-point order, so the result does not depend on the caller's array order
  or on display-name configuration. Archives span the supplied documents, so
  Articles from several collections can share one category/tag archive.
- `archive?: boolean | FolioArticleArchiveConfig` on `FolioCollectionConfig`
  opts a collection into archive pages; Core renders nothing. `true` uses
  source labels and the object form adds `categoryLabels`. The Build/UI layers
  own archive routes and presentation.
