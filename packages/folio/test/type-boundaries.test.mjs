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

// FOL-024 (B2a): content parsing, heading ID allocation and document structure
// live together in src/core and own the pure logic without React or UI imports.
const CORE_CONTENT_MODULES = [
  "core/content.ts",
  "core/docs-structure.ts",
  "core/heading-ids.ts",
  "core/search.ts",
  "core/config.ts",
  "core/home.ts",
];

// Core content/build modules outside src/core plus the shared Core type module.
// None of these may pull React into their declaration or runtime graph.
// Markdown rendering left this list in FOL-029 (B2b) because it now lives in
// src/core and is covered by the core/*.ts scan below.
const REACT_FREE_MODULES = [
  "types.ts",
  "static.ts",
  "static-output.ts",
  "vite.ts",
  "build/vite-adapter.ts",
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
  "FolioHomeConfig",
  "FolioHomeModel",
  "FolioHomeSectionConfig",
  "FolioHomeSectionType",
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

test("markdown rendering lives only in src/core and the barrel consumes it there", () => {
  assert.ok(
    existsSync(join(sourceRoot, "core/markdown.ts")),
    "core/markdown.ts is missing from src/core",
  );
  assert.ok(
    !existsSync(join(sourceRoot, "markdown.ts")),
    "src/markdown.ts must not remain as a compatibility module",
  );

  const barrel = readSource("index.ts");
  assert.match(
    barrel,
    /from\s+["']\.\/core\/markdown["']/,
    "barrel must re-export Markdown rendering from src/core",
  );
  assert.doesNotMatch(
    barrel,
    /from\s+["']\.\/markdown["']/,
    "barrel must not import Markdown rendering from the legacy root module",
  );

  // React and static rendering must consume the single Core implementation.
  for (const consumer of ["markdown-react.tsx", "static.ts"]) {
    assert.match(
      readSource(consumer),
      /from\s+["']\.\/core\/markdown["']/,
      `${consumer} must import Markdown rendering from src/core`,
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
  for (const legacy of ["search", "config"]) {
    assert.doesNotMatch(
      barrel,
      new RegExp(`from\\s+["']\\./${legacy}["']`),
      `barrel must not import ${legacy} from src root`,
    );
  }
});

// FOL-031 (B8): the Vite integration has exactly one implementation, in the
// Build/Adapter layer. src/vite.ts stays the tsup `/vite` input and only
// re-exports it, so the tested adapter and the published entry cannot drift.
test("the Vite adapter implementation lives only in src/build/vite-adapter.ts", () => {
  const adapter = readSource("build/vite-adapter.ts");
  assert.match(adapter, /export function folio\(/, "the adapter must own the plugin factory");
  assert.match(adapter, /function readManifest\(/, "the adapter must own the manifest reader");
  assert.match(adapter, /writeBundle\(\)/, "the adapter must own the writeBundle stage");
  assert.match(adapter, /"virtual:folio\/content"/, "the adapter must own the virtual module id");
  assert.match(adapter, /from\s+["']\.\.\/core\/content["']/, "the adapter must import Core content");
  assert.match(adapter, /from\s+["']\.\.\/static["']/, "the adapter must import the static builder");

  const entry = readSource("vite.ts");
  assert.match(
    entry,
    /from\s+["']\.\/build\/vite-adapter["']/,
    "src/vite.ts must re-export the adapter module",
  );
  for (const forbidden of [
    "node:fs",
    "node:path",
    "readManifest",
    "writeBundle",
    "export function folio",
    "virtual:folio/content",
  ]) {
    assert.ok(
      !entry.includes(forbidden),
      `src/vite.ts must stay a thin re-export of the adapter; found ${forbidden}`,
    );
  }

  const sourceFiles = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        sourceFiles.push(path.slice(sourceRoot.length + 1).replace(/\\/g, "/"));
      }
    }
  };
  walk(sourceRoot);

  const duplicateImplementations = sourceFiles.filter((file) => {
    if (file === "build/vite-adapter.ts") return false;
    const source = readSource(file);
    return (
      /function readManifest\(/.test(source) ||
      /writeBundle\s*\(/.test(source) ||
      /export function folio\(/.test(source)
    );
  });
  assert.deepEqual(
    duplicateImplementations,
    [],
    "the Vite adapter must not be re-implemented in another module",
  );

  // The tsup inputs and the /vite export contract are what keep the moved
  // implementation publicly identical.
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.match(
    manifest.scripts.build,
    /tsup src\/index\.ts src\/vite\.ts\b/,
    "the tsup build inputs must stay src/index.ts + src/vite.ts",
  );
  assert.deepEqual(manifest.exports["./vite"], {
    types: "./dist/vite.d.ts",
    import: "./dist/vite.js",
    default: "./dist/vite.js",
  });
});
