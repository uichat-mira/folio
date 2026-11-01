// FOL-031 (Issue #130) layer gate: Folio's internal layers are one-way.
//
//   Core   src/core/** plus the Core-owning root modules
//          -> Core only (no React, no DOM globals, no UI, no Build)
//   Build  src/build/** plus src/static*.ts and the /vite entry
//          -> Core and Build (no React UI packages, no UI components)
//   UI     the React components and the React-facing type module
//          -> Core and UI (may depend on Core)
//   entry  src/index.ts, the public barrel -> any layer
//
// The gate reads the ACTUAL relative import/re-export edges from the source
// files and classifies both ends, so a real reverse dependency (for example a
// Core module importing a UI component) fails it. A directory merely existing
// proves nothing here. Package imports are checked too, because a Core module
// importing `react` is the same boundary violation in a form no relative edge
// would reveal.
//
// Two entry points share one implementation:
//
//   node scripts/dependency-layers.mjs               # gate the real src tree
//   node scripts/dependency-layers.mjs --self-test   # prove the detector
//                                                    # rejects synthetic
//                                                    # reverse dependencies
//
// `test/dependency-layers.test.mjs` runs both the real tree and the synthetic
// scenarios, so `npm test` (and therefore `release:check`) enforces the gate.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(scriptDir, "..");
export const defaultSourceRoot = join(packageRoot, "src");

// Root modules that still own their layer without living in a layer directory.
// A module must be classified explicitly: an unclassified source file fails the
// gate instead of silently escaping it.
export const CORE_ROOT_MODULES = ["types.ts", "search.ts", "config.ts", "markdown.ts"];
export const BUILD_ROOT_MODULES = ["static.ts", "static-output.ts", "vite.ts"];
export const UI_ROOT_MODULES = [
  "app.tsx",
  "docs-shell.tsx",
  "header.tsx",
  "icons.tsx",
  "share.tsx",
  "markdown-react.tsx",
  "ui-types.ts",
];
export const ENTRY_MODULES = ["index.ts"];

