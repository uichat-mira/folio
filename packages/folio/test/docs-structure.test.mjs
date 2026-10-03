import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFolioDocStructure,
  getFolioDocNeighbors,
} from "../dist/index.js";

function doc(overrides) {
  return {
    id: overrides.id,
    path: overrides.path,
    sourcePath: overrides.path.slice(1) + ".md",
    type: "doc",
    title: overrides.title,
    description: "",
    group: overrides.group || "Guide",
    collection: overrides.collection,
    section: overrides.section,
    order: overrides.order,
    tags: [],
    body: "",
    headings: [],
    data: {},
  };
}

const docs = [
  doc({
    id: "intro",
    path: "/intro",
    title: "Intro",
    collection: "Core",
    section: "Start",
    order: 1,
  }),
  doc({
    id: "install",
    path: "/install",
    title: "Install",
    collection: "Core",
    section: "Start",
    order: 2,
  }),
  doc({
    id: "runtime",
    path: "/runtime",
    title: "Runtime",
    collection: "Core",
    section: "Runtime",
    order: 3,
  }),
];

test("document structure groups collection and section without source-path inference", () => {
  const structure = buildFolioDocStructure(docs);
  assert.equal(structure.collections.length, 1);
  assert.equal(structure.collections[0].title, "Core");
  assert.deepEqual(
    structure.collections[0].sections.map((section) => section.title),
    ["Start", "Runtime"],
  );
});

test("document neighbors follow the structured navigation order", () => {
  const neighbors = getFolioDocNeighbors(docs, docs[1]);
  assert.equal(neighbors.previous?.id, "intro");
  assert.equal(neighbors.next?.id, "runtime");
});

test("group remains the section fallback for existing content", () => {
  const legacy = doc({
    id: "legacy",
    path: "/legacy",
    title: "Legacy",
    group: "Reference",
    order: 1,
  });
  const structure = buildFolioDocStructure([legacy]);
  assert.equal(structure.collections[0].title, "文档");
  assert.equal(structure.collections[0].sections[0].title, "Reference");
});
