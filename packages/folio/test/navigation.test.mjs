import assert from "node:assert/strict";
import test from "node:test";
import { getFolioDocNeighbors } from "../dist/index.js";

function doc(id, sourcePath, order) {
  return {
    id,
    path: "/" + id,
    sourcePath,
    type: "doc",
    title: id,
    description: "",
    group: "Guide",
    order,
    tags: [],
    body: "",
    headings: [],
    data: {},
  };
}

const docs = [
  doc("docs-a", "docs/a.md", 1),
  doc("docs-b", "docs/b.md", 2),
  doc("blogs-a", "blogs/a.md", 1),
];

test("document neighbors stay inside the same content root", () => {
  const middle = getFolioDocNeighbors(docs, docs[1]);
  assert.equal(middle.previous?.id, "docs-a");
  assert.equal(middle.next, undefined);

  const first = getFolioDocNeighbors(docs, docs[0]);
  assert.equal(first.previous, undefined);
  assert.equal(first.next?.id, "docs-b");
});

test("unlisted document has no neighbors", () => {
  assert.deepEqual(
    getFolioDocNeighbors(docs, doc("other", "docs/other.md", 3)),
    {},
  );
});
