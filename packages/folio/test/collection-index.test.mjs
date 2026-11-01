import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  FOLIO_COLLECTION_INDEXES,
  selectFolioCollectionDocs,
  folioCollectionTitle,
  assertNoFolioCollectionConflicts,
} from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const template = '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>';

function item(path, type, order = 99, date) {
  return {
    id: path, path, sourcePath: path.slice(1) + ".md", type,
    title: path, description: "Description for " + path,
    group: type, order, date, tags: [], body: "## Body", headings: [], data: {},
  };
}

function fixture(docs = [], fn) {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-collection-index-"));
  try {
    writeFileSync(resolve(outDir, "index.html"), template);
    return fn({ config: {
      title: "My Folio", description: "A site", siteUrl: "https://example.com",
      navigation: [{label: "好物", href: "/projects"}],
    }, docs, base: "/moyu/", roots: [], outDir });
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

test("index definitions and selectors are stable and never mutate consumer docs", () => {
  assert.deepEqual(FOLIO_COLLECTION_INDEXES.map(x => x.path), ["/blogs", "/projects"]);
  const docs = [
    item("/blogs/z", "article", 2, "2025-01-01"),
    item("/projects/coffee", "project", 2),
    item("/blogs/b", "article", 9, "2026-01-01"),
    item("/blogs/a", "article", 2, "2026-01-01"),
    item("/docs/about", "doc", 1),
    item("/projects/keyboard", "project", 1),
  ];
  const before = docs.slice();
  assert.deepEqual(selectFolioCollectionDocs(docs, "article").map(d=>d.path), [
    "/blogs/a", "/blogs/b", "/blogs/z",
  ]);
  assert.deepEqual(selectFolioCollectionDocs(docs, "project").map(d=>d.path), [
    "/projects/keyboard", "/projects/coffee",
  ]);
  assert.deepEqual(docs, before);
  assert.equal(folioCollectionTitle({title:"M",description:"D",navigation:[{href:"/projects/",label:"好物"}]},FOLIO_COLLECTION_INDEXES[1]),"好物");
});

test("default static indexes have no-JS cards, escaped links, canonical and sitemap", () => {
  fixture([
    item("/blogs/hello", "article", 2, "2025-04-01"),
    item("/blogs/second", "article", 1, "2024-01-01"),
    item("/projects/coffee", "project"),
    item("/docs/about", "doc"),
  ], (context) => {
    const result = writeFolioStaticSite(context);
    assert.equal(result.routes, 7);
    const blogs = readFileSync(resolve(context.outDir,"blogs/index.html"),"utf8");
    const projects = readFileSync(resolve(context.outDir,"projects/index.html"),"utf8");
    const sitemap = readFileSync(resolve(context.outDir,"sitemap.xml"),"utf8");
    assert.match(blogs, /folio-collection-page/);
    assert.match(blogs, /class="folio-entry-list"/);
    assert.doesNotMatch(blogs, /class="folio-card"/);
    const home = readFileSync(resolve(context.outDir,"index.html"),"utf8");
    assert.match(home, /folio-journal-home/);
    assert.match(home, /最近的文章/);
    assert.match(home, /好物与发现/);
    assert.match(home, /href="\/moyu\/blogs\/"/);
    assert.match(home, /href="\/moyu\/projects\/"/);
    assert.match(home, /href="\/moyu\/blogs\/hello\/"/);
    assert.match(home, /href="\/moyu\/projects\/coffee\/"/);
    assert.doesNotMatch(home, /href="\/moyu\/docs\/about\/"/);

    assert.match(blogs, /href="\/moyu\/blogs\/hello\/"/);
    assert.match(blogs, /href="\/moyu\/blogs\/second\/"/);
    assert.ok(blogs.indexOf("hello") < blogs.indexOf("second"));
    assert.doesNotMatch(blogs, /href="\/moyu\/projects\/coffee\/"/);
    assert.match(projects, /<h1>好物<\/h1>/);
    assert.match(projects, /href="\/moyu\/projects\/coffee\/"/);
    assert.match(blogs, /href="https:\/\/example.com\/moyu\/blogs\/"/);
    assert.match(projects, /href="https:\/\/example.com\/moyu\/projects\/"/);
    assert.match(projects, /"@type":"CollectionPage"/);
    assert.match(blogs, /property="og:title"/);
    assert.match(sitemap, /https:\/\/example.com\/moyu\/blogs\//);
    assert.match(sitemap, /https:\/\/example.com\/moyu\/projects\//);
    assert.match(readFileSync(resolve(context.outDir,"docs/about/index.html"),"utf8"),/folio-docs-shell/);
  });
});

test("empty collections generate useful static index pages", () => {
  fixture([], context => {
    writeFolioStaticSite(context);
    assert.match(readFileSync(resolve(context.outDir,"blogs/index.html"),"utf8"),/还没有发布文章/);
    assert.match(readFileSync(resolve(context.outDir,"projects/index.html"),"utf8"),/这里暂时还没有内容/);
  });
});

test("reserved routes reject conflicts, including trailing slash, before writing", () => {
  for (const path of ["/blogs", "/blogs/", "/projects", "/projects/"]) {
    const docs = [item(path, "article")];
    assert.throws(() => assertNoFolioCollectionConflicts(docs), /collection route conflict/);
    fixture(docs, context => {
      assert.throws(() => writeFolioStaticSite(context), /collection route conflict/);
      assert.equal(readFileSync(resolve(context.outDir,"index.html"),"utf8"),template);
    });
  }
});
