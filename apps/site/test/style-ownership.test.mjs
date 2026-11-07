import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const siteCss = readFileSync(new URL("../src/site.css", import.meta.url), "utf8");

test("official site does not override Folio-owned component style families", () => {
  // The site may theme through --folio-* tokens and style its own slot content,
  // but must not redefine the shared Header, reading layout or Markdown CSS.
  const sharedSelectors = /\\.folio-(?:markdown|doc-page|lede|eyebrow|header|footer|brand)(?=\\b|_)/g;
  assert.doesNotMatch(siteCss, sharedSelectors);
});
