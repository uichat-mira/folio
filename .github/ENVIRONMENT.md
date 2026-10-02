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

This is the repository-specific replacement for lower-environment site deployment until dedicated preview environments have a demonstrated need.

## npm release semantics

The package currently remains `@uichat-mira/docs`.

- Publishing is triggered by a published GitHub Release.
- The release tag must match the package version.
- The tagged commit must be contained in `prod`.
- Publishing uses npm Trusted Publishing / GitHub OIDC.
- The npm Trusted Publisher must be configured for `uichat-mira/folio` and the current publish workflow before the next real release.

A future rename to a Folio npm package is a separate product/package migration and must not be mixed into ordinary repository governance work.

## Migration / rollback anchor

Organization alignment starts from imported source commit:

```text
6ea6dd4023ed3fad32f1eb309ce7a4e75c1cbdb4
```

That commit corresponds to the MiraDocs `0.1.1` source state and remains the first-round rollback anchor while the new Organization branch model is being established.
