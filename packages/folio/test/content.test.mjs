import assert from "node:assert/strict";
import test from "node:test";
import {
  extractHeadings,
  parseFrontmatter,
  parseFolioDoc,
  sourcePathToRoute,
} from "../dist/index.js";

test("source paths become stable routes", () => {
  assert.equal(
    sourcePathToRoute("docs/getting-started.md"),
    "/docs/getting-started",
  );
  assert.equal(sourcePathToRoute("blogs/index.md"), "/blogs");
});

test("frontmatter and custom fields are preserved", () => {
  const doc = parseFolioDoc(
    "projects/folio.md",
    `---
title: Folio
type: project
status: active
owners:
  - tomz
---
## Roadmap
`,
  );

  assert.equal(doc.type, "project");
  assert.equal(doc.status, "active");
  assert.deepEqual(doc.data.owners, ["tomz"]);
  assert.equal(doc.headings[0].id, "roadmap");
});

test("duplicate headings receive deterministic suffixes", () => {
  assert.deepEqual(
    extractHeadings("## Same\n## Same").map((heading) => heading.id),
    ["same", "same-2"],
  );
});

test("Markdown and HTML headings preserve source order", () => {
  assert.deepEqual(
    extractHeadings("## First\n\n<h2><strong>Second</strong></h2>\n\n### Third"),
    [
      { depth: 2, text: "First", id: "first" },
      { depth: 2, text: "Second", id: "second" },
      { depth: 3, text: "Third", id: "third" },
    ],
  );
});

test("plain markdown remains valid content", () => {
  assert.deepEqual(parseFrontmatter("# Hello"), {
    data: {},
    body: "# Hello",
  });
});
