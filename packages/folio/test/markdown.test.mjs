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

  assert.match(html, /<table>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /<td>active<\/td>/);
});

test("code and Mermaid source are safely escaped", () => {
  const html = renderFolioMarkdown(
    "```html\n<script>alert(1)</script>\n```\n\n```mermaid\ngraph TD\nA-->B\n```",
  );

  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
  assert.equal(html.includes('class="markdown-mermaid"'), true);
  assert.equal(html.includes('data-mermaid-source='), true);
  assert.equal(html.includes("graph TD"), true);
});


test("renderer heading ids match extracted toc ids for h4, duplicates, and explicit ids", () => {
  const html = renderFolioMarkdown(
    '## Same\n\n## Same\n\n#### Fourth\n\n<h2 id="custom-anchor">Custom</h2>',
  );

  assert.match(html, /<h2 id="same">/);
  assert.match(html, /<h2 id="same-2">/);
  assert.match(html, /<h4 id="fourth">/);
  assert.match(html, /<h2 id="custom-anchor">/);
  assert.match(html, /href="#same-2"/);
  assert.match(html, /href="#fourth"/);
});
