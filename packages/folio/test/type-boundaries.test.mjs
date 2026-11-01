import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src");
const readSource = (file) => readFileSync(join(sourceRoot, file), "utf8");

// Matches `from "react"` and subpath imports such as `react/jsx-runtime`.
const REACT_IMPORT = /from\s+["']react(?:\/[^"']*)?["']/;
// Matches any relative import of the React UI type module.
const UI_TYPES_IMPORT = /from\s+["'](?:\.\.?\/)+ui-types["']/;

// FOL-024 (B2a) moved content parsing, heading ID allocation and document
// structure into src/core. FOL-032 (B2c) moved search and configuration there
// too. src/core owns the pure logic without React or UI imports, and no
// compatibility copy may remain at the old src/ root paths.
const CORE_CONTENT_MODULES = [
  "core/content.ts",
  "core/docs-structure.ts",
  "core/heading-ids.ts",
  "core/search.ts",
  "core/config.ts",
];

// Core content/build modules outside src/core plus the shared Core type module.
// None of these may pull React into their declaration or runtime graph.
// src/core/*.ts is scanned separately below.
const REACT_FREE_MODULES = [
  "types.ts",
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

test("core modules live only in src/core", () => {
  for (const file of CORE_CONTENT_MODULES) {
    assert.ok(existsSync(join(sourceRoot, file)), `${file} is missing from src/core`);
    const legacy = file.replace(/^core\//, "");
    assert.ok(
      !existsSync(join(sourceRoot, legacy)),
      `src/${legacy} must not remain as a compatibility module`,
    );
  }
});

test("core and build modules stay free of React imports", () => {
  const coreModules = readdirSync(join(sourceRoot, "core"))
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .map((file) => `core/${file}`);

  for (const file of [...REACT_FREE_MODULES, ...coreModules]) {
    const source = readSource(file);
    assert.ok(!REACT_IMPORT.test(source), `${file} must not import React`);
    assert.ok(
      !UI_TYPES_IMPORT.test(source),
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
  assert.match(
    barrel,
    /from\s+["']\.\/core\/content["']/,
    "barrel must re-export content from src/core",
  );
  assert.match(
    barrel,
    /from\s+["']\.\/core\/docs-structure["']/,
    "barrel must re-export document structure from src/core",
  );
  assert.match(
    barrel,
    /from\s+["']\.\/core\/search["']/,
    "barrel must re-export search from src/core",
  );
  assert.match(
    barrel,
    /from\s+["']\.\/core\/config["']/,
    "barrel must re-export configuration from src/core",
  );
  // The moved modules must be consumed from src/core only; a stale root import
  // would keep a second implementation path alive.
  for (const legacy of ["search", "config"]) {
    assert.doesNotMatch(
      barrel,
      new RegExp(`from\\s+["']\\./${legacy}["']`),
      `barrel must not import ${legacy} from the src root`,
    );
  }
});