// Which layers each layer may depend on. Core has no upward edge at all; UI and
// Build are siblings that never import each other.
export const ALLOWED_DEPENDENCIES = {
  core: ["core"],
  build: ["core", "build"],
  ui: ["core", "ui"],
  entry: ["core", "build", "ui"],
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

const REACT_PACKAGES = [/^react$/, /^react\//, /^react-dom$/, /^react-dom\//, /^react-router-dom$/, /^react-router-dom\//];
// The Vite build framework is Build-layer tooling; Core must not import it.
const BUILD_TOOL_PACKAGES = [/^vite$/, /^vite\//];
// DOM globals used as values. Comments and strings are masked before matching,
// so this only sees real code.
const DOM_GLOBAL_USAGE = /\b(?:document|window|localStorage|sessionStorage|navigator)\s*[.(]/;

function toPosix(path) {
  return path.replace(/\\/g, "/");
}

/**
 * Layer of one source module (path relative to src/, POSIX separators).
 * Returns undefined when the module is not classified.
 */
export function layerOf(relativePath) {
  const path = toPosix(relativePath);
  if (ENTRY_MODULES.includes(path)) return "entry";
  if (path.startsWith("core/")) return "core";
  if (path.startsWith("build/")) return "build";
  if (CORE_ROOT_MODULES.includes(path)) return "core";
  if (BUILD_ROOT_MODULES.includes(path)) return "build";
  if (UI_ROOT_MODULES.includes(path)) return "ui";
  return undefined;
}

/**
 * List every TypeScript source module under src/, excluding .d.ts declarations
 * (they carry no runtime edge and the virtual-module declaration imports the
 * package by name).
 */
export function listSourceModules(sourceRoot) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      files.push(toPosix(relative(sourceRoot, path)));
    }
  };
  walk(sourceRoot);
  return files.sort();
}

/**
 * Replace comments with spaces while keeping string literals intact, so a
 * commented-out import cannot satisfy the gate and a URL in a string cannot
 * swallow the rest of a line.
 */
function maskComments(source) {
  let output = "";
  let index = 0;
  let quote;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote !== undefined) {
      output += char;
      if (char === "\\") {
        output += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = undefined;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        output += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < source.length) {
        output += "  ";
        index += 2;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    output += char;
    index += 1;
  }
  return output;
}

const FROM_CLAUSE = /\b(import|export)\b[\s\S]{0,400}?\bfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Every module specifier this source file imports or re-exports. */
export function extractSpecifiers(source) {
  const code = maskComments(source);
  const specifiers = new Map();
  const add = (specifier, kind) => {
    if (!specifiers.has(specifier)) specifiers.set(specifier, kind);
  };
  for (const match of code.matchAll(FROM_CLAUSE)) add(match[2], match[1] === "export" ? "export" : "import");
  for (const match of code.matchAll(SIDE_EFFECT_IMPORT)) add(match[1], "import");
  for (const match of code.matchAll(DYNAMIC_IMPORT)) add(match[1], "dynamic-import");
  return [...specifiers].map(([specifier, kind]) => ({ specifier, kind }));
}

function resolveRelativeModule(fromFile, specifier, sourceRoot) {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(sourceRoot, dirname(fromFile), specifier);
  const candidates = [base];
  for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}${extension}`);
  for (const extension of SOURCE_EXTENSIONS) candidates.push(join(base, `index${extension}`));
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return toPosix(relative(sourceRoot, candidate));
    }
  }
  return undefined;
}

function matchesAny(specifier, patterns) {
  return patterns.some((pattern) => pattern.test(specifier));
}

/**
 * Scan one source tree and report its layer graph, violations and any module
 * the layer map does not classify.
 *
 * @param {{ sourceRoot?: string }} [options]
 */
export function detectLayerViolations({ sourceRoot = defaultSourceRoot } = {}) {
  const files = listSourceModules(sourceRoot);
  const modules = files.map((file) => ({ file, layer: layerOf(file) }));
  const unclassified = modules.filter((module) => module.layer === undefined).map((module) => module.file);
  const edges = [];
  const violations = [];
  const unresolved = [];

  const fail = (id, from, message) => violations.push({ id, from, message });

  for (const module of modules) {
    if (module.layer === undefined) {
      fail(
        "unclassified",
        module.file,
        `${module.file} is not assigned to a layer; add it to CORE_ROOT_MODULES, BUILD_ROOT_MODULES, UI_ROOT_MODULES or move it into a layer directory in scripts/dependency-layers.mjs`,
      );
      continue;
    }

    const source = readFileSync(join(sourceRoot, module.file), "utf8");
    const code = maskComments(source);

    if (module.layer === "core" && DOM_GLOBAL_USAGE.test(code)) {
      fail(
        "core:dom",
        module.file,
        `${module.file} is Core but uses a DOM global; Core must stay free of the DOM`,
      );
    }

    for (const { specifier, kind } of extractSpecifiers(source)) {
      if (!specifier.startsWith(".")) {
        if (module.layer === "core" && matchesAny(specifier, REACT_PACKAGES)) {
          fail("core:react", module.file, `${module.file} is Core but imports ${JSON.stringify(specifier)}`);
        }
        if (module.layer === "core" && matchesAny(specifier, BUILD_TOOL_PACKAGES)) {
          fail("core:build", module.file, `${module.file} is Core but imports the Build tooling ${JSON.stringify(specifier)}`);
        }
        if (module.layer === "build" && matchesAny(specifier, REACT_PACKAGES)) {
          fail("build:react", module.file, `${module.file} is Build but imports the React UI package ${JSON.stringify(specifier)}`);
        }
        continue;
      }

      const target = resolveRelativeModule(module.file, specifier, sourceRoot);
      if (target === undefined) {
        unresolved.push({ from: module.file, specifier, kind });
        continue;
      }
      const targetLayer = layerOf(target);
      edges.push({ from: module.file, fromLayer: module.layer, specifier, kind, to: target, toLayer: targetLayer });

      if (targetLayer === undefined) continue; // already reported as unclassified
      if (ALLOWED_DEPENDENCIES[module.layer].includes(targetLayer)) continue;
      const id = `${module.layer}:${targetLayer}`;
      const rule = targetLayer === "ui" ? "UI component" : targetLayer === "build" ? "Build module" : "module";
      fail(
        id,
        module.file,
        `${module.file} is ${module.layer} but ${kind === "export" ? "re-exports" : "imports"} the ${rule} ${target} (${JSON.stringify(specifier)}); ${module.layer} may only depend on ${ALLOWED_DEPENDENCIES[module.layer].join("/")}`,
      );
    }
  }

  return { sourceRoot, modules, edges, violations, unresolved, unclassified };
}

// --- controlled negative scenarios (synthetic input, committed evidence) -----

const SYNTHETIC_SCENARIOS = [
  {
    id: "core-imports-ui-component",
    files: {
      "core/content.ts": 'import { FolioHeader } from "../header";\n',
      "header.tsx": "export const FolioHeader = 1;\n",
    },
    expect: ["core:ui"],
    what: "a Core module importing a UI component",
  },
  {
    id: "core-re-exports-ui-type",
    files: {
      "core/content.ts": 'export type { FolioHeaderProps } from "../header";\n',
      "header.tsx": "export type FolioHeaderProps = { a: 1 };\n",
    },
    expect: ["core:ui"],
    what: "a Core module re-exporting a UI type (type-only edge)",
  },
  {
    id: "core-imports-build-module",
    files: {
      "core/content.ts": 'import { writeFolioStaticSite } from "../static";\n',
      "static.ts": "export const writeFolioStaticSite = 1;\n",
    },
    expect: ["core:build"],
    what: "a Core module importing the Build layer",
  },
  {
    id: "core-imports-react",
    files: {
      "core/content.ts": 'import type { ReactNode } from "react";\n',
    },
    expect: ["core:react"],
    what: "a Core module importing React",
  },
  {
    id: "core-imports-build-tooling",
    files: {
      "core/content.ts": 'import type { Plugin } from "vite";\n',
    },
    expect: ["core:build"],
    what: "a Core module importing the Vite build tooling",
  },
  {
    id: "core-uses-dom-global",
    files: {
      "core/content.ts": "export const title = document.title;\n",
    },
    expect: ["core:dom"],
    what: "a Core module touching the DOM",
  },
  {
    id: "build-imports-ui-component",
    files: {
      "build/vite-adapter.ts": 'import { FolioApp } from "../app";\n',
      "app.tsx": "export const FolioApp = 1;\n",
    },
    expect: ["build:ui"],
    what: "the Vite adapter importing a UI component",
  },
  {
    id: "build-imports-react",
    files: {
      "build/vite-adapter.ts": 'import { createRoot } from "react-dom/client";\n',
    },
    expect: ["build:react"],
    what: "a Build module importing React DOM",
  },
  {
    id: "unclassified-source-module",
    files: {
      "new-root-module.ts": "export const value = 1;\n",
    },
    expect: ["unclassified"],
    what: "a source module outside the layer map",
  },
  {
    id: "allowed-one-way-edges",
    files: {
      "core/content.ts": "export const value = 1;\n",
      "static.ts": 'import { value } from "./core/content";\nexport const build = value;\n',
      "app.tsx": 'import { value } from "./core/content";\nexport const app = value;\n',
      "ui-types.ts": 'import type { value } from "./core/content";\nexport type Value = typeof value;\n',
      "index.ts": 'export { value } from "./core/content";\n',
    },
    expect: [],
    what: "Build/UI/entry depending on Core (the allowed direction)",
  },
];

/**
 * Run the detector against synthetic trees: every scenario must produce exactly
 * the expected violation ids, so a detector that never fires (or that fires on
 * the allowed direction) is caught here instead of silently passing the real
 * tree.
 */
export function runLayerSelfTest() {
  const results = [];
  for (const scenario of SYNTHETIC_SCENARIOS) {
    const root = mkdtempSync(join(tmpdir(), "folio-layers-selftest-"));
    try {
      for (const [file, content] of Object.entries(scenario.files)) {
        const path = join(root, ...file.split("/"));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
      const report = detectLayerViolations({ sourceRoot: root });
      const actual = [...new Set(report.violations.map((violation) => violation.id))].sort();
      const expected = [...new Set(scenario.expect)].sort();
      results.push({
        id: scenario.id,
        what: scenario.what,
        expected,
        actual,
        ok: JSON.stringify(actual) === JSON.stringify(expected),
        messages: report.violations.map((violation) => violation.message),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return { results, ok: results.every((result) => result.ok) };
}

function printViolations(report) {
  for (const violation of report.violations) {
    console.error(`[${violation.id}] FAIL ${violation.message}`);
  }
}

function main(argv) {
  if (argv.includes("--self-test")) {
    const { results, ok } = runLayerSelfTest();
    for (const result of results) {
      if (result.ok) {
        console.log(`[selftest] ok  ${result.id}: ${result.what} -> ${result.actual.join(", ") || "no violation"}`);
      } else {
        console.error(
          `[selftest] FAIL ${result.id}: expected ${result.expected.join(", ") || "no violation"} after ${result.what}, got ${result.actual.join(", ") || "no violation"}`,
        );
        for (const message of result.messages) console.error(`           ${message}`);
      }
    }
    if (!ok) {
      console.error(`\nlayer self-test failed: ${results.filter((result) => !result.ok).length}/${results.length} controlled case(s) were not detected as expected`);
      return 1;
    }
    console.log(`\nlayer self-test passed: ${results.length}/${results.length} controlled cases behaved as expected`);
    return 0;
  }

  const report = detectLayerViolations({});
  if (report.violations.length > 0) {
    printViolations(report);
    console.error(`\nlayer gate failed with ${report.violations.length} violation(s) in ${report.sourceRoot}`);
    return 1;
  }
  const summary = Object.entries(
    report.modules.reduce((counts, module) => {
      counts[module.layer] = (counts[module.layer] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .map(([layer, count]) => `${count} ${layer}`)
    .join(", ");
  console.log(
    `[layers] ok  ${report.modules.length} modules (${summary}), ${report.edges.length} relative edges, ${report.unresolved.length} non-module specifier(s) ignored`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
