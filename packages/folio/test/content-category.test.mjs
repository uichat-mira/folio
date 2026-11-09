import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseFolioDoc } from "../dist/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function frontmatter(fields) {
  return `---\n${fields}\n---\n## Body\n`;
}

// FOL-040 (#162): `category` is one optional Article archive dimension. These
// tests pin the parser contract: old content keeps exactly its previous shape,
// empty values mean uncategorized and invalid shapes resolve deterministically
// instead of being stringified into a guessed category.
test("category is a single optional Article frontmatter value", () => {
  const doc = parseFolioDoc(
    "blogs/hello.md",
    frontmatter("title: Hello\ntype: article\ncategory: Frontend"),
  );

  assert.equal(doc.category, "Frontend");
  assert.equal(doc.type, "article");
  assert.equal(doc.path, "/blogs/hello");
});

test("content without category keeps the previous contract", () => {
  const legacyArticle = parseFolioDoc(
    "blogs/legacy.md",
    frontmatter(
      'title: Legacy\ndate: 2026-01-01\ngroup: 博客\ntags: React | Runtime',
    ),
  );

  assert.equal(legacyArticle.category, undefined);
  assert.deepEqual(legacyArticle.tags, ["React", "Runtime"]);
  assert.equal(legacyArticle.path, "/blogs/legacy");
  assert.equal(legacyArticle.type, "article");
  assert.equal(legacyArticle.group, "博客");

  const legacyDoc = parseFolioDoc(
    "docs/runtime.md",
    frontmatter(
      'title: Runtime\ncollection: Core docs\nsection: Runtime\ngroup: Guide\ntags:\n  - one\n  - two',
    ),
  );

  assert.equal(legacyDoc.category, undefined);
  assert.deepEqual(legacyDoc.tags, ["one", "two"]);
  assert.equal(legacyDoc.collection, "Core docs");
  assert.equal(legacyDoc.section, "Runtime");
});

test("empty category means uncategorized", () => {
  for (const category of ['""', "''", '"   "']) {
    const doc = parseFolioDoc(
      "blogs/empty.md",
      frontmatter(`title: Empty\ncategory: ${category}`),
    );
    assert.equal(doc.category, undefined, `category ${category} must be unset`);
  }
});

test("invalid category shapes resolve to uncategorized without guessing", () => {
  const shapes = [
    "category:\n  - Frontend",
    "category:\n  - Frontend\n  - Backend",
    "category:\n  name: Frontend",
    "category: 2026",
    "category: true",
  ];

  for (const shape of shapes) {
    const doc = parseFolioDoc(
      "blogs/invalid.md",
      frontmatter(`title: Invalid\n${shape}`),
    );
    assert.equal(
      doc.category,
      undefined,
      `invalid category shape must resolve to uncategorized: ${JSON.stringify(shape)}`,
    );
    // The raw frontmatter stays available in `data`; only the typed field is
    // normalized. Parsing itself never throws for an invalid category shape.
    assert.ok("category" in doc.data);
  }
});

test("category does not change collection, group, section, route or tags", () => {
  const doc = parseFolioDoc(
    "blogs/in-collection.md",
    frontmatter(
      "title: In collection\ntype: article\ncategory: Frontend\ncollection: Blogs\nsection: Notes\ngroup: 博客\ntags: [React]",
    ),
  );

  assert.equal(doc.category, "Frontend");
  assert.equal(doc.path, "/blogs/in-collection");
  assert.equal(doc.collection, "Blogs");
  assert.equal(doc.section, "Notes");
  assert.equal(doc.group, "博客");
  assert.deepEqual(doc.tags, ["React"]);
});

test("content schema documents the category and tag contract", () => {
  const schema = JSON.parse(
    readFileSync(join(repoRoot, "schemas", "content.schema.json"), "utf8"),
  );

  assert.equal(schema.properties.category.type, "string");
  assert.match(
    schema.properties.category.description,
    /uncategorized/,
    "the schema must document the empty-value rule",
  );
  assert.equal(schema.properties.tags.type, "array");
  assert.deepEqual(schema.properties.tags.items, { type: "string" });
  assert.equal(schema.additionalProperties, true);
});
