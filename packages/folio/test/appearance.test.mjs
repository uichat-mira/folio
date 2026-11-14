import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  resolveFolioAppearance,
  resolveFolioCodePalette,
} from "../dist/index.js";
import { renderFolioStaticHtml } from "../dist/vite.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(packageRoot, "dist/styles.css"), "utf8");
const htmlTemplate = '<!doctype html><html lang="zh"><head><title>Test</title></head><body><div id="root"></div></body></html>';
const route = { path: "/", title: "Docs", description: "Intro", body: "<main>Content</main>" };
function context(appearance) {
  return {
    config: { title: "Docs", description: "Fixture", ...(appearance ? { appearance } : {}) },
    docs: [], roots: [], base: "/", outDir: "/tmp/folio-appearance",
  };
}

function html(appearance, template = htmlTemplate) {
  return renderFolioStaticHtml(template, route, context(appearance));
}

test("visual preset, scheme and code palette have independent defaults", () => {
  assert.deepEqual(resolveFolioAppearance({}), {
    preset: "pearl", scheme: "system", codePalette: "auto",
  });
  assert.deepEqual(resolveFolioAppearance({ appearance: {
    preset: "graphite", scheme: "light", codePalette: "xuanmo",
  } }), { preset: "graphite", scheme: "light", codePalette: "xuanmo" });
  assert.equal(resolveFolioCodePalette("auto", "light"), "xuanzhi");
  assert.equal(resolveFolioCodePalette("auto", "light", "pearl"), "porcelain");
  assert.equal(resolveFolioCodePalette("auto", "light", "editorial"), "xuanzhi");
  assert.equal(resolveFolioCodePalette("auto", "dark", "pearl"), "xuanmo");
  assert.equal(resolveFolioCodePalette("porcelain", "dark", "graphite"), "porcelain");
  assert.equal(resolveFolioCodePalette("auto", "dark"), "xuanmo");
  assert.equal(resolveFolioCodePalette("xuanmo", "light"), "xuanmo");
  assert.equal(resolveFolioCodePalette("xuanzhi", "dark"), "xuanzhi");
  assert.deepEqual(resolveFolioAppearance({ appearance: {codePalette:"porcelain"} }).codePalette, "porcelain");
});

test("invalid appearance values fail clearly instead of silently selecting another theme", () => {
  assert.throws(() => resolveFolioAppearance({ appearance: { preset: "unknown" } }), /appearance\.preset/);
  assert.throws(() => resolveFolioAppearance({ appearance: { scheme: "graphite" } }), /appearance\.scheme/);
  assert.throws(() => resolveFolioAppearance({ appearance: { codePalette: "dark" } }), /appearance\.codePalette/);
});

test("static output expresses all three independent appearance choices", () => {
  const defaults = html();
  assert.match(defaults, /<html lang="zh" data-folio-preset="pearl" data-folio-code-palette="auto">/);
  assert.doesNotMatch(defaults, /data-folio-theme=/, "system leaves media preference to CSS");
  const explicit = html({ preset: "graphite", scheme: "dark", codePalette: "xuanzhi" });
  assert.match(explicit, /<html lang="zh" data-folio-preset="graphite" data-folio-code-palette="xuanzhi" data-folio-theme="dark">/);
  assert.match(explicit, /<div id="root"><main>Content<\/main><\/div>/);
});

test("static appearance overrides old markers without duplicate HTML attributes", () => {
  const existing = htmlTemplate.replace('<html lang="zh">', '<html lang="zh" data-folio-theme="light" data-folio-preset="editorial" data-folio-code-palette="xuanmo">');
  const result = html({ preset: "graphite", scheme: "system", codePalette: "auto" }, existing);
  assert.equal((result.match(/data-folio-preset=/g) ?? []).length, 1);
  assert.equal((result.match(/data-folio-code-palette=/g) ?? []).length, 1);
  assert.doesNotMatch(result, /data-folio-theme=/);
  assert.match(result, /data-folio-preset="graphite"/);
});

