import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  FolioTreeNav, FolioDocsShell, parseFolioDoc,
  buildFolioNavigationTree, getFolioNavigationNeighbors,
} from "../dist/index.js";
import {
  writeFolioStaticSite, renderFolioStaticTreeNav, renderFolioStaticPageNav,
} from "../dist/vite.js";

const doc=(source,title,order)=>parseFolioDoc(source,[
  "---","type: doc","collection: 案例文档","section: 实践",
  'title: "'+title+'"',"order: "+order,
  "description: 案例文档","---","# "+title,"",
  "## 相关讨论","正文。",
].join("\n"));
const overview=doc("projects/com-design/index.md","ComDesign：AI 时代的设计系统实验",2);
const essay=doc("projects/com-design/story/index.md","把重复操作提炼成产品能力",1);
const notes=doc("projects/com-design/notes/index.md","验证笔记",2);
const mira=doc("projects/mira/index.md","UIChat Mira：从本地到个人 AI",1);
const orphan=doc("projects/ungrouped/story/index.md","独立文章",3);
const docs=[notes,orphan,essay,mira,overview];
const navTree=(current,input=docs)=>buildFolioNavigationTree(input,current);
const renderTree=(current,input=docs,options={})=>renderToStaticMarkup(createElement(
  MemoryRouter,{basename:"/folio",initialEntries:["/folio"+current.path]},
  createElement(FolioTreeNav,{tree:navTree(current,input),currentPath:current.path,...options}),
));

test("generic document navigation has authored parent/child URLs under arbitrary routes",()=>{
  const tree=navTree(essay);
  const section=tree.roots.find(x=>x.title==="实践");
  assert.ok(section,"missing document section");
  const parent=section.children.find(x=>x.path===overview.path);
  assert.ok(parent);
  assert.deepEqual(parent.children.map(x=>x.path),[essay.path,notes.path]);
  const html=renderTree(essay,docs,{className:"consumer-tree"});
  assert.match(html,/class="folio-tree-nav folio-tree-nav--sections consumer-tree"/);
  assert.match(html,/aria-label="文档目录"/);
  assert.match(html,/href="\/folio\/projects\/com-design"/);
  assert.match(html,/href="\/folio\/projects\/com-design\/story"/);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/folio\/projects\/ungrouped"/);
  assert.match(html,/独立文章/);
});

test("FolioDocsShell retains TOC, tree navigation and the same document pager",()=>{
  const tree=navTree(essay);
  const neighbors=getFolioNavigationNeighbors(tree,essay.path);
  assert.equal(neighbors.previous?.path,overview.path);
  assert.equal(neighbors.next?.path,notes.path);
  const html=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioDocsShell,{doc:essay,docs}),
  ));
  assert.match(html,/folio-tree-nav__children/);
  assert.match(html,/<h1>把重复操作提炼成产品能力<\/h1>/);
  assert.match(html,/aria-label="本页目录"/);
  assert.match(html,/href="#相关讨论"/);
  assert.match(html,/aria-label="文档分页"/);
  assert.match(html,/href="\/projects\/com-design\/notes"/);
  const pager=html.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0]??"";
  assert.ok(pager);
  assert.doesNotMatch(pager,/\/projects\/mira/);
});

