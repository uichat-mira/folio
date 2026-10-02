import assert from "node:assert/strict";
import test from "node:test";
import { renderFolioMarkdown } from "../dist/index.js";

test("compatibility renderer preserves custom HTML and removes duplicate H1", () => {
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
  assert.equal(html.includes('class="md-custom-block"'), true);
  assert.equal(html.includes('<h2 id="section">'), true);
  assert.equal(html.includes('href="#section"'), true);
});

test("code and Mermaid source are safely escaped", () => {
  const html = renderFolioMarkdown(
    "```html\n<script>alert(1)</script>\n```\n\n```mermaid\ngraph TD\nA-->B\n```",
  );

  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
  assert.equal(html.includes('class="markdown-mermaid-source"'), true);
  assert.equal(html.includes("graph TD"), true);
});
