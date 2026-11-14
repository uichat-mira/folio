import assert from "node:assert/strict";
import test from "node:test";
import { renderFolioMarkdown } from "../dist/index.js";

test("renderer preserves custom HTML and removes duplicate H1", () => {
  const html = renderFolioMarkdown(
    `# Duplicate title

::: html
<div class="claude-visual"><strong>Visual</strong></div>
:::

::: tip Keep this note :::

## Section
`,
    { removeH1: true },
  );

  assert.equal(html.includes("Duplicate title"), false);
  assert.equal(html.includes("::: html"), false);
  assert.equal(html.includes('class="claude-visual"'), true);
  assert.equal(html.includes('md-custom-block--tip'), true);
  assert.equal(html.includes('<h2 id="section">'), true);
  assert.equal(html.includes('href="#section"'), true);
});

test("renderer supports design-system callout variants", () => {
  const html = renderFolioMarkdown(
    `::: info Information :::

::: warning Watch this :::

::: danger Stop here :::`,
  );

  assert.match(html, /md-custom-block--info/);
  assert.match(html, /md-custom-block--warning/);
  assert.match(html, /md-custom-block--danger/);
  assert.match(html, />信息</);
  assert.match(html, />注意</);
  assert.match(html, />警告</);
});

test("GFM tables render with semantic table markup", () => {
  const html = renderFolioMarkdown(
    `| Name | State |
| --- | --- |
| Folio | active |`,
  );

  assert.match(html, /<div class="folio-table-scroll" tabindex="0"><table>/);
  assert.match(html, /<\/table>\s*<\/div>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /<td>active<\/td>/);
});

test("code and Mermaid source are safely escaped", () => {
  const html = renderFolioMarkdown(
    "```html\n<script>alert(1)</script>\n```\n\n```mermaid\ngraph TD\nA-->B\n```",
  );

  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes('class="hljs language-html"'), true);
  assert.match(html, /&lt;.*script.*&gt;/s);
  assert.match(html, />alert<\/span>/);
  assert.match(html, /hljs-number">1<\/span>/);
  assert.match(html, /hljs-tag|hljs-name/);
  assert.equal(html.includes('class="markdown-mermaid"'), true);
  assert.equal(html.includes('data-mermaid-source='), true);
  assert.equal(html.includes("graph TD"), true);
});


