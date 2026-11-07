import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FolioToc,
  buildFolioOutlineTree,
  extractHeadings,
} from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const headings = [
  {depth:2,text:"开篇",id:"intro"},
  {depth:3,text:"细节与回答",id:"details"},
  {depth:4,text:"继续向下",id:"deeper"},
];
const doc = (path, type, h=extractHeadings("## 开篇\n\n### 细节与回答\n\n#### 继续向下")) => ({
  id:path,path,sourcePath:path.slice(1)+".md",title:"一篇长文",description:"文章说明",
  type,group:"博客",order:1,date:"2026-11-01",tags:[],body:
    "## 开篇\n\n第一段。\n\n### 细节与回答\n\n第二段。\n\n#### 继续向下\n\n第三段。",
  headings:h,data:{},
});

test("outline tree nests headings by level and keeps skipped levels attached", () => {
  const tree = buildFolioOutlineTree([
    {depth:2,text:"开篇",id:"intro"},
    {depth:3,text:"细节",id:"details"},
    {depth:4,text:"更细",id:"deeper"},
    {depth:2,text:"下一章",id:"next"},
    {depth:5,text:"忽略",id:"ignored"},
  ]);
  assert.equal(tree.length,2);
  assert.equal(tree[0].id,"intro");
  assert.equal(tree[0].children[0].id,"details");
  assert.equal(tree[0].children[0].children[0].id,"deeper");
  assert.equal(tree[1].id,"next");
  assert.equal(tree[1].children.length,0);

  const skipped = buildFolioOutlineTree([
    {depth:2,text:"章",id:"chapter"},
    {depth:4,text:"跳级",id:"jump"},
  ]);
  assert.equal(skipped[0].children[0].id,"jump");
});

test("public FolioToc renders a nested outline with accessible anchor links", () => {
  const html = renderToStaticMarkup(
    React.createElement(FolioToc,{headings}),
  );
  assert.match(html,/class="folio-toc" aria-label="本页目录"/);
  assert.match(html,/class="folio-toc__content"/);
  assert.match(html,/class="folio-toc__list"/);
  assert.match(html,/class="folio-toc__list folio-toc__list--nested"/);
  assert.match(html,/href="#intro"/);
  assert.match(html,/href="#details"/);
  assert.match(html,/href="#deeper"/);
  assert.match(html,/title="细节与回答"/);
  assert.match(html,/folio-toc-depth-3/);
  const custom = renderToStaticMarkup(
    React.createElement(FolioToc,{headings,title:"大纲"}),
  );
  assert.match(custom,/aria-label="大纲"/);
  assert.match(custom,/<h2>大纲<\/h2>/);
  assert.equal(renderToStaticMarkup(React.createElement(FolioToc,{headings:[]})),"");
});

test("article static TOC and mobile native disclosure use exact markdown headings", () => {
  const outDir=mkdtempSync(resolve(tmpdir(),"folio-toc-"));
  const config={title:"Test site",description:"",siteUrl:"https://example.test"};
  try {
    writeFileSync(resolve(outDir,"index.html"),"<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>");
    writeFolioStaticSite({outDir,config,base:"/moyu/",docs:[
      doc("/blogs/long","article"),
      doc("/blogs/short","article",[]),
      doc("/docs/guide","doc"),
    ],roots:[]});
    const long=readFileSync(resolve(outDir,"blogs/long/index.html"),"utf8");
    const short=readFileSync(resolve(outDir,"blogs/short/index.html"),"utf8");
    const guide=readFileSync(resolve(outDir,"docs/guide/index.html"),"utf8");
    assert.match(long,/class="folio-article-layout"/);
    assert.match(long,/<details class="folio-article-mobile-toc"><summary>本页目录<\/summary>/);
    assert.equal((long.match(/aria-label="本页目录"/g)||[]).length,2);
    for(const id of doc("/blogs/long","article").headings.map(h=>h.id)) {
      assert.equal((long.match(new RegExp('href="#'+id+'"',"g"))||[]).length>=2,true);
      assert.match(long,new RegExp('id="'+id+'"'),"each TOC link must have a real target");
    }
    assert.doesNotMatch(short,/folio-article-layout/);
    assert.doesNotMatch(short,/folio-article-mobile-toc/);
    assert.match(guide,/class="folio-docs-shell"/);
    assert.match(guide,/class="folio-toc__content"/);
    assert.match(guide,/class="folio-toc__list folio-toc__list--nested"/);
    assert.equal((guide.match(/aria-label="本页目录"/g)||[]).length>=1,true);
    assert.doesNotMatch(guide,/folio-article-layout/);
    assert.match(long,/href="https:\/\/example.test\/moyu\/blogs\/long\/"/);
  } finally {
    rmSync(outDir,{recursive:true,force:true});
  }
});
