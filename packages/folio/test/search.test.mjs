import assert from "node:assert/strict";
import test from "node:test";
import { searchFolioDocs } from "../dist/index.js";

const docs = [
  {
    id: "intro",
    path: "/docs/intro",
    sourcePath: "docs/intro.md",
    type: "doc",
    title: "Folio Introduction",
    description: "Start with the runtime",
    group: "Guide",
    order: 2,
    tags: ["runtime"],
    body: "Git-native content",
    headings: [],
    data: {},
  },
  {
    id: "search",
    path: "/docs/search",
    sourcePath: "docs/search.md",
    type: "doc",
    title: "Search",
    description: "Keyboard search",
    group: "Reference",
    order: 1,
    tags: ["ui", "keyboard"],
    body: "Use Command K or Control K",
    headings: [],
    data: {},
  },
];

test("empty search returns visible content in document order", () => {
  assert.deepEqual(
    searchFolioDocs(docs, "").map((doc) => doc.id),
    ["intro", "search"],
  );
});

test("empty search excludes the home document at /", () => {
  const withHome = [
    {
      ...docs[0],
      id: "home",
      path: "/",
      sourcePath: "index.md",
      title: "Home",
      order: 0,
    },
    ...docs,
  ];
  assert.deepEqual(
    searchFolioDocs(withHome, "").map((doc) => doc.id),
    ["intro", "search"],
  );
});

test("empty search clamps zero and negative limits", () => {
  assert.deepEqual(searchFolioDocs(docs, "", 0), []);
  assert.deepEqual(searchFolioDocs(docs, "", -3), []);
  assert.deepEqual(
    searchFolioDocs(docs, "", 1).map((doc) => doc.id),
    ["intro"],
  );
});

test("search matches title, description, tags, and body", () => {
  assert.equal(searchFolioDocs(docs, "search")[0].id, "search");
  assert.equal(searchFolioDocs(docs, "keyboard")[0].id, "search");
  assert.equal(searchFolioDocs(docs, "git-native")[0].id, "intro");
});

test("title exact matches rank before body-only matches", () => {
  const mixed = [
    ...docs,
    {
      ...docs[0],
      id: "body-search",
      path: "/docs/body-search",
      title: "Other",
      order: 0,
      body: "search",
    },
  ];
  assert.equal(searchFolioDocs(mixed, "search")[0].id, "search");
});
