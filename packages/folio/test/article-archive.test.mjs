import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  folioArticleArchiveSlug,
  normalizeFolioArticleArchiveId,
} from "../dist/index.js";

function article(overrides = {}) {
  const path = overrides.path ?? "/blogs/untitled";
  return {
    id: overrides.id ?? path,
    path,
    sourcePath: overrides.sourcePath ?? `${path.slice(1)}.md`,
    type: overrides.type ?? "article",
    title: overrides.title ?? path,
    description: "",
    group: overrides.group ?? "博客",
    collection: overrides.collection,
    section: overrides.section,
    order: overrides.order ?? 99,
    date: overrides.date,
    tags: overrides.tags ?? [],
    category: overrides.category,
    body: overrides.body ?? "## Body",
    headings: overrides.headings ?? [],
    data: overrides.data ?? {},
  };
}

function summary(index) {
  return {
    categories: index.categories.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      docs: group.docs.map((doc) => doc.path),
    })),
    tags: index.tags.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      docs: group.docs.map((doc) => doc.path),
    })),
    uncategorized: index.uncategorized.map((doc) => doc.path),
    untagged: index.untagged.map((doc) => doc.path),
  };
}

// FOL-040 (#162): pure Article category/tag archive contract. These tests cover
// the acceptance edges: no category, no tags, multiple tags, duplicates/casing,
// Chinese, URL identifier safety, multi-collection scope, non-article types,
// ordering, old-data compatibility and conflict errors.
test("only type: article enters category and tag archives", () => {
  const docs = [
    article({ path: "/blogs/a", category: "Frontend", tags: ["React"] }),
    article({ path: "/docs/x", type: "doc", category: "Frontend", tags: ["React"] }),
    article({ path: "/pages/y", type: "page", category: "Frontend", tags: ["React"] }),
    article({ path: "/projects/z", type: "project", category: "Frontend", tags: ["React"] }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.deepEqual(index.categories.map((group) => group.id), ["frontend"]);
  assert.deepEqual(index.categories[0].docs.map((doc) => doc.path), ["/blogs/a"]);
  assert.deepEqual(index.tags.map((group) => group.id), ["react"]);
  assert.deepEqual(index.tags[0].docs.map((doc) => doc.path), ["/blogs/a"]);
  assert.deepEqual(index.uncategorized, []);
  assert.deepEqual(index.untagged, []);
});

test("articles without a category or tags stay uncategorized and untagged", () => {
  const docs = [
    article({ path: "/blogs/older", date: "2026-01-01" }),
    article({ path: "/blogs/newer", date: "2026-02-01" }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.deepEqual(index.categories, []);
  assert.deepEqual(index.tags, []);
  assert.deepEqual(index.uncategorized.map((doc) => doc.path), [
    "/blogs/newer",
    "/blogs/older",
  ]);
  assert.deepEqual(index.untagged.map((doc) => doc.path), [
    "/blogs/newer",
    "/blogs/older",
  ]);
});

test("one article appears in every matching tag group with its full document", () => {
  const source = article({
    path: "/blogs/a",
    date: "2026-02-01",
    tags: ["React", "Runtime"],
    body: "## Keep my body",
    data: { custom: "value" },
  });
  const other = article({ path: "/blogs/b", date: "2026-01-01", tags: ["react"] });

  const index = buildFolioArticleArchiveIndex([source, other]);

  assert.deepEqual(index.tags.map((group) => group.id), ["react", "runtime"]);
  const react = index.tags.find((group) => group.id === "react");
  assert.equal(react.docs[0], source, "archive groups must return the original FolioDoc");
  assert.equal(react.docs[0].body, "## Keep my body");
  assert.deepEqual(react.docs[0].data, { custom: "value" });
  assert.deepEqual(react.docs.map((doc) => doc.path), ["/blogs/a", "/blogs/b"]);
  assert.deepEqual(
    index.tags.find((group) => group.id === "runtime").docs.map((doc) => doc.path),
    ["/blogs/a"],
  );
});

test("case and whitespace variants merge into one stable identity", () => {
  const docs = [
    article({
      path: "/blogs/new",
      date: "2026-03-01",
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/blogs/mid",
      date: "2026-02-01",
      category: "frontend",
      tags: ["react"],
    }),
    article({
      path: "/blogs/old",
      date: "2026-01-01",
      category: "  FrontEnd  ",
      tags: ["  REACT "],
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.equal(index.categories.length, 1);
  assert.equal(index.categories[0].id, "frontend");
  assert.equal(index.categories[0].slug, "frontend");
  assert.equal(index.categories[0].title, "Frontend");
  assert.deepEqual(index.categories[0].docs.map((doc) => doc.path), [
    "/blogs/new",
    "/blogs/mid",
    "/blogs/old",
  ]);

  assert.equal(index.tags.length, 1);
  assert.equal(index.tags[0].id, "react");
  assert.equal(index.tags[0].slug, "react");
  assert.equal(index.tags[0].title, "React");
  assert.deepEqual(index.tags[0].docs.map((doc) => doc.path), [
    "/blogs/new",
    "/blogs/mid",
    "/blogs/old",
  ]);
});

test("Chinese categories and tags keep readable ids and URL identifiers", () => {
  const docs = [
    article({
      path: "/blogs/zh",
      date: "2026-02-01",
      category: "前端",
      tags: ["机器 学习"],
    }),
    article({
      path: "/blogs/zh-web",
      date: "2026-01-01",
      category: "前端 Web",
      tags: ["前端开发"],
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.deepEqual(
    index.categories.map((group) => [group.id, group.slug, group.title]),
    [
      ["前端", "前端", "前端"],
      ["前端 web", "前端-web", "前端 Web"],
    ],
  );
  assert.equal(index.tags[0].id, "前端开发");
  assert.equal(index.tags[0].slug, "前端开发");
  assert.equal(encodeURIComponent(index.categories[0].slug), "%E5%89%8D%E7%AB%AF");
});

test("URL identifiers normalize, and different labels never silently share one", () => {
  assert.equal(normalizeFolioArticleArchiveId("  Frontend  "), "frontend");
  assert.equal(normalizeFolioArticleArchiveId("前端"), "前端");
  assert.equal(normalizeFolioArticleArchiveId("Machine  Learning"), "machine learning");
  assert.equal(folioArticleArchiveSlug("前端 Web"), "前端-web");
  assert.equal(folioArticleArchiveSlug("C++"), "c");
  assert.equal(folioArticleArchiveSlug("C#"), "c");
  assert.equal(folioArticleArchiveSlug("!!!"), "");

  // A single valid label still gets a routable identifier.
  const single = buildFolioArticleArchiveIndex([
    article({ path: "/blogs/cpp", category: "C++" }),
  ]);
  assert.equal(single.categories[0].slug, "c");

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex([
        article({ path: "/blogs/cpp", category: "C++" }),
        article({ path: "/blogs/csharp", category: "C#" }),
      ]),
    /category URL identifier collision: "c" is shared by "c\+\+" and "c#"/,
  );

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex([
        article({ path: "/blogs/dash", category: "Front End" }),
        article({ path: "/blogs/hyphen", category: "front-end" }),
      ]),
    /category URL identifier collision: "front-end"/,
  );

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex([
        article({ path: "/blogs/punctuation", category: "!!!" }),
      ]),
    /category "!!!" has no URL-safe identifier/,
  );

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex([
        article({ path: "/blogs/a", tags: ["C++"] }),
        article({ path: "/blogs/b", tags: ["C#"] }),
      ]),
    /tag URL identifier collision: "c"/,
  );

  // Non-article documents never enter the archive, so their labels cannot
  // trigger a conflict.
  assert.doesNotThrow(() =>
    buildFolioArticleArchiveIndex([
      article({ path: "/docs/cpp", type: "doc", category: "C++" }),
      article({ path: "/docs/csharp", type: "doc", category: "C#" }),
    ]),
  );
});

test("a category display-name override changes only the label, not identity or routing", () => {
  const docs = [
    article({
      path: "/blogs/a",
      date: "2026-01-01",
      category: "Frontend",
      tags: ["React"],
    }),
  ];

  const byId = buildFolioArticleArchiveIndex(docs, {
    categoryLabels: { frontend: "前端开发" },
  }).categories[0];
  assert.equal(byId.id, "frontend");
  assert.equal(byId.slug, "frontend");
  assert.equal(byId.title, "前端开发");
  assert.deepEqual(byId.docs.map((doc) => doc.path), ["/blogs/a"]);

  const bySourceSpelling = buildFolioArticleArchiveIndex(docs, {
    categoryLabels: { Frontend: "前端开发" },
  }).categories[0];
  assert.deepEqual(
    { id: bySourceSpelling.id, slug: bySourceSpelling.slug, title: bySourceSpelling.title },
    { id: "frontend", slug: "frontend", title: "前端开发" },
  );

  // Empty overrides and overrides for categories absent from the input fall
  // back to the source spelling.
  assert.equal(
    buildFolioArticleArchiveIndex(docs, {
      categoryLabels: { frontend: "   " },
    }).categories[0].title,
    "Frontend",
  );
  assert.equal(
    buildFolioArticleArchiveIndex(docs, {
      categoryLabels: { unrelated: "无关" },
    }).categories[0].title,
    "Frontend",
  );

  // The builder accepts the same `true` / `false` shape as the collection
  // option; both mean "use the source labels".
  assert.equal(buildFolioArticleArchiveIndex(docs, true).categories[0].title, "Frontend");
  assert.equal(buildFolioArticleArchiveIndex(docs, false).categories[0].title, "Frontend");

  // Tag presentation never depends on the category display configuration.
  assert.equal(
    buildFolioArticleArchiveIndex(docs, {
      categoryLabels: { frontend: "前端开发" },
    }).tags[0].title,
    "React",
  );
});

test("conflicting or duplicate category display labels fail explicitly", () => {
  const docs = [
    article({ path: "/blogs/a", date: "2026-02-01", category: "Frontend" }),
    article({ path: "/blogs/b", date: "2026-01-01", category: "Backend" }),
  ];

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex(docs, {
        categoryLabels: { Frontend: "前端", frontend: "后端" },
      }),
    /conflicting category display labels for "frontend"/,
  );

  // Repeating the same override under different spellings is harmless.
  assert.equal(
    buildFolioArticleArchiveIndex(docs, {
      categoryLabels: { Frontend: "前端", frontend: "前端" },
    }).categories.find((group) => group.id === "frontend").title,
    "前端",
  );

  assert.throws(
    () =>
      buildFolioArticleArchiveIndex(docs, {
        categoryLabels: { frontend: "同名", backend: "同名" },
      }),
    /duplicate category display label "同名" for .*"frontend" and .*"backend"/,
  );

  // A fallback label colliding with another category's override is also a
  // configuration that would show two archives with one name.
  assert.throws(
    () =>
      buildFolioArticleArchiveIndex(docs, {
        categoryLabels: { backend: "Frontend" },
      }),
    /duplicate category display label "Frontend"/,
  );
});

test("archives span multiple collections from the caller's document set", () => {
  const docs = [
    article({
      path: "/blogs/a",
      date: "2026-02-01",
      collection: "Blogs",
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/notes/b",
      date: "2026-01-01",
      collection: "Notes",
      category: "Frontend",
      tags: ["React"],
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.equal(index.categories.length, 1);
  assert.deepEqual(index.categories[0].docs.map((doc) => doc.path), [
    "/blogs/a",
    "/notes/b",
  ]);
  assert.deepEqual(index.tags[0].docs.map((doc) => doc.path), [
    "/blogs/a",
    "/notes/b",
  ]);
});

test("article ordering and group ordering are deterministic", () => {
  const docs = [
    article({
      path: "/blogs/newest",
      date: "2026-03-01",
      order: 9,
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/blogs/undated",
      order: 2,
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/blogs/oldest",
      date: "2026-01-01",
      order: 1,
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/blogs/tie-b",
      date: "2026-02-01",
      order: 1,
      category: "Backend",
      tags: ["Runtime"],
    }),
    article({
      path: "/blogs/tie-a",
      date: "2026-02-01",
      order: 1,
      category: "前端",
      tags: ["数据库"],
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  // Date descending, missing dates last, then order, then stable path.
  assert.deepEqual(
    index.categories
      .find((group) => group.id === "frontend")
      .docs.map((doc) => doc.path),
    ["/blogs/newest", "/blogs/oldest", "/blogs/undated"],
  );
  // Groups by URL identifier in code-point order, independent of array order.
  assert.deepEqual(index.categories.map((group) => group.slug), [
    "backend",
    "frontend",
    "前端",
  ]);
  assert.deepEqual(index.tags.map((group) => group.slug), [
    "react",
    "runtime",
    "数据库",
  ]);

  // Same document set, reversed input: identical archive model.
  assert.deepEqual(
    summary(buildFolioArticleArchiveIndex([...docs].reverse())),
    summary(index),
  );
});

test("documents with equal dates and orders keep a stable path tie-break", () => {
  const docs = [
    article({
      path: "/blogs/b",
      date: "2026-02-01",
      order: 1,
      category: "Frontend",
    }),
    article({
      path: "/blogs/a",
      date: "2026-02-01",
      order: 1,
      category: "Frontend",
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);
  assert.deepEqual(index.categories[0].docs.map((doc) => doc.path), [
    "/blogs/a",
    "/blogs/b",
  ]);
});

test("empty values and repeated tags inside one article are handled deterministically", () => {
  const docs = [
    article({
      path: "/blogs/empty",
      date: "2026-02-01",
      category: "   ",
      tags: ["", "   "],
    }),
    article({
      path: "/blogs/duplicated",
      date: "2026-01-01",
      category: "",
      tags: ["React", "react", "  REACT  ", "Runtime"],
    }),
  ];

  const index = buildFolioArticleArchiveIndex(docs);

  assert.deepEqual(index.categories, []);
  assert.deepEqual(index.uncategorized.map((doc) => doc.path), [
    "/blogs/empty",
    "/blogs/duplicated",
  ]);
  assert.deepEqual(index.untagged.map((doc) => doc.path), ["/blogs/empty"]);
  assert.equal(index.tags.find((group) => group.id === "react").docs.length, 1);
  assert.equal(
    index.tags.find((group) => group.id === "react").docs[0].path,
    "/blogs/duplicated",
  );
});

test("the archive model resolves groups by URL identifier or canonical id", () => {
  const docs = [
    article({
      path: "/blogs/a",
      date: "2026-02-01",
      category: "Frontend",
      tags: ["React"],
    }),
    article({
      path: "/blogs/b",
      date: "2026-01-01",
      category: "前端",
      tags: ["数据库"],
    }),
  ];
  const index = buildFolioArticleArchiveIndex(docs);

  assert.equal(findFolioArticleArchiveGroup(index, "category", "frontend").id, "frontend");
  assert.equal(findFolioArticleArchiveGroup(index, "category", "Frontend").id, "frontend");
  assert.equal(findFolioArticleArchiveGroup(index, "category", "前端").id, "前端");
  assert.equal(findFolioArticleArchiveGroup(index, "tag", "React").id, "react");
  assert.equal(findFolioArticleArchiveGroup(index, "tag", "react").slug, "react");
  assert.equal(findFolioArticleArchiveGroup(index, "category", "missing"), undefined);
  assert.equal(findFolioArticleArchiveGroup(index, "category", "   "), undefined);
  assert.equal(findFolioArticleArchiveGroup(index, "tag", "frontend"), undefined);
});
