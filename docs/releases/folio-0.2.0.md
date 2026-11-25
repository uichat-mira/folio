# Folio 0.2.0

Folio 0.2.0 promotes the post-0.1.1 development line into the supported public package contract.

## Highlights

- Optional PWA entrypoints: `@uichat-mira/folio/pwa` and `@uichat-mira/folio/pwa/react`.
- RSS/Atom feeds, richer sitemap/JSON-LD metadata, explicit indexing policy, and Git-derived content dates.
- Article category/tag archives plus reusable collection/list surfaces.
- Expanded React composition: shared Header/Footer, tree navigation, TOC, page navigation, document metadata, additional slots, and composable home surfaces.
- Pearl / Editorial / Graphite appearance presets, independent code palettes, system light/dark handling, and runtime appearance preview.
- Static and React paths share the same content, navigation, appearance, and publishing contracts more consistently.

## Compatibility

This is a 0.x minor release because the public surface has materially expanded since 0.1.1. Existing 0.1.1-style basic Vite/React integrations remain supported, but consumers should run their own build/type checks when upgrading.

The separate `@uichat-mira/create-folio` initializer remains unpublished in this release; its source template now targets Folio `^0.2.0`.

## Release contract

- Promote one reviewed candidate through `feat/* -> dev -> test -> prod`.
- Tag the accepted production commit as `folio-v0.2.0`.
- Publish `@uichat-mira/folio@0.2.0` only through `.github/workflows/publish.yml` and npm Trusted Publishing / OIDC.
- The workflow must pass `npm run release:check`, validate the tag/version/prod lineage, and verify a real Registry-installed consumer after publication.
- Historical tags and npm versions remain immutable.
