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


test("collection and section frontmatter are part of the document contract", () => {
  const doc = parseFolioDoc(
    "docs/runtime.md",
    `---
title: Runtime
collection: Core docs
section: Runtime
group: Guide
---
## Shell
`,
  );

  assert.equal(doc.collection, "Core docs");
  assert.equal(doc.section, "Runtime");
});


test("fenced code headings are excluded from the document outline", () => {
  assert.deepEqual(
    extractHeadings(
      "```md\n## Fake heading\n```\n\n## Real heading",
    ),
    [{ depth: 2, text: "Real heading", id: "real-heading" }],
  );
});

test("explicit HTML heading IDs are preserved in the document outline", () => {
  assert.deepEqual(
    extractHeadings(
      '<h2 id="custom-anchor">Custom heading</h2>\n\n## Next heading',
    ),
    [
      { depth: 2, text: "Custom heading", id: "custom-anchor" },
      { depth: 2, text: "Next heading", id: "next-heading" },
    ],
  );
});

test("explicit IDs participate in generated heading collision tracking", () => {
  assert.deepEqual(
    extractHeadings('<h2 id="same">Explicit</h2>\n\n## Same'),
    [
      { depth: 2, text: "Explicit", id: "same" },
      { depth: 2, text: "Same", id: "same-2" },
    ],
  );
});


test("generated heading IDs reserve later explicit IDs", () => {
  assert.deepEqual(
    extractHeadings('## Same\n\n<h2 id="same">Explicit</h2>').map(
      (heading) => heading.id,
    ),
    ["same-2", "same"],
  );
});

test("generated suffixes skip IDs reserved by later explicit headings", () => {
  assert.deepEqual(
    extractHeadings(
      '## Foo\n\n## Foo\n\n<h2 id="foo-2">Explicit suffix</h2>',
    ).map((heading) => heading.id),
    ["foo", "foo-3", "foo-2"],
  );
});
