// Frozen CSS contract for the aggregated `dist/styles.css` (FOL-020, #111).
//
// These lists are the machine-checkable part of the FOL-017 §4 ownership
// boundary: token names and their order, the five global rules, the component
// and static class rules that React and static HTML share, and the cascade
// order those families must keep after aggregation.
//
// Changing a list here is a contract change: it must be justified by a task
// that is allowed to touch the design system, not by a build refactor.

// `:root` token declarations in source order (37 tokens). Order is asserted
// exactly, so renaming, removing or reordering a token fails the gate.
export const ROOT_TOKEN_ORDER = [
  "--folio-primary",
  "--folio-primary-active",
  "--folio-primary-disabled",
  "--folio-ink",
  "--folio-body",
  "--folio-body-strong",
  "--folio-muted",
  "--folio-muted-soft",
  "--folio-hairline",
  "--folio-hairline-soft",
  "--folio-canvas",
  "--folio-surface-soft",
  "--folio-surface-card",
  "--folio-surface-dark",
  "--folio-surface-dark-elevated",
  "--folio-on-primary",
  "--folio-on-dark",
  "--folio-on-dark-soft",
  "--folio-accent-teal",
  "--folio-accent-amber",
  "--folio-success",
  "--folio-warning",
  "--folio-error",
  "--folio-font-sans",
  "--folio-font-display",
  "--folio-font-mono",
  "--folio-radius-sm",
  "--folio-radius-md",
  "--folio-radius-lg",
  "--folio-radius-xl",
  "--folio-radius-pill",
  "--folio-space-xs",
  "--folio-space-sm",
  "--folio-space-md",
  "--folio-space-lg",
  "--folio-space-xl",
  "--folio-space-2xl",
];

// `[data-folio-theme="dark"]` overrides in source order (18 tokens).
export const DARK_TOKEN_ORDER = [
  "--folio-primary",
  "--folio-primary-active",
  "--folio-primary-disabled",
  "--folio-ink",
  "--folio-body",
  "--folio-body-strong",
  "--folio-muted",
  "--folio-muted-soft",
  "--folio-hairline",
  "--folio-hairline-soft",
  "--folio-canvas",
  "--folio-surface-soft",
  "--folio-surface-card",
  "--folio-surface-dark",
  "--folio-surface-dark-elevated",
  "--folio-on-primary",
  "--folio-on-dark",
  "--folio-on-dark-soft",
];

// Representative values that pin the design tokens without duplicating the
// whole palette here. A theme change must be an explicit contract change.
export const TOKEN_SAMPLE_VALUES = {
  "--folio-primary": "#cc785c",
  "--folio-primary-active": "#a9583e",
  "--folio-ink": "#141413",
  "--folio-canvas": "#faf9f5",
  "--folio-hairline": "#e6dfd8",
  "--folio-radius-md": "8px",
  "--folio-space-lg": "24px",
};

// The five global (non-namespaced) rule groups documented in FOL-017 §4.1,
// plus the token block. `declarations` are matched inside the rule body.
export const GLOBAL_RULES = [
  {
    id: "root",
    selectors: [":root"],
    declarations: ["font-family: var(--folio-font-sans)"],
  },
  { id: "dark-theme", selectors: ['[data-folio-theme="dark"]'] },
  {
    id: "box-sizing",
    selectors: ["*"],
    declarations: ["box-sizing: border-box"],
  },
  {
    id: "body",
    selectors: ["body"],
    declarations: ["min-width: 320px"],
  },
  {
    id: "links",
    selectors: ["a"],
    declarations: ["color: inherit", "text-decoration: none"],
  },
  {
    id: "form-controls",
    selectors: ["button", "input"],
    declarations: ["font: inherit"],
  },
];

