import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (file) => readFileSync(join(packageRoot, "src", file), "utf8");

// Matches `from "react"` and subpath imports such as `react/jsx-runtime`.
const REACT_IMPORT = /from\s+["']react(?:\/[^"']*)?["']/;

// Core content/build modules plus the shared Core type module. None of these
// may pull React into their declaration or runtime graph.
const REACT_FREE_MODULES = [
  "types.ts",
  "heading-ids.ts",
  "content.ts",
  "docs-structure.ts",
  "search.ts",
  "config.ts",
  "markdown.ts",
  "static.ts",
  "static-output.ts",
  "vite.ts",
];

const UI_TYPE_NAMES = [
  "FolioAppProps",
  "FolioSlots",
  "FolioThemePreference",
  "FolioUiOptions",
];

const PUBLIC_TYPE_NAMES = [
  "FolioAppProps",
  "FolioConfig",
  "FolioDoc",
  "FolioDocCollection",
  "FolioDocSection",
  "FolioDocsShellProps",
  "FolioDocStructure",
  "FolioEntryType",
  "FolioHeaderProps",
  "FolioHeading",
  "FolioMarkdownProps",
  "FolioMarkdownRenderOptions",
  "FolioNavigationItem",
  "FolioShareButtonProps",
  "FolioSlots",
  "FolioThemePreference",
  "FolioUiOptions",
];

test("core and build modules stay free of React imports", () => {
  for (const file of REACT_FREE_MODULES) {
    assert.ok(!REACT_IMPORT.test(readSource(file)), `${file} must not import React`);
    assert.ok(
      !readSource(file).includes("./ui-types"),
      `${file} must not depend on the React UI type module`,
    );
  }
});

test("React-facing prop and slot types live only in ui-types.ts", () => {
  const uiTypes = readSource("ui-types.ts");
  assert.match(uiTypes, REACT_IMPORT, "ui-types.ts must import React types");
  assert.match(
    uiTypes,
    /from\s+["']\.\/types["']/,
    "ui-types.ts may depend on Core types but not the reverse",
  );

  const coreTypes = readSource("types.ts");
  for (const name of UI_TYPE_NAMES) {
    assert.match(uiTypes, new RegExp(`export type ${name}\\b`), `ui-types.ts is missing ${name}`);
    assert.ok(
      !new RegExp(`export type ${name}\\b`).test(coreTypes),
      `types.ts must not define the React-facing ${name}`,
    );
  }
});

test("the public barrel still re-exports every published type name", () => {
  const barrel = readSource("index.ts");
  for (const name of PUBLIC_TYPE_NAMES) {
    assert.ok(barrel.includes(name), `src/index.ts no longer re-exports ${name}`);
  }
  assert.match(barrel, /from\s+["']\.\/types["']/, "barrel must re-export Core types");
  assert.match(barrel, /from\s+["']\.\/ui-types["']/, "barrel must re-export UI types");
});
