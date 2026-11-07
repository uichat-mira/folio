import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  FolioPageNav,
  FolioDocsShell,
  getFolioDocNeighbors,
  buildFolioNavigationTree,
  getFolioNavigationNeighbors,
  parseFolioDoc,
} from "../dist/index.js";
import {
  renderFolioStaticProjectShell,
  renderFolioStaticPageNav,
  writeFolioStaticSite,
} from "../dist/vite.js";

function renderPager(props, basename="/folio") {
  return renderToStaticMarkup(createElement(
    MemoryRouter,
    { basename, initialEntries: [basename+"/reference/current"] },
    createElement(FolioPageNav, props),
  ));
}

function fixture(path, title, type, order) {
  return {
    id:path, path, title,
    sourcePath:path.slice(1)+"/index.md",
    type, group:"API",
    collection:type==="doc"?"参考":undefined,
    section:type==="doc"?"构建":undefined,
    description:"", body:"## 详情", headings:[],
    tags:[], data:{}, order,
  };
}
const previous=fixture("/reference/previous", "前文 <一> & 引号", "doc", 1);
const current=fixture("/reference/current", "当前页", "doc", 2);
const next=fixture("/reference/next", "后文", "doc", 3);

test("FolioPageNav is independently composable and keeps Router basename",()=>{
  const html=renderPager({
    previous, next, className:"consumer-pager", ariaLabel:"相邻章节",
  });
  assert.match(html, /^<nav class="folio-page-nav consumer-pager" aria-label="相邻章节">/);
  assert.match(html, /href="\/folio\/reference\/previous"/);
  assert.match(html, /href="\/folio\/reference\/next"/);
  assert.match(html, /前文 &lt;一&gt; &amp; 引号/);
  assert.match(html, /<span>上一篇<\/span>/);
  assert.match(html, /<span>下一篇<\/span>/);
  assert.equal((html.match(/<a /g)||[]).length,2);
});

test("single-sided pagination retains its two-column alignment and never invents a link",()=>{
  const first=renderPager({next});
  assert.match(first, /<nav class="folio-page-nav" aria-label="文档分页"><span><\/span><a class="folio-page-nav__next"/);
  assert.equal((first.match(/<a /g)||[]).length,1);
  const last=renderPager({previous});
  assert.match(last, /<a class="folio-page-nav__previous"/);
  assert.match(last, /<\/a><span><\/span><\/nav>$/);
  assert.equal((last.match(/<a /g)||[]).length,1);
  assert.equal(renderPager({}),"");
});

test("FolioDocsShell composes the same exported pager with collection ordering",()=>{
  const docs=[current,next,previous];
  const neighbors=getFolioDocNeighbors(docs,current);
  assert.equal(neighbors.previous?.path,previous.path);
  assert.equal(neighbors.next?.path,next.path);
  const pager=renderPager(neighbors);
  const shell=renderToStaticMarkup(createElement(
    MemoryRouter,{basename:"/folio",initialEntries:["/folio"+current.path]},
    createElement(FolioDocsShell,{doc:current,docs}),
  ));
  assert.ok(shell.includes(pager), "the shell renders the public component markup");
});