test("fenced code has a safe language caption and a single accessible frame", () => {
  const html = renderFolioMarkdown(
    "~~~bash\nopencode pair\n~~~\n\n~~~typescript\nconst value = 42;\n~~~",
  );
  assert.equal((html.match(/<figure class="folio-code-frame/g) ?? []).length, 2);
  assert.match(html, /class="folio-code-frame folio-code-frame--terminal"/);
  assert.match(html, /<figcaption class="folio-code-frame__header">[\s\S]*?<span>Terminal<\/span>/);
  assert.match(html, /<span>TypeScript<\/span>/);
  assert.match(html, /<pre><code class="hljs language-bash">/);
  assert.match(html, /<pre><code class="hljs language-typescript">/);
  assert.doesNotMatch(html, /\$ opencode pair/, "terminal caption must not modify code");
});

test("Mermaid keeps its independent source and does not become a code frame", () => {
  const html = renderFolioMarkdown("~~~mermaid\ngraph TD\n A-->B\n~~~");
  assert.match(html, /class="markdown-mermaid"/);
  assert.doesNotMatch(html, /folio-code-frame/);
  assert.match(html, /<pre class="markdown-mermaid-source">/);
});

test("callout syntax inside fenced code remains verbatim", () => {
  const html = renderFolioMarkdown(
    "```md\n::: warning This is documentation, not a live callout :::\n```",
  );

  assert.equal(html.includes("md-custom-block--warning"), false);
  assert.match(
    html,
    /::: warning This is documentation, not a live callout :::/,
  );
});


test("inline directive examples cannot swallow following code fences or callouts", () => {
  const source = [
    "::: warning Only trusted documents",
    "The syntax of raw HTML includes a literal backtick-wrapped " + String.fromCharCode(96) + "::: html" + String.fromCharCode(96) + " example.",
    ":::",
    "",
    "## Code examples",
    "~~~md",
    "## Heading",
    "~~~",
    "",
    "~~~md",
    "::: tip",
    "This is only a code example.",
    ":::",
    "~~~",
    "",
    "::: tip",
    "This is a real callout.",
    ":::",
    "",
    "## After callout",
  ].join("\n");
  const html = renderFolioMarkdown(source);
  assert.equal((html.match(/class="folio-code-frame"/g) ?? []).length, 2);
  assert.equal((html.match(/<aside class="md-custom-block /g) ?? []).length, 2);
  assert.match(html, /<code>::: html<\/code>/);
  assert.match(html, /Only trusted documents/);
  assert.match(html, /This is a real callout/);
  assert.match(html, /This is only a code example/);
  assert.match(html, /<h2 id="after-callout">/);
  assert.doesNotMatch(html, /FOLIO_(?:FENCE|HTML|CALLOUT)_BLOCK_\d+/);
});

test("standalone HTML directives keep raw HTML and leave inline examples as text", () => {
  const html = renderFolioMarkdown([
    "Syntax includes " + String.fromCharCode(96) + "::: html" + String.fromCharCode(96) + ".",
    "",
    "::: html",
    "<div class=\"owned\">inside</div>",
    ":::",
    "",
    "## Afterwards",
  ].join("\n"));
  assert.match(html, /<code>::: html<\/code>/);
  assert.match(html, /<div class="owned">inside<\/div>/);
  assert.match(html, /<h2 id="afterwards">/);
  assert.doesNotMatch(html, /FOLIO_(?:FENCE|HTML|CALLOUT)_BLOCK_\d+/);
});

test("fenced code inside a callout survives placeholder restoration", () => {
  const html = renderFolioMarkdown([
    "::: note",
    "Some code:",
    "",
    "~~~ts",
    "const answer = 42;",
    "~~~",
    ":::",
    "",
    "Paragraph afterwards.",
  ].join("\n"));
  assert.match(html, /md-custom-block--note/);
  assert.match(html, /<figure class="folio-code-frame">/);
  assert.match(html, /<span>TypeScript<\/span>/);
  assert.match(html, /Paragraph afterwards/);
  assert.doesNotMatch(html, /FOLIO_(?:FENCE|HTML|CALLOUT)_BLOCK_\d+/);
});

test("renderer preserves explicit heading IDs and keeps generated IDs aligned", () => {
  const html = renderFolioMarkdown(
    '<h2 id="same">Explicit</h2>\n\n## Same\n\n#### Fourth level',
  );

  assert.match(html, /<h2 id="same">Explicit<\/h2>/);
  assert.match(html, /<h2 id="same-2">Same/);
  assert.match(html, /<h4 id="fourth-level">Fourth level/);
});


test("renderer reserves later explicit IDs before allocating generated IDs", () => {
  const html = renderFolioMarkdown(
    '## Same\n\n<h2 id="same">Explicit</h2>\n\n## Foo\n\n## Foo\n\n<h2 id="foo-2">Explicit suffix</h2>',
  );

  assert.match(html, /<h2 id="same-2">Same/);
  assert.match(html, /<h2 id="same">Explicit<\/h2>/);
  assert.match(html, /<h2 id="foo">Foo/);
  assert.match(html, /<h2 id="foo-3">Foo/);
  assert.match(html, /<h2 id="foo-2">Explicit suffix<\/h2>/);
});


test("renderer reserves explicit IDs on case-insensitive HTML heading tags", () => {
  const html = renderFolioMarkdown(
    '<H2 id="caps">Explicit caps</H2>\n\n## Caps',
  );

  assert.match(html, /<h2 id="caps">Explicit caps<\/h2>/);
  assert.match(html, /<h2 id="caps-2">Caps/);
});
