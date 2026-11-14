import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const src = new URL("../src/", import.meta.url);
const configSource = readFileSync(new URL("theme-explorer-config.ts", src), "utf8");
const explorerSource = readFileSync(new URL("ThemeExplorer.tsx", src), "utf8");
const themeSelectSource = readFileSync(new URL("ThemeSelect.tsx", src), "utf8");
const homeSource = readFileSync(new URL("HomePage.tsx", src), "utf8");
const mobileSvgSource = readFileSync(new URL("DesignMobileMotion.tsx", src), "utf8");
const cssSource = readFileSync(new URL("home.css", src), "utf8");
const siteConfigGuide = readFileSync(new URL("../content/guide/configuration.md", import.meta.url), "utf8");

const transpiled = ts.transpileModule(configSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal(transpiled.diagnostics?.length ?? 0, 0);
const context = { exports: {} };
vm.runInNewContext(transpiled.outputText, context);
const { createFolioThemeConfig } = context.exports;

test("FOL-053: all four options serialize as valid public folio.config.ts", () => {
  for (const preset of ["pearl", "editorial", "graphite"])
    for (const scheme of ["system", "light", "dark"])
      for (const codePalette of ["auto", "xuanzhi", "xuanmo", "porcelain"])
        for (const template of ["portal", "editorial"]) {
          const code = createFolioThemeConfig({ preset, scheme, codePalette }, template);
          assert.match(code, /import \{ defineFolioConfig \} from "@uichat-mira\/folio"/);
          const file = ts.createSourceFile("folio.config.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
          assert.equal(file.parseDiagnostics.length, 0, code);
          assert.match(code, new RegExp('preset: "' + preset + '"'));
          assert.match(code, new RegExp('scheme: "' + scheme + '"'));
          assert.match(code, new RegExp('codePalette: "' + codePalette + '"'));
          assert.match(code, new RegExp('home: \\{ template: "' + template + '"'));
          assert.doesNotMatch(code, /localStorage|themeChoice|appearancePreview/);
        }
});

test("FOL-053: runtime appearance is controlled through the Folio public hook, never the root DOM", () => {
  assert.match(explorerSource, /useFolioAppearance\(\)/);
  assert.match(explorerSource, /preview\(value\)/);
  assert.match(explorerSource, /resetPreview\(\)/);
  assert.doesNotMatch(explorerSource, /document\.documentElement|(?:window|globalThis)\.localStorage|localStorage\.(?:setItem|getItem|removeItem)|\.dataset\.folio/);
  for (const value of ["pearl", "editorial", "graphite", "system", "light", "dark",
    "auto", "xuanzhi", "xuanmo", "porcelain", "portal", "editorial"]) {
    assert.ok(explorerSource.includes('value: "' + value + '"'), "Missing option " + value);
  }
  assert.match(explorerSource, /value=\{appearance\.preset\}/);
  assert.match(explorerSource, /value=\{appearance\.scheme\}/);
  assert.match(explorerSource, /value=\{appearance\.codePalette\}/);
  assert.match(explorerSource, /value=\{template\}/);
});

test("FOL-053: public template + native Markdown consumer in current homepage, not a second renderer", () => {
  assert.match(explorerSource, /<FolioHome config=\{config\} docs=\{docs\} template=\{template\} as="div"\s*\/>/);
  assert.match(explorerSource, /<FolioMarkdown source=\{markdownSource\}/);
  assert.doesNotMatch(explorerSource, /<main|hljs\.highlight|dangerouslySetInnerHTML/);
  assert.match(homeSource, /<ThemeExplorerGate docs=\{docs\}\s*\/>/);
  assert.match(homeSource, /<main className="folio-portal-home"/);
});

test("FOL-053: static and first React paint are readable without inactive controls", () => {
  assert.match(explorerSource, /const \[desktop, setDesktop\] = useState\(false\)/);
  assert.match(explorerSource, /window\.matchMedia\("\(min-width: 701px\)"\)/);
  assert.match(explorerSource, /media\.addEventListener\("change", update\)/);
  assert.match(explorerSource, /media\.removeEventListener\("change", update\)/);
  assert.match(explorerSource, /return desktop \? <ThemeExplorer docs=\{docs\} \/> : null/);
  assert.match(homeSource, /portal-design-card--type/);
  assert.match(homeSource, /portal-design-card--color/);
  assert.match(homeSource, /portal-design-card--ui/);
  assert.match(explorerSource, /navigator\.clipboard\.writeText\(configText\)/);
  assert.match(explorerSource, /onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/);
});

test("FOL-053: left-side settings, real iframe viewport and mobile layout", () => {
  assert.match(cssSource, /\.portal-explorer\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(0, 2fr\)/);
  assert.match(cssSource, /\.portal-explorer__studio\s*\{\s*display:\s*contents;/);
  assert.match(cssSource, /\.portal-explorer__device-pane\s*\{[^}]*grid-row:\s*1 \/ span 2/);
  assert.match(cssSource, /@media \(max-width: 960px\)\s*\{[\s\S]*?\.portal-explorer__studio\s*\{[^}]*display:\s*grid/);
  assert.match(cssSource, /\.portal-explorer__controls\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /\.portal-explorer__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /\.portal-explorer__button\s*\{[^}]*min-width:\s*0/);
  assert.match(cssSource, /\.portal-explorer__phone\s*\{[^}]*width:\s*min\(100%, 410px\);[^}]*aspect-ratio:\s*410 \/ 905/);
  assert.match(cssSource, /\.portal-explorer__phone-top \{ height: 23px; \}/);
  assert.match(cssSource, /\.portal-explorer__phone-bottom \{ height: 18px; \}/);
  assert.match(explorerSource, /<section className="portal-explorer__code-panel"/);
  assert.match(explorerSource, /<h5>folio\.config\.ts<\/h5>/);
  assert.doesNotMatch(explorerSource, /<details className="portal-explorer__code-details"/);
  assert.match(cssSource, /\.portal-explorer__phone-screen\s*\{[^}]*width:\s*100%/);
  assert.match(cssSource, /@media \(max-width: 960px\)[\s\S]*\.portal-explorer__studio/);
  // Screens below 701px never mount the interactive lab; styling its 520px
  // controls would be unreachable CSS, not a responsive behavior to protect.
  assert.doesNotMatch(cssSource, /@media \(max-width: 520px\)[^}]*\.portal-explorer/);
  assert.match(explorerSource, /const homeHref = useHref\("\/"\)/);
  assert.match(explorerSource, /"folio-preview": "mobile"/);
  assert.match(explorerSource, /src=\{phoneSrc\}/);
  assert.match(homeSource, /get\("folio-preview"\) === "mobile"/);
  assert.match(homeSource, /<ThemePreviewHome docs=\{docs\} search=\{location\.search\}/);
  assert.match(explorerSource, /preview\(\{ preset, scheme, codePalette \}\)/);
  assert.match(explorerSource, /presets\.find\(\(item\) => item\.value === params\.get\("preset"\)\)/);
  assert.match(explorerSource, /<FolioHome config=\{config\} docs=\{docs\} template=\{template\} as="div"\s*\/>/);
  assert.doesNotMatch(explorerSource, /document\.documentElement|localStorage\.(?:setItem|removeItem)/);
  assert.match(siteConfigGuide, /0\.1\.1/);
  assert.match(siteConfigGuide, /useFolioAppearance\(\)/);
  assert.match(siteConfigGuide, /folio-theme-choice/);
});


test("FOL-053: four native-free token comboboxes keep keyboard and screen-reader semantics", () => {
  assert.equal((explorerSource.match(/<ThemeSelect\b/g) || []).length, 4);
  assert.doesNotMatch(explorerSource, /<select\b|<option\b/);
  assert.match(themeSelectSource, /role="combobox"/);
  assert.match(themeSelectSource, /role="listbox"/);
  assert.match(themeSelectSource, /role="option"/);
  assert.match(themeSelectSource, /aria-expanded=\{open\}/);
  assert.match(themeSelectSource, /aria-activedescendant=/);
  assert.match(themeSelectSource, /aria-selected=\{option\.value === value\}/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab"]) {
    assert.ok(themeSelectSource.includes('case "' + key + '":'), "Missing keyboard behavior " + key);
  }
  assert.match(themeSelectSource, /document\.addEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(themeSelectSource, /document\.removeEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(cssSource, /\.portal-explorer__select-menu\s*\{[^}]*position:\s*absolute/);
  assert.match(cssSource, /\.portal-explorer__select-option\[aria-selected="true"\]/);
  assert.match(cssSource, /var\(--site-primary-active\)/);
});

test("Theme Lab is an open workspace with concise copy", () => {
  assert.match(cssSource, /\.portal-explorer\s*\{[^}]*border-top:\s*1px solid var\(--portal-hairline\)/);
  assert.doesNotMatch(cssSource, /\.portal-explorer\s*\{[^}]*background:/);
  const deviceRule = cssSource.match(/\.portal-explorer__device-pane\s*\{([^}]*display:\s*flex;[^}]*)\}/);
  assert.ok(deviceRule);
  assert.match(deviceRule[1], /align-items:\s*center/);
  assert.doesNotMatch(deviceRule[1], /border|padding-left|background:/);
  assert.doesNotMatch(cssSource, /\.portal-explorer__device-pane\s*\{[^}]*border/);
  assert.match(explorerSource, /<h3 id="portal-explorer-title">把你的风格，调出来。<\/h3>/);
  assert.match(explorerSource, /Folio 精选了几套视觉预设，让你的内容拥有自己的气质。/);
  assert.doesNotMatch(explorerSource, /<h4>外观设置<\/h4>|portal-explorer__panel-heading/);
  assert.match(cssSource, /\.portal-explorer__description\s*\{[^}]*color:\s*var\(--site-muted\)/);
  assert.doesNotMatch(cssSource, /\.portal-explorer__panel-heading/);
  assert.doesNotMatch(explorerSource, /<h4>实时预览<\/h4>/);
  assert.doesNotMatch(explorerSource, /portal-explorer__selection|portal-explorer__notice|portal-explorer__device-caption/);
  assert.doesNotMatch(cssSource, /\.portal-explorer__(?:selection|effective|selection-note|notice|device-caption)\b/);
  assert.match(explorerSource, /\{copied \? "已复制" : "复制当前配置"\}/);
  assert.match(explorerSource, /setManualCopy\(true\)/);
  assert.match(explorerSource, /<div className="portal-explorer__device-pane" aria-label="手机外观预览">/);
  assert.doesNotMatch(cssSource, /\.portal-explorer__device-heading/);
  assert.doesNotMatch(deviceRule[1], /padding-top|margin-top/);
  assert.doesNotMatch(explorerSource, /每个选项都独立生效|独立手机视口|真实 FolioMarkdown 渲染|左边调整外观|可以滚动及点开链接/);
  assert.doesNotMatch(explorerSource, /### folio\.config\.ts/);
  assert.doesNotMatch(cssSource, /\.portal-explorer__availability|\.portal-explorer__code-panel > p/);
  assert.match(explorerSource, /<FolioMarkdown source=\{markdownSource\}/);
});

test("mobile Design section shows SVG instead of mounting the configuration panel", () => {
  assert.match(homeSource, /<DesignMobileMotion \/>/);
  assert.match(mobileSvgSource, /<svg/);
  assert.match(mobileSvgSource, /aria-labelledby="folio-mobile-design-title folio-mobile-design-desc"/);
  assert.match(mobileSvgSource, /<title id="folio-mobile-design-title">/);
  assert.match(cssSource, /\.portal-design__mobile-art \{ display: none; \}/);
  assert.match(cssSource, /@media \(max-width: 700px\) \{\s*\.portal-explorer \{ display: none; \}/);
  assert.match(cssSource, /\.portal-design__mobile-art\s*\{[^}]*display: grid/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.portal-design__motion-sheet[\s\S]*animation: none;/);
  assert.doesNotMatch(mobileSvgSource, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(mobileSvgSource, /<script\b/i);
  for (const token of ["--site-brand-accent", "--site-ink", "--site-accent-teal", "--site-surface-soft"]) {
    assert.ok(mobileSvgSource.includes("var(" + token + ")"), "missing semantic token " + token);
  }
});
