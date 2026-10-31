// This consumer deliberately imports no Folio package entrypoint. It checks
// virtual-only TypeScript programs using package type registration (not a
// project-local ambient module declaration or an alias to workspace source).
import docs, { roots } from "virtual:folio/content";

export const virtualOnlyEvidence = { count: docs.length, roots: roots.join(",") };