// Component and static class rules that the published stylesheet must keep.
// Families follow FOL-017 §4.2: React components and static HTML share these
// classes, so a missing block breaks both render paths.
export const REQUIRED_SELECTOR_FAMILIES = [
  {
    id: "shell",
    selectors: [
      ".folio-shell",
      ".folio-content",
      ".folio-footer",
      ".folio-button",
      ".folio-button--primary",
      ".folio-card",
      ".folio-card-grid",
      ".folio-home",
      ".folio-doc-page",
      ".folio-doc-toolbar",
      ".folio-eyebrow",
      ".folio-lede",
      ".folio-not-found",
    ],
  },
  {
    id: "header",
    selectors: [
      ".folio-header",
      ".folio-header__wrap",
      ".folio-brand",
      ".folio-desktop-nav",
      ".folio-header-actions",
      ".folio-consumer-header-actions",
      ".folio-search-trigger",
      ".folio-icon-button",
      ".folio-mobile-menu-button",
      ".folio-mobile-panel",
      ".folio-github-link",
    ],
  },
  {
    id: "markdown",
    selectors: [
      ".folio-markdown",
      ".folio-markdown pre",
      ".folio-markdown pre code.hljs",
      ".md-custom-block",
      ".md-custom-block--warning",
      ".md-custom-block--danger",
      ".md-custom-block__title",
      ".md-anchor",
      ".markdown-mermaid",
      ".markdown-mermaid-source",
    ],
  },
  {
    id: "search",
    selectors: [
      ".folio-search-overlay",
      ".folio-search-dialog",
      ".folio-search-input-wrap",
      ".folio-search-results",
      ".folio-search-empty",
      ".folio-search-footer",
    ],
  },
  {
    id: "share",
    selectors: [".folio-share-button", ".folio-mobile-doc-share"],
  },
  {
    id: "docs-shell",
    selectors: [
      ".folio-docs-runtime",
      ".folio-docs-shell",
      ".folio-docnav",
      ".folio-doc-main",
      ".folio-toc",
      ".folio-page-nav",
      ".folio-docs-mobile-bar",
      ".folio-docs-overlay",
      ".folio-docs-drawer",
      ".folio-mobile-toc",
    ],
  },
  {
    id: "static",
    selectors: [
      ".folio-prerender",
      ".folio-static-doc-menu",
      ".folio-static-doc-menu__panel",
    ],
  },
];

// Load-bearing declaration of the canonical rule for the selectors below. A
// selector can survive inside an @media override after its base rule was
// deleted, so presence alone is not enough for the representative rules:
// deleting `.folio-docs-shell { grid-template-columns: 250px ... }` must fail
// even though later @media blocks still mention the class.
export const REQUIRED_DECLARATIONS = {
  ".folio-shell": "min-height: 100vh",
  ".folio-header": "position: sticky",
  ".folio-card": "border-radius: var(--folio-radius-xl)",
  ".folio-footer": "text-align: center",
  ".folio-not-found": "text-align: center",
  ".folio-markdown": "line-height: 1.78",
  ".folio-search-overlay": "position: fixed",
  ".folio-search-dialog": "width: min(680px, 100%)",
  ".folio-docs-shell": "grid-template-columns: 250px",
  ".folio-docnav": "position: sticky",
  ".folio-doc-main": "padding: 48px 48px 96px",
  ".folio-page-nav": "display: grid",
  ".folio-prerender": "width: min(900px",
  ".folio-static-doc-menu__panel": "position: fixed",
};

// Cascade relations the aggregated file must keep. Tokens come first, then the
// component families in the order the single-file stylesheet already had, so a
// manifest reorder cannot silently change specificity/override outcomes.
export const CASCADE_ORDER = [
  [":root", '[data-folio-theme="dark"]'],
  [":root", "*"],
  [":root", ".folio-shell"],
  [":root", ".folio-header"],
  [":root", ".folio-markdown"],
  [":root", ".folio-search-overlay"],
  [":root", ".folio-docs-shell"],
  [":root", ".folio-prerender"],
  [".folio-shell", ".folio-header"],
  [".folio-header", ".folio-markdown"],
  [".folio-markdown", ".folio-search-overlay"],
  [".folio-search-overlay", ".folio-footer"],
  [".folio-footer", ".folio-docs-shell"],
];

// Representative rules that must survive into a real consumer's built CSS
// asset. Covers React-only families, shared families, and static-only classes.
export const CONSUMER_CSS_SELECTORS = [
  ".folio-header",
  ".folio-shell",
  ".folio-markdown",
  ".folio-search-overlay",
  ".folio-share-button",
  ".folio-docs-shell",
  ".folio-docnav",
  ".folio-page-nav",
  ".folio-prerender",
  ".folio-static-doc-menu",
];

// A token declaration must also reach the built CSS asset, proving the
// aggregated file (not some unrelated stylesheet) was bundled.
export const CONSUMER_CSS_TOKENS = ["--folio-primary", "--folio-canvas"];