function declaration(rule, property) {
  const match = rule.match(new RegExp('(?:^|\\n)\\s*--folio-' + property + ':\\s*([^;]+);'));
  assert.ok(match, 'missing --folio-' + property);
  return match[1].trim();
}
function ruleBody(marker) {
  const position = css.indexOf(marker);
  assert.ok(position >= 0, 'missing preset rule ' + marker);
  return css.slice(position + marker.length).split('}')[0];
}
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
  const linear = channels.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("selection is a separate public interaction token with a Pearl light/dark pair", () => {
  const root = ruleBody(":root {");
  const pearl = ruleBody(':root:where(:not([data-folio-preset]), [data-folio-preset="pearl"]) {');
  const dark = ruleBody(':root:where([data-folio-theme="dark"]):where(:not([data-folio-preset]), [data-folio-preset="pearl"]) {');
  const systemDark = ruleBody(':root:where(:not([data-folio-theme])):where(:not([data-folio-preset]), [data-folio-preset="pearl"]) {');
  assert.equal(declaration(root, "selection-bg"), "color-mix(in srgb, var(--folio-brand-accent) 24%, transparent)");
  assert.equal(declaration(pearl, "selection-bg"), "#e3e6db");
  assert.equal(declaration(dark, "selection-bg"), "#43564a");
  assert.equal(declaration(systemDark, "selection-bg"), "#43564a");
  assert.match(css, /::selection\s*\{\s*background:\s*var\(--folio-selection-bg\)/);
  assert.ok(contrast(declaration(dark, "selection-bg"), declaration(dark, "ink")) >= 4.5,
    "selected dark Pearl text must remain readable");
});

test("Pearl and Graphite text/action contrast is readable in light and dark", () => {
  const selectors = [
    ':root:where(:not([data-folio-preset]), [data-folio-preset="pearl"]) {',
    ':root:where([data-folio-theme="dark"]):where(:not([data-folio-preset]), [data-folio-preset="pearl"]) {',
    ':root:where([data-folio-preset="graphite"]) {',
    ':root:where([data-folio-theme="dark"][data-folio-preset="graphite"]) {',
  ];
  for (const selector of selectors) {
    const body = ruleBody(selector);
    const canvas = declaration(body, "canvas");
    for (const token of ["ink", "body", "body-strong", "muted", "muted-soft", "primary"]) {
      assert.ok(contrast(declaration(body, token), canvas) >= 4.5, selector + ' ' + token);
    }
    assert.ok(contrast(declaration(body, "on-primary"), declaration(body, "primary")) >= 4.5, selector + ' button text');
  }
});

test("all code palettes expose independent surfaces and syntax roles", () => {
  assert.match(css, /data-folio-code-palette="xuanmo"/);
  assert.match(css, /data-folio-code-palette="xuanzhi"/);
  assert.match(css, /data-folio-code-palette="porcelain"/);
  for (const property of ["code-bg", "code-fg", "code-border", "syntax-text", "syntax-comment", "syntax-keyword", "syntax-function", "syntax-string", "syntax-number", "syntax-type", "syntax-punctuation"]) {
    assert.match(css, new RegExp("--folio-" + property + ":"));
  }
  assert.match(css, /color: var\(--folio-syntax-comment\)/);
  assert.match(css, /background: var\(--folio-code-bg\)/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test("Xuanzhi, Xuanmo and Porcelain meet readable contrast on code surfaces", () => {
  const selectors = [
    ':root:where(:not([data-folio-code-palette="xuanmo"])) {',
    ':root:where([data-folio-code-palette="xuanmo"], [data-folio-theme="dark"]:not([data-folio-code-palette="xuanzhi"]):not([data-folio-code-palette="porcelain"])) {',
    ':root:where([data-folio-code-palette="porcelain"], [data-folio-preset="pearl"][data-folio-code-palette="auto"]:not([data-folio-theme="dark"])) {',
  ];
  for (const selector of selectors) {
    const body = ruleBody(selector);
    const background = declaration(body, "code-bg");
    assert.ok(contrast(declaration(body,"code-header-fg"),declaration(body,"code-header-bg"))>=4.5,
      selector + " header label contrast");
    for (const role of [
      "code-fg", "syntax-text", "syntax-comment", "syntax-keyword",
      "syntax-function", "syntax-string", "syntax-number", "syntax-type",
      "syntax-punctuation",
    ]) {
      assert.ok(contrast(declaration(body, role), background) >= 4.5,
        selector + " " + role + " should be readable on the code surface");
    }
  }
});

test("Editorial keeps its magazine identity while providing readable action contrast", () => {
  const cases = [
    [
      ruleBody(':root:where([data-folio-preset="editorial"]) {'),
      ruleBody(':root {'),
    ],
    [
      ruleBody(':root:where([data-folio-theme="dark"][data-folio-preset="editorial"]) {'),
      ruleBody('[data-folio-theme="dark"] {'),
    ],
  ];
  for (const [preset, inherited] of cases) {
    const canvas = declaration(inherited, "canvas");
    const primary = declaration(preset, "primary");
    assert.ok(contrast(primary, canvas) >= 4.5, "Editorial action accent on canvas");
    assert.ok(contrast(declaration(preset, "on-primary"), primary) >= 4.5,
      "Editorial action label on button");
  }
});


test("Editorial system-dark media fallback keeps the readable override, not the legacy accent", () => {
  const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark) {'));
  const selector = ':root:where(:not([data-folio-theme])[data-folio-preset="editorial"]) {';
  const first = media.indexOf(selector);
  const last = media.lastIndexOf(selector);
  assert.ok(first >= 0 && last > first, "system-dark Editorial must pair inherited roles with readable accent overrides");
  const original = media.slice(first + selector.length).split("}")[0];
  const accent = media.slice(last + selector.length).split("}")[0];
  const primary = declaration(accent, "primary");
  assert.ok(contrast(primary, declaration(original, "canvas")) >= 4.5,
    "Editorial system-dark accent must contrast against its dark canvas");
  assert.ok(contrast(declaration(accent, "on-primary"), primary) >= 4.5,
    "Editorial system-dark button text must contrast against its action fill");
});