test("default static document output keeps the nested tree, base links and real heading content",()=>{
  const out=mkdtempSync(resolve(tmpdir(),"folio-doc-tree-"));
  try{
    writeFileSync(resolve(out,"index.html"),
      '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>');
    const context={
      config:{title:"Folio",description:"A document publication",siteUrl:"https://example.com/folio"},
      docs,roots:["projects"],base:"/folio/",outDir:out,
    };
    writeFolioStaticSite(context);
    const html=readFileSync(resolve(out,"projects/com-design/story/index.html"),"utf8");
    assert.match(html,/class="folio-tree-nav folio-tree-nav--sections"/);
    assert.match(html,/href="\/folio\/projects\/com-design\/"/);
    assert.match(html,/href="\/folio\/projects\/com-design\/story\/"/);
    assert.match(html,/aria-current="page"/);
    assert.match(html,/aria-label="本页目录"/);
    assert.match(html,/<main class="folio-doc-main"><h1>把重复操作提炼成产品能力<\/h1>/);
    assert.match(html,/<nav class="folio-page-nav"/);
    const lone=readFileSync(resolve(out,"projects/ungrouped/story/index.html"),"utf8");
    assert.doesNotMatch(lone,/href="\/folio\/projects\/ungrouped\/"/);
    assert.match(lone,/独立文章/);
    const nav=renderFolioStaticTreeNav(context,essay);
    assert.match(nav,/folio-tree-nav__children/);
    assert.match(renderFolioStaticPageNav(context,essay),/href="\/folio\/projects\/com-design\/notes\/"/);
  }finally{rmSync(out,{recursive:true,force:true});}
});

test("TreeNav keeps disclosure controls and active ancestry for ordinary docs",()=>{
  const html=renderTree(essay);
  assert.match(html,/class="folio-tree-nav__symbol" aria-hidden="true">−<\/span>/);
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/aria-controls="/);
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/href="\/folio\/projects\/com-design"/);
  assert.match(html,/href="\/folio\/projects\/com-design\/story"/);
  const child=doc("projects/mira/a-story/index.md","另一个项目的文章",1);
  const withSibling=renderTree(essay,[...docs,child]);
  assert.match(withSibling,/class="folio-tree-nav__symbol" aria-hidden="true">\+<\/span>/);
  assert.match(withSibling,/aria-expanded="false"/);
  assert.match(withSibling,/data-expanded="false" aria-hidden="true" inert=""/);
  assert.match(withSibling,/href="\/folio\/projects\/mira\/a-story"/);
});

test("defaultExpanded opens authored branches; noncollapsible keeps the structure",()=>{
  const html=renderTree(essay,docs,{defaultExpanded:true});
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/aria-controls="/);
  assert.doesNotMatch(html,/data-expanded="false"/);
  const open=renderTree(essay,docs,{defaultExpanded:true,collapsible:false});
  assert.doesNotMatch(open,/folio-tree-nav__toggle/);
  assert.match(open,/href="\/folio\/projects\/com-design\/notes"/);
});

test("noncollapsible tree never hides unrelated authored descendants",()=>{
  const child=doc("projects/mira/a-story/index.md","Mira 子文章",1);
  const html=renderTree(essay,[...docs,child],{collapsible:false});
  assert.doesNotMatch(html,/folio-tree-nav__toggle/);
  assert.doesNotMatch(html,/data-expanded="false"/);
  assert.doesNotMatch(html,/aria-hidden="true" inert=""/);
  assert.match(html,/href="\/folio\/projects\/mira\/a-story"/);
});

test("React and static document trees share nesting markup and link targets",()=>{
  const context={docs,roots:[],base:"/folio/",outDir:"",config:{title:"Folio",description:""}};
  const react=renderTree(essay);
  const staticNav=renderFolioStaticTreeNav(context,essay);
  for(const html of [react,staticNav]){
    assert.match(html,/class="folio-tree-nav__reveal"/);
    assert.match(html,/class="folio-tree-nav__reveal-inner"/);
    assert.match(html,/class="folio-tree-nav__children"/);
    assert.match(html,/href="\/folio\/projects\/com-design\/story/);
  }
});

test("an article in the same route directory does not join the doc sidebar",()=>{
  const outsider={...essay,id:"article",path:"/projects/com-design/news",type:"article"};
  const tree=navTree(essay,[...docs,outsider]);
  assert.ok(!JSON.stringify(tree.roots).includes(outsider.path));
  assert.deepEqual(navTree(outsider,[...docs,outsider]).roots,[]);
});
