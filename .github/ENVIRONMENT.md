# Repository Environment Model

Folio follows the Mira Organization branch model.

```text
feat/* -> dev -> test -> prod
```

## Branch semantics

- `feat/*`: isolated change branches; CI only.
- `dev`: development integration; validation only.
- `test`: acceptance candidate; validation only.
- `prod`: production source for the official GitHub Pages site and release lineage.
- `main`: historical/import compatibility branch only; no production publication.

## Repository-specific deployment exception

This repository currently has one hosted runtime surface: the public GitHub Pages site.

There are no dedicated hosted `dev` or `test` sites. Instead:

- `dev` and `test` must pass the same repository build and package verification used before production.
- Pull requests into `dev`, `test`, and `prod` run validation.
- Only `prod` may deploy the GitHub Pages production artifact.

## npm release semantics

The canonical package is `@uichat-mira/folio`.

- Folio begins its npm version line at `0.1.0`.
- Publishing is triggered by a published GitHub Release.
- The release tag must match the package version.
- The tagged commit must be contained in `prod`.
- Publishing uses npm Trusted Publishing / GitHub OIDC after the package bootstrap is complete.
- The Trusted Publisher must target GitHub owner `uichat-mira`, repository `folio`, and workflow `publish.yml`.

The predecessor `@uichat-mira/docs` package is not published from this repository after the Folio migration.

## Brand-migration rollback anchor

The last organization-aligned pre-Folio source commit is:

```text
b75b1ebeb9800788041162436486159359b17794
```

Use that commit as the rollback anchor for the Folio brand/package migration.
