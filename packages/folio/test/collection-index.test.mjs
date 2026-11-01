import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  folioCollectionIndexes,
  normalizeFolioCollectionPath,
  selectFolioCollectionDocs,
  assertNoFolioCollectionConflicts,
} from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const template = '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>';
const config = {
  title: "My Folio", description: "A site", siteUrl: "https://example.com",
  navigation: [{label: "好物", href: "/projects"}],
  collections: [
    {path: "/blogs", title: "博客", description: "生活里的文字"},
    {path: "/projects/", emptyMessage: "没有好物记录"},
  ],
};
function item(path, type = "article", order = 99, date) {
  return {
    id: path, path, sourcePath: path.slice(1) + ".md", type,
    title: path, description: "Description for " + path,
    group: type, order, date, tags: [], body: "## Body", headings: [], data: {},
  };
}
function fixture(docs = [], fn, siteConfig = config) {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-collection-index-"));
  try {
    writeFileSync(resolve(outDir, "index.html"), template);
    return fn({config:siteConfig, docs, base: "/moyu/", roots: [], outDir});
  } finally {
    rmSync(outDir, {recursive:true, force:true});
  }
}

test("arbitrary route prefixes recursively return full documents with segment boundaries and stable sorting", () => {
  const docs = [
    item("/blogs/nested/second", "page", 8, "2026-01-01"),
    item("/blogs/a", "article", 4, "2026-01-01"),
    item("/blogs/deep/very/deep/post", "project", 1, "2025-03-01"),
    item("/blogs", "page"),
    item("/blogss/spurious"),
    item("/projects/coffee", "project"),
  ];
  const snapshot = docs.slice();
  const entries = selectFolioCollectionDocs(docs, "/blogs/");
  assert.deepEqual(entries.map(d=>d.path), [
    "/blogs/a", "/blogs/nested/second", "/blogs/deep/very/deep/post",
  ]);
  assert.equal(entries[0], docs[1], "selector must preserve full FolioDoc identity and metadata");
  assert.equal(entries[0].body, "## Body");
  assert.deepEqual(docs, snapshot, "selector must not mutate source docs");
  assert.deepEqual(selectFolioCollectionDocs(docs, "/notes"), []);
  assert.equal(normalizeFolioCollectionPath("/notes/ideas/"), "/notes/ideas");
  for (const invalid of ["/","", "notes", "/a//b", "/a/../b", "/a/./b", "/a?b", "/a#b", "/a\\b"]) {
    assert.throws(() => normalizeFolioCollectionPath(invalid), /folio collection path/);
  }
});

test("index configuration comes from consumer routes, without hardcoded names or document types", () => {
  const indexes = folioCollectionIndexes(config);
  assert.deepEqual(indexes.map(x=>x.path), ["/blogs", "/projects"]);
  assert.equal(indexes[0].title, "博客");
  assert.equal(indexes[1].title, "好物");
  assert.equal(indexes[1].emptyMessage, "没有好物记录");
  assert.deepEqual(folioCollectionIndexes({title:"Empty",description:"No indexes"}),[]);
  const nested = folioCollectionIndexes({
    title:"Nested",description:"Nested",
    collections:[{path:"/journal/2026",title:"This Year"}],
  });
  assert.equal(nested[0].path, "/journal/2026");
  assert.throws(() => folioCollectionIndexes({
    title:"Bad",description:"Bad",collections:[{path:"/journal"},{path:"/journal/"}],
  }), /duplicate collection route/);
});

