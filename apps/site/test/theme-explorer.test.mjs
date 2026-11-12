import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const src = new URL("../src/", import.meta.url);
const configSource = readFileSync(new URL("theme-explorer-config.ts", src), "utf8");
const explorerSource = readFileSync(new URL("ThemeExplorer.tsx", src), "utf8");
const homeSource = readFileSync(new URL("HomePage.tsx", src), "utf8");
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
      for (const codePalette of ["auto", "xuanzhi", "xuanmo"])
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
  assert.doesNotMatch(explorerSource, /document\.documentElement|localStorage|\.dataset\.folio/);
  for (const value of ["pearl", "editorial", "graphite", "system", "light", "dark",
    "auto", "xuanzhi", "xuanmo", "portal", "editorial"]) {
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
  assert.match(explorerSource, /const \[mounted, setMounted\] = useState\(false\)/);
  assert.match(explorerSource, /useEffect\(\(\) => setMounted\(true\), \[\]\)/);
  assert.match(explorerSource, /return mounted \? <ThemeExplorer docs=\{docs\} \/> : null/);
  assert.match(homeSource, /portal-design-card--type/);
  assert.match(homeSource, /portal-design-card--color/);
  assert.match(homeSource, /portal-design-card--ui/);
  assert.match(explorerSource, /navigator\.clipboard\.writeText\(configText\)/);
  assert.match(explorerSource, /onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/);
});

test("FOL-053: mobile preview remains bounded and docs distinguish dev from npm 0.1.1", () => {
  assert.match(cssSource, /\.portal-explorer__viewport\s*\{[^}]*max-width:\s*100%;[^}]*overflow:\s*auto/);
  assert.match(cssSource, /@media \(max-width: 970px\)[\s\S]*\.portal-explorer__results/);
  assert.match(cssSource, /@media \(max-width: 520px\)[\s\S]*\.portal-explorer__controls/);
  assert.match(siteConfigGuide, /npm `0\.1\.1`/);
  assert.match(siteConfigGuide, /useFolioAppearance\(\)/);
  assert.match(siteConfigGuide, /folio-theme-choice/);
});
