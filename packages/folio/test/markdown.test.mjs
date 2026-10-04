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


test("renderer preserves explicit heading IDs and keeps generated IDs aligned", () => {
  const html = renderFolioMarkdown(
    '<h2 id="same">Explicit</h2>\n\n## Same\n\n#### Fourth level',
  );

  assert.match(html, /<h2 id="same">Explicit<\/h2>/);
  assert.match(html, /<h2 id="same-2">Same/);
  assert.match(html, /<h4 id="fourth-level">Fourth level/);
});
