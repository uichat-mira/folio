# Architecture

Folio separates three concerns:

1. **Runtime** — parses and renders content.
2. **Product repository** — stores Markdown, configuration, and project data.
3. **Mira Skill** — interprets user intent and uses GitHub tools to operate the stable contract.

The runtime must not contain product-specific author identities or workflow rules. Those belong to the consuming site or the canonical Organization Skill.

## Dogfood rule

The official site in this repository uses `@uichat-mira/folio`. The existing UIChat Mira website is the first downstream migration target and should consume the same public package contract rather than repository internals.