test("static document and project readers use one pager structure and base-safe links",()=>{
  const project=fixture("/projects/atlas","Atlas","project",1);
  const child=fixture("/projects/atlas/story","故事","project",2);
  const sibling=fixture("/projects/other","其他项目","project",1);
  const docs=[current,previous,next,project,child,sibling];
  const directory=mkdtempSync(resolve(tmpdir(),"folio-public-page-nav-"));
  try {
    writeFileSync(resolve(directory,"index.html"),
      '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>');
    const context={
      config:{title:"Folio",description:"Folio test",siteUrl:"https://example.com/folio"},
      docs,roots:[],base:"/folio/",outDir:directory,
    };
    writeFolioStaticSite(context);
    const first=readFileSync(resolve(directory,"reference/previous/index.html"),"utf8");
    const middle=readFileSync(resolve(directory,"reference/current/index.html"),"utf8");
    const last=readFileSync(resolve(directory,"reference/next/index.html"),"utf8");
    assert.match(first, /<nav class="folio-page-nav" aria-label="文档分页"><span><\/span><a class="folio-page-nav__next"/);
    assert.match(first, /href="\/folio\/reference\/current\/"/);
    assert.match(middle, /href="\/folio\/reference\/previous\/"/);
    assert.match(middle, /href="\/folio\/reference\/next\/"/);
    assert.match(last, /<a class="folio-page-nav__previous"/);
    assert.match(last, /<\/a><span><\/span><\/nav>/);
    const projectHtml=renderFolioStaticProjectShell(context,project);
    assert.match(projectHtml, /href="\/folio\/projects\/atlas\/story\/"/);
    const projectPager=projectHtml.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
    assert.doesNotMatch(projectPager, /href="\/folio\/projects\/other\/"/);
    const childHtml=renderFolioStaticProjectShell(context,child);
    assert.match(childHtml, /href="\/folio\/projects\/atlas\/"/);
    assert.doesNotMatch(childHtml.split('<nav class="folio-page-nav"')[1]??"",/projects\/other/);
    const outside=renderFolioStaticProjectShell(context,sibling);
    assert.doesNotMatch(outside, /class="folio-page-nav"/);
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
});

test("static pagination safely escapes titles and never exposes raw markup",()=>{
  const malicious=fixture("/projects/atlas/story","<script>alert('x')</script> & 安全","project",2);
  const parent=fixture("/projects/atlas","Atlas","project",1);
  const context={
    docs:[parent,malicious],roots:[],base:"/folio/",
    config:{title:"Folio",description:"",siteUrl:"https://example.com/folio"},
  };
  const html=renderFolioStaticProjectShell(context,parent);
  const pager=html.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
  assert.match(pager,/&lt;script&gt;/);
  assert.match(pager,/&amp; 安全/);
  assert.doesNotMatch(pager,/<script>/);
});

function referenceSourceDocs() {
  const root=fileURLToPath(new URL("../../../apps/site/content/",import.meta.url));
  return readdirSync(resolve(root,"reference"),{recursive:true})
    .filter((file)=>file.endsWith(".md"))
    .map((file)=>{
      const relative="reference/"+file;
      return parseFolioDoc(relative,readFileSync(resolve(root,relative),"utf8"));
    });
}

test("the last component continues to the Reference Index in the same sidebar order",()=>{
  const docs=referenceSourceDocs();
  const byPath=(path)=>{
    const doc=docs.find((item)=>item.path===path);
    assert.ok(doc,"missing reference document "+path);
    return doc;
  };
  const share=byPath("/reference/components/share-button");
  const index=byPath("/reference/overview");
  const tree=buildFolioNavigationTree(docs,share);
  const last=getFolioNavigationNeighbors(tree,share.path);
  const first=getFolioNavigationNeighbors(buildFolioNavigationTree(docs,index),index.path);
  assert.equal(last.previous?.path,"/reference/components/utility-popover");
  assert.equal(last.next?.path,index.path);
  assert.equal(first.previous?.path,share.path);
  assert.equal(first.next?.path,"/reference/frontmatter");

  const shell=renderToStaticMarkup(createElement(
    MemoryRouter,{basename:"/folio",initialEntries:["/folio"+share.path]},
    createElement(FolioDocsShell,{doc:share,docs}),
  ));
  const pager=shell.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
  assert.match(pager,/href="\/folio\/reference\/overview"/);
  assert.match(pager,/<span>下一篇<\/span><strong>参考索引<\/strong>/);

  const context={
    docs,roots:[],base:"/folio/",
    config:{title:"Folio",description:"",siteUrl:"https://example.com/folio"},
  };
  const staticPage=renderFolioStaticProjectShell(context,share);
  const staticPager=staticPage.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
  assert.match(staticPager,/href="\/folio\/reference\/overview\/"/);
  assert.match(staticPager,/<span>下一篇<\/span><strong>参考索引<\/strong>/);

  // The consumer's static doc renderer uses this shared Vite entry, too.
  const reversePager=renderFolioStaticPageNav(context,index);
  assert.match(reversePager,/href="\/folio\/reference\/components\/share-button\/"/);
  assert.match(reversePager,/<span>上一篇<\/span><strong>FolioShareButton<\/strong>/);
  assert.match(reversePager,/href="\/folio\/reference\/frontmatter\/"/);
});

test("standalone project navigation remains bounded to its own project",()=>{
  const atlas=fixture("/projects/atlas","Atlas","project",1);
  const child=fixture("/projects/atlas/story","故事","project",2);
  const other=fixture("/projects/other","另一项目","project",1);
  const docs=[atlas,child,other];
  const tree=buildFolioNavigationTree(docs,child);
  assert.equal(getFolioNavigationNeighbors(tree,child.path).previous?.path,atlas.path);
  assert.equal(getFolioNavigationNeighbors(tree,child.path).next,undefined);
  assert.equal(getFolioNavigationNeighbors(tree,other.path).previous,undefined);
  assert.deepEqual(getFolioNavigationNeighbors(tree,"/projects/missing"),{});
});

test("an explicit pageNeighbors override remains authoritative",()=>{
  const doc=fixture("/reference/manual","手动指定","doc",1);
  const unrelated=fixture("/guide/elsewhere","跨域目标","doc",2);
  const html=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[doc.path]},
    createElement(FolioDocsShell,{
      doc,docs:[doc],
      pageNeighbors:{next:{path:unrelated.path,title:unrelated.title}},
    }),
  ));
  const pager=html.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
  assert.match(pager,/href="\/guide\/elsewhere"/);
});
