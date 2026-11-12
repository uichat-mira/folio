import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
// The workspace validate script intentionally runs this single site test entry.
import "./theme-explorer.test.mjs";
import "./design-reference.test.mjs";

const siteSrc = new URL("../src/", import.meta.url);
const siteCssFiles = readdirSync(siteSrc).filter((file) => file.endsWith(".css"));

test("official site styles only its own composition, never Folio component internals", () => {
  for (const file of siteCssFiles) {
    const css = readFileSync(new URL(file, siteSrc), "utf8");
    // .folio-portal-home is an official-site composition class, not a
    // shared Folio package component. All other .folio-* selectors belong
    // to the package and must not be targeted by official-site styles.
    const ownedByPackage = [...css.matchAll(/\.(folio-[a-z][\w-]*)/gi)]
      .map((match) => match[1])
      .filter((className) => className !== "folio-portal-home");
    assert.deepEqual(ownedByPackage, [], `${file} must not override Folio-owned selectors`);
  }
});


const siteThemeCss = readFileSync(new URL("site.css", siteSrc), "utf8");
const homeThemeCss = readFileSync(new URL("home.css", siteSrc), "utf8");
const homeThemeJsx = readFileSync(new URL("HomePage.tsx", siteSrc), "utf8");
const publicThemeCss = readFileSync(new URL("../../../packages/folio/src/styles.css", import.meta.url), "utf8");

