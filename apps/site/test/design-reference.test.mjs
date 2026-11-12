import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const model = read("src/design-reference-tokens.ts");
const ui = read("src/DesignReferenceEnhancement.tsx");
const css = read("src/design-reference.css");
const main = read("src/main.tsx");
const principles = read("content/reference/design/principles.md");
const tokens = read("content/reference/design/tokens.md");
const overview = read("content/reference/overview.md");
const publicCss = read("../../packages/folio/src/styles.css");

const transpiled = ts.transpileModule(model, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal(transpiled.diagnostics?.length ?? 0, 0);
const context = { exports: {} };
vm.runInNewContext(transpiled.outputText, context);
const { designTokenKind, collectFolioTokens } = context.exports;

test("design reference enumerates computed Folio tokens, not a copied palette", () => {
  const data = {
    "--folio-ink": "#fefefe", "--folio-code-bg": "#151515",
    "--folio-font-display": "Some Font", "--folio-space-md": "16px",
    "--site-primary": "#aaa", "--folio-empty": " ",
  };
  const keys = Object.keys(data);
  const computed = {
    length: keys.length,
    item(index) { return keys[index]; },
    getPropertyValue(name) { return data[name] || ""; },
  };
  const items = collectFolioTokens(computed);
  assert.deepEqual(Array.from(items.map((entry) => entry.name)), [
    "--folio-code-bg", "--folio-font-display", "--folio-ink", "--folio-space-md",
  ]);
  assert.equal(items.find((entry) => entry.name === "--folio-ink").value, "#fefefe");
  assert.equal(designTokenKind("--folio-code-bg"), "code");
  assert.equal(designTokenKind("--folio-syntax-string"), "code");
  assert.equal(designTokenKind("--folio-font-sans"), "type");
  assert.equal(designTokenKind("--folio-space-md"), "scale");
  assert.equal(designTokenKind("--folio-reading-frame-width"), "scale");
  assert.equal(designTokenKind("--folio-primary"), "semantic");
});

test("both articles belong in Reference / Design with static fallback", () => {
  for (const source of [principles, tokens]) {
    assert.match(source, /collection: 参考\nsection: 设计/);
    assert.match(source, /type: doc/);
    assert.match(source, /npm[\s\S]*?0\.1\.1/);
    assert.doesNotMatch(source, /<script\b/i);
    assert.doesNotMatch(source, /#[a-f\d]{3,8}\b/i);
    assert.match(source, /class="design-ref-fallback"/);
    assert.match(source, /<details>/);
  }
  assert.match(principles, /id="design-ref-theme-slot"/);
  assert.match(tokens, /id="design-ref-tokens-slot"/);
  assert.match(overview, /\/reference\/design\/principles/);
  assert.match(overview, /\/reference\/design\/tokens/);
});

test("named design tokens exist in Folio's current stylesheet", () => {
  for (const source of [principles, tokens]) {
    for (const match of source.matchAll(/--folio-[a-z][a-z-]*/g)) {
      // Wildcard family prefixes are documentation, not standalone variables.
      if (match[0].endsWith("-")) continue;
      assert.ok(publicCss.includes(match[0] + ":"), "Unknown token: " + match[0]);
    }
  }
});

test("embedded lab uses actual public Folio APIs, not a second state machine", () => {
  for (const name of ["useFolioAppearance", "FolioHome", "FolioMarkdown", "resolveFolioCodePalette"])
    assert.ok(ui.includes(name), "Missing API " + name);
  assert.match(ui, /createPortal\(/);
  assert.match(ui, /useLocation\(\)/);
  assert.match(ui, /resetPreview\(\)/);
  assert.match(ui, /<FolioHome config=\{config\} docs=\{docs\} template=\{template\} as="div"/);
  assert.match(ui, /collectFolioTokens\(getComputedStyle\(root\)\)/);
  assert.match(ui, /MutationObserver/);
  assert.doesNotMatch(ui, /\.dataset\.folio(?:Theme|Preset|CodePalette)\s*=/);
  assert.doesNotMatch(ui, /localStorage\.(?:setItem|removeItem|getItem)\(/);
  assert.match(main, /<DesignReferenceEnhancement docs=\{content\} \/>/);
});

test("document visuals consume public variables without fixed color copies", () => {
  assert.doesNotMatch(css, /#[a-f\d]{3,8}\b/i);
  assert.match(css, /var\(--folio-canvas\)/);
  assert.match(css, /var\(--folio-primary\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /:has\(> \.design-ref-interactive\)/);
});
