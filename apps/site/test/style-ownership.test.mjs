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

test("official site consumes the package selection role rather than overriding it", () => {
  assert.doesNotMatch(siteThemeCss, /::selection\s*\{/);
});

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

test("homepage omits the ornamental hero baseline strip", () => {
  assert.doesNotMatch(homeThemeJsx, /portal-hero__baseline|FOLIO \/ 01|DISCOVER/);
  assert.doesNotMatch(homeThemeCss, /\.portal-hero__baseline/);
  assert.match(homeThemeJsx, /id="portal-capabilities"/);
});

test("homepage portal-preview headline consumes reading typography without restyling its wordmark", () => {
  assert.match(siteThemeCss, /--site-reading-heading:\s*var\(--folio-font-reading-heading\)/);
  assert.match(siteThemeCss, /--site-reading-heading-weight:\s*var\(--folio-reading-heading-weight\)/);
  const preview = cssSection(homeThemeCss, ".portal-stage__aura {", "/* Homepage sections share a readable, deliberate hierarchy. */");
  assert.match(preview, /\.portal-stage__title\s*\{[^}]*font:\s*var\(--site-reading-heading-weight\) clamp\(45px, 4\.2vw, 65px\)\/\.96 var\(--site-reading-heading\)/);
  assert.match(preview, /\.portal-stage__title em\s*\{[^}]*font-weight:\s*var\(--site-reading-heading-weight\)/);
  assert.match(preview, /\.portal-stage__nav strong\s*\{[^}]*font-family:\s*var\(--site-display\)/);
  assert.match(preview, /\.portal-stage__story-copy strong\s*\{[^}]*font:\s*var\(--site-reading-heading-weight\) clamp\(27px, 2\.4vw, 36px\)\/1\.02 var\(--site-reading-heading\)/);
  assert.doesNotMatch(preview, /\.portal-stage__title\s*\{[^}]*font:\s*500/);
  assert.doesNotMatch(preview, /\.portal-stage__story-copy strong\s*\{[^}]*font:\s*500/);
});

test("type specimen Ag consumes reading heading typography, not the old display font", () => {
  const design = cssSection(homeThemeCss, ".portal-design {", "/* Two actual audiences");
  assert.match(design,
    /\.portal-design-card__specimen span\s*\{[^}]*font:\s*var\(--site-reading-heading-weight\) 89px\/\.85 var\(--site-reading-heading\)/);
  assert.doesNotMatch(design, /\.portal-design-card__specimen span\s*\{[^}]*italic 500/);
});

test("FOL-052: the five Design swatches are actual semantic token values", () => {
  const design = cssSection(homeThemeCss, ".portal-design {", "/* Two actual audiences");
  for (const [index, role] of [
    [1, "brand-accent"], [2, "accent-teal"], [3, "ink"],
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
    [".portal-closing {", "/* Responsive: preserve the visual hierarchy"],
  ]) {
    assert.doesNotMatch(cssSection(homeThemeCss, start, end), /#[a-f\d]{3,8}\b/i);
  }
  assert.match(homeThemeCss, /\.portal-config\s*\{[^}]*background:\s*var\(--site-code-bg\)/);
  assert.match(homeThemeCss, /\.portal-code-string\s*\{ color: var\(--site-syntax-string\); \}/);
  assert.match(homeThemeCss, /\.folio-portal-home :is\(a, button\):focus-visible/);
  assert.match(homeThemeCss, /@media \(max-width: 720px\)/);
  assert.match(cssSection(homeThemeCss, ".portal-stage__aura {", "/* Homepage sections share a readable, deliberate hierarchy. */"), /#[a-f\d]{3,8}\b/i);
});

test("Mira practice card uses official brand mark and specific publication context", () => {
  assert.match(homeThemeJsx, /01 \/ MIRA IN PRACTICE/);
  assert.match(homeThemeJsx, /从 Mira 的真实实践中生长/);
  assert.match(homeThemeJsx, /围绕产品官网、技术文档、工程博客与公告/);
  assert.match(homeThemeJsx, /服务于官方对外信息发布/);
  assert.doesNotMatch(homeThemeJsx, /组织的官方信息发布底座|MIRA ORGANIZATION/);
  assert.match(homeThemeJsx, /className="portal-audience__symbol portal-audience__symbol--mira"/);
  assert.match(homeThemeCss, /--portal-mira-mark:\s*#d35f2f/);
  assert.match(homeThemeCss, /\.portal-audience__symbol--mira\s*\{[^}]*color:\s*var\(--portal-mira-mark\)/);
});

test("homepage closing transitions directly into footer without extra reading bar", () => {
  assert.doesNotMatch(homeThemeJsx, /portal-read-next|KEEP EXPLORING|aria-label="继续阅读"/);
  assert.doesNotMatch(homeThemeCss, /\.portal-read-next/);
  assert.match(homeThemeJsx, /<\/section>\s*<\/main>/);
});

test("closing heading distinguishes its two lines using on-dark text roles", () => {
  const closing = cssSection(homeThemeCss, ".portal-closing {", "/* Responsive: preserve the visual hierarchy");
  assert.match(closing, /\.portal-closing h2\s*\{[^}]*color:\s*var\(--site-on-dark\)/);
  assert.match(closing, /\.portal-closing h2 em\s*\{[^}]*color:\s*var\(--site-on-dark-soft\)/);
  assert.doesNotMatch(closing, /\.portal-closing h2 em\s*\{[^}]*color:\s*var\(--site-accent-amber\)/);
});

test("closing Archive Signal remains decorative, token-driven and motion-safe", () => {
  const signalSource = readFileSync(new URL("ClosingSignal.tsx", siteSrc), "utf8");
  const signalCss = readFileSync(new URL("closing-signal.css", siteSrc), "utf8");
  const entrySource = readFileSync(new URL("main.tsx", siteSrc), "utf8");
  assert.match(homeThemeJsx, /<section className="portal-closing"[^>]*>\s*<ClosingSignal \/>/);
  assert.match(entrySource, /import "\.\/closing-signal\.css"/);
  assert.match(signalSource, /aria-hidden="true"/);
  assert.match(signalSource, /focusable="false"/);
  assert.match(signalCss, /\.portal-closing__signal\s*\{[^}]*pointer-events:\s*none/);
  assert.match(homeThemeCss, /\.portal-closing__inner\s*\{[^}]*z-index:\s*1/);
  assert.match(signalCss, /stroke:\s*var\(--site-accent-amber\)/);
  assert.equal((signalSource.match(/className="portal-closing__orbit-line"/g) ?? []).length, 3,
    "the mark is exactly three elliptical orbital planes");
  assert.equal((signalSource.match(/className="portal-closing__orbit-glint"/g) ?? []).length, 3);
  assert.doesNotMatch(signalSource, /portal-closing__signal-(?:tracks|archive|cross|markers)/,
    "do not bring back the previous star-map diagram");
  assert.match(signalCss, /stroke-dasharray:\s*20 980/);
  assert.match(signalSource, /translate\(1710 80\)/,
    "part of the system must sit beyond the visible frame");
  assert.doesNotMatch(signalSource, /portal-closing__nucleus/,
    "the complete atom icon should never appear");
  assert.match(signalCss, /\.portal-closing__orbit\s*\{[^}]*transform-box:\s*fill-box/);
  assert.match(signalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
  assert.doesNotMatch(signalCss, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(signalSource, /setInterval|requestAnimationFrame|useEffect|window\./);
});

test("home code showcase consumes the same code-surface roles as FolioMarkdown", () => {
  const porcelain = folioBlock(':root:where([data-folio-code-palette="porcelain"], [data-folio-preset="pearl"][data-folio-code-palette="auto"]:not([data-folio-theme="dark"]))');
  assert.equal(porcelain["code-bg"], "#fffefa");
  assert.equal(porcelain["code-header-bg"], "#f5f4f0");
  assert.equal(porcelain["code-border"], "#e7e6e0");
  assert.match(siteThemeCss, /--site-code-header-bg:\s*var\(--folio-code-header-bg\)/);
  assert.match(siteThemeCss, /--site-code-header-fg:\s*var\(--folio-code-header-fg\)/);
  const code = cssSection(homeThemeCss, ".portal-config {", "/* AI is intentionally");
  assert.match(code, /background:\s*var\(--site-code-bg\)/);
  assert.match(code, /\.portal-config__bar\s*\{[^}]*background:\s*var\(--site-code-header-bg\)/);
  assert.doesNotMatch(code, /background:\s*color-mix\(in srgb, var\(--site-code-bg\) 88%, var\(--site-code-fg\) 12%\)/);
  assert.match(code, /\.portal-config__foot\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--site-code-bg\) 80%, var\(--site-code-header-bg\) 20%\)/);
});

test("FOL-052: Porcelain White keeps Pearl bright, ink-led and restrained", () => {
  const pearl = publicColors("pearl", "light");
  assert.equal(pearl.canvas, "#faf9f6");
  assert.equal(pearl["surface-soft"], "#f5f4f0");
  assert.equal(pearl["surface-card"], "#fffefa");
  assert.equal(pearl.hairline, "#e7e6e0");
  assert.equal(pearl.ink, "#252522");
  assert.equal(pearl.primary, pearl.ink);
  assert.equal(pearl["brand-accent"], "#a83d22");
  assert.notEqual(pearl["brand-accent"], pearl.primary);
  for (const surface of ["canvas", "surface-soft", "surface-card"]) {
    assert.ok(contrast(pearl["muted-soft"], pearl[surface]) >= 4.5,
      "Pearl muted-soft contrast on " + surface);
  }
  assert.ok(contrast(pearl["brand-accent"], pearl.canvas) >= 4.5);
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