function cssSection(source, start, end) {
  const i = source.indexOf(start);
  const j = source.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j >= 0, "Missing CSS section " + start);
  return source.slice(i, j);
}
function folioBlock(selector) {
  const i = publicThemeCss.indexOf(selector + " {");
  assert.ok(i >= 0, "Missing public token rule " + selector);
  const body = publicThemeCss.slice(i, publicThemeCss.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--folio-([\w-]+):\s*(#[a-f\d]{3,8})\s*;/gi)]
    .map((match) => [match[1], match[2]]));
}
const themeSelectors = {
  base: ":root",
  dark: '[data-folio-theme="dark"]',
  pearl: ':root:where(:not([data-folio-preset]), [data-folio-preset="pearl"])',
  editorial: ':root:where([data-folio-preset="editorial"])',
  graphite: ':root:where([data-folio-preset="graphite"])',
  pearlDark: ':root:where([data-folio-theme="dark"]):where(:not([data-folio-preset]), [data-folio-preset="pearl"])',
  editorialDark: ':root:where([data-folio-theme="dark"][data-folio-preset="editorial"])',
  graphiteDark: ':root:where([data-folio-theme="dark"][data-folio-preset="graphite"])',
};
function publicColors(preset, scheme) {
  const names = ["base"];
  if (scheme === "dark") names.push("dark");
  names.push(preset);
  if (scheme === "dark") names.push(preset + "Dark");
  return Object.assign({}, ...names.map((name) => folioBlock(themeSelectors[name])));
}
function channels(hex) {
  const digits = hex.slice(1);
  assert.match(digits, /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
  return digits.length === 3
    ? [...digits].map((v) => parseInt(v + v, 16))
    : [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}
function relativeLuminance(rgb) {
  const c = rgb.map((v) => {
    const n = v / 255;
    return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function contrast(foreground, background) {
  const a = relativeLuminance(Array.isArray(foreground) ? foreground : channels(foreground));
  const b = relativeLuminance(Array.isArray(background) ? background : channels(background));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
function mix(first, second, weight) {
  const a = channels(first), b = channels(second);
  return a.map((v, i) => v * weight + b[i] * (1 - weight));
}

test("FOL-052: website follows public presets instead of overriding root semantic tokens", () => {
  assert.doesNotMatch(siteThemeCss, /--folio-(?:primary|primary-active|ink|canvas):/);
  assert.match(siteThemeCss, /--site-primary:\s*var\(--folio-primary\)/);
  assert.match(siteThemeCss, /\.site-header-action\s*\{[^}]*color:\s*var\(--site-on-primary\)/);
  assert.match(homeThemeCss, /\.portal-button--primary\s*\{[^}]*color:\s*var\(--site-on-primary\)/);
  const siteAliases = new Set([...siteThemeCss.matchAll(/--(site-[\w-]+):\s*var\(--folio-/g)]
    .map((match) => match[1]));
  for (const match of homeThemeCss.matchAll(/var\(--(site-[\w-]+)\)/g)) {
    assert.ok(siteAliases.has(match[1]), "Unknown site alias: " + match[1]);
  }
});

test("FOL-052: the five Design swatches are actual semantic token values", () => {
  const design = cssSection(homeThemeCss, ".portal-design {", "/* Two actual audiences");
  for (const [index, role] of [
    [1, "primary"], [2, "accent-teal"], [3, "ink"],
    [4, "accent-amber"], [5, "surface-card"],
  ]) {
    assert.ok(design.includes(
      ".portal-design-card__swatches span:nth-child(" + index + ") { background: var(--site-" + role + ");"
    ), "Swatch " + index + " must use " + role);
  }
  assert.match(homeThemeJsx, /portal-design-card__swatches" role="img"/);
  assert.match(design, /\.portal-design-card__mini-ui\s*\{[^}]*background:\s*var\(--site-canvas\)/);
  assert.doesNotMatch(design, /#[a-f\d]{3,8}\b/i);
});

test("FOL-052: live content panels use tokens; decorative illustrations remain independent", () => {
  for (const [start, end] of [
    [".portal-config {", "/* AI is intentionally"],
    [".portal-workflow {", "/* The three pillars"],
    [".portal-design {", "/* Two actual audiences"],
    [".portal-audience {", "/* End with an action"],
    [".portal-closing {", ".portal-read-next {"],
  ]) {
    assert.doesNotMatch(cssSection(homeThemeCss, start, end), /#[a-f\d]{3,8}\b/i);
  }
  assert.match(homeThemeCss, /\.portal-config\s*\{[^}]*background:\s*var\(--site-code-bg\)/);
  assert.match(homeThemeCss, /\.portal-code-string\s*\{ color: var\(--site-syntax-string\); \}/);
  assert.match(homeThemeCss, /\.folio-portal-home :is\(a, button\):focus-visible/);
  assert.match(homeThemeCss, /@media \(max-width: 720px\)/);
  assert.match(cssSection(homeThemeCss, ".portal-stage__aura {", ".portal-hero__baseline {"), /#[a-f\d]{3,8}\b/i);
});

test("FOL-052: all three presets and both schemes retain readable semantic text and actions", () => {
  for (const preset of ["pearl", "editorial", "graphite"]) {
    for (const scheme of ["light", "dark"]) {
      const t = publicColors(preset, scheme);
      const checks = [
        ["heading", t.ink, t.canvas, 7],
        ["body", t.body, t.canvas, 4.5],
        ["accent text", t["primary-active"], t["surface-soft"], 4.5],
        ["primary button", t["on-primary"], t["primary-active"], 4.5],
        ["inverse text", t["on-dark"], t["surface-dark"], 4.5],
        ["inverse small text", t["on-dark-soft"], t["surface-dark-elevated"], 4.5],
        ["inverse heading accent", mix(t["accent-teal"], t["on-dark"], .45), t["surface-dark"], 3],
        ["inverse CTA accent", t["accent-amber"], t["surface-dark"], 3],
      ];
      for (const [role, foreground, background, minimum] of checks) {
        const result = contrast(foreground, background);
        assert.ok(result >= minimum,
          preset + "/" + scheme + " " + role + ": " + result.toFixed(2) + " < " + minimum);
      }
    }
  }
  for (const scheme of ["light", "dark"]) {
    const values = ["pearl", "editorial", "graphite"]
      .map((preset) => publicColors(preset, scheme).primary);
    assert.equal(new Set(values).size, 3, scheme + ": primary colors must be distinct");
  }
});