test("static lists and home recursively publish arbitrary configured routes with canonical and sitemap", () => {
  fixture([
    item("/blogs/hello", "article", 2, "2025-04-01"),
    item("/blogs/2026/notes/second", "page", 1, "2026-01-01"),
    item("/projects/coffee", "project"),
    item("/docs/about", "doc"),
  ], (context) => {
    const result = writeFolioStaticSite(context);
    assert.equal(result.routes, 7);
    const blogs = readFileSync(resolve(context.outDir,"blogs/index.html"),"utf8");
    const projects = readFileSync(resolve(context.outDir,"projects/index.html"),"utf8");
    const home = readFileSync(resolve(context.outDir,"index.html"),"utf8");
    const sitemap = readFileSync(resolve(context.outDir,"sitemap.xml"),"utf8");
    assert.match(blogs,/folio-collection-page/);
    assert.match(blogs,/class="folio-entry-list"/);
    assert.doesNotMatch(blogs,/class="folio-card"/);
    assert.match(blogs,/href="\/moyu\/blogs\/2026\/notes\/second\/"/);
    assert.match(blogs,/href="\/moyu\/blogs\/hello\/"/);
    assert.ok(blogs.indexOf("second") < blogs.indexOf("hello"));
    assert.doesNotMatch(blogs,/href="\/moyu\/projects\/coffee\/"/);
    assert.match(projects,/<h1>好物<\/h1>/);
    assert.match(projects,/href="\/moyu\/projects\/coffee\/"/);
    assert.match(home,/folio-journal-home/);
    assert.match(home,/<h2>博客<\/h2>/);
    assert.match(home,/<h2>好物<\/h2>/);
    assert.match(home,/href="\/moyu\/blogs\/"/);
    assert.match(home,/href="\/moyu\/projects\/"/);
    assert.match(home,/href="\/moyu\/blogs\/2026\/notes\/second\/"/);
    assert.match(blogs,/href="https:\/\/example.com\/moyu\/blogs\/"/);
    assert.match(projects,/href="https:\/\/example.com\/moyu\/projects\/"/);
    assert.match(blogs,/"@type":"CollectionPage"/);
    assert.match(sitemap,/https:\/\/example.com\/moyu\/blogs\//);
    assert.match(sitemap,/https:\/\/example.com\/moyu\/projects\//);
    assert.match(readFileSync(resolve(context.outDir,"docs/about/index.html"),"utf8"),/folio-docs-shell/);
  });
});

test("nested indexes work with custom paths, zero entries, and no configured collections", () => {
  fixture([item("/journal/2026/nov/deep/note")], context => {
    writeFolioStaticSite(context);
    assert.match(readFileSync(resolve(context.outDir,"journal/2026/index.html"),"utf8"),
      /href="\/moyu\/journal\/2026\/nov\/deep\/note\/"/);
    assert.match(readFileSync(resolve(context.outDir,"journal/2026/index.html"),"utf8"), /2026 Archive/);
  }, {title:"Journal",description:"J",siteUrl:"https://example.com",collections:[
    {path:"/journal/2026",title:"2026 Archive"},{path:"/other",emptyMessage:"Nothing here"},
  ]});
  fixture([], context => {
    writeFolioStaticSite(context);
    assert.match(readFileSync(resolve(context.outDir,"blogs/index.html"),"utf8"),/这里还没有内容/);
    assert.match(readFileSync(resolve(context.outDir,"projects/index.html"),"utf8"),/没有好物记录/);
  });
  fixture([], context => {
    const r=writeFolioStaticSite(context);
    assert.equal(r.routes,1);
    assert.equal(readFileSync(resolve(context.outDir,"index.html"),"utf8").includes("folio-journal-home"),true);
  }, {title:"Docs only",description:"docs"});
});

test("conflicts rejected before writing and parent/child indexes may both be configured", () => {
  for (const path of ["/blogs", "/blogs/", "/projects", "/projects/"]) {
    const docs = [item(path)];
    assert.throws(() => assertNoFolioCollectionConflicts(docs,config),/collection route conflict/);
    fixture(docs, context => {
      assert.throws(() => writeFolioStaticSite(context),/collection route conflict/);
      assert.equal(readFileSync(resolve(context.outDir,"index.html"),"utf8"),template);
    });
  }
  fixture([item("/notes/2026/a")], context=>{
    writeFolioStaticSite(context);
    assert.match(readFileSync(resolve(context.outDir,"notes/index.html"),"utf8"),/notes\/2026\/a/);
    assert.match(readFileSync(resolve(context.outDir,"notes/2026/index.html"),"utf8"),/notes\/2026\/a/);
  },{title:"N",description:"D",collections:[{path:"/notes"},{path:"/notes/2026"}]});
});
