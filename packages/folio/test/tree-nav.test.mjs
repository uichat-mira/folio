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
  resolveFolioProjectTree, getFolioTreeNeighbors,
} from "../dist/index.js";
import {
  writeFolioStaticSite,
  renderFolioStaticProjectShell,
} from "../dist/vite.js";

const doc = (path, title, order) =>
  parseFolioDoc(path, [
    "---", "type: project", 'title: "' + title + '"', "order: " + order,
    "description: 项目内容", "---", "# " + title, "",
    "## 相关讨论", "正文。",
  ].join("\n"));

const overview = doc("projects/com-design/index.md", "ComDesign：AI 时代的设计系统实验", 2);
const essay = doc("projects/com-design/story/index.md", "把重复操作提炼成产品能力", 1);
const notes = doc("projects/com-design/notes/index.md", "验证笔记", 2);
const mira = doc("projects/mira/index.md", "UIChat Mira：从本地到个人 AI", 1);
const orphan = doc("projects/ungrouped/story/index.md", "独立文章", 3);
const docs = [notes, orphan, essay, mira, overview];

test("tree component renders browsable project overview and child article with base-safe URLs", () => {
  const tree = resolveFolioProjectTree(docs, essay);
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { basename: "/folio", initialEntries: ["/folio" + essay.path] },
    createElement(FolioTreeNav, { tree, currentPath: essay.path, className: "consumer-tree" }),
  ));
  assert.match(html, /class="folio-tree-nav consumer-tree"/);
  assert.match(html, /aria-label="项目目录"/);
  assert.match(html, /folio-tree-nav__eyebrow">ComDesign/);
  assert.match(html, /folio-tree-nav__title">AI 时代的设计系统实验/);
  assert.match(html, /href="\/folio\/projects\/com-design"/);
  assert.match(html, /href="\/folio\/projects\/com-design\/story"/);
  assert.match(html, /class="active" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /<div class="folio-tree-nav__overview folio-tree-nav__overview--directory">/);
  assert.doesNotMatch(html, /href="\/folio\/projects\/ungrouped"/);
  assert.match(html, /独立文章/);
});

test("project tree shell keeps the current page TOC and project-local pager", () => {
  const tree = resolveFolioProjectTree(docs, essay);
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [essay.path] },
    createElement(FolioDocsShell, {
      doc: essay, docs, pageNeighbors: getFolioTreeNeighbors(tree, essay.path),
      renderNav(props) {
        return createElement(FolioTreeNav, {
          tree: props.tree, currentPath: props.currentPath, onNavigate: props.onNavigate,
        });
      },
    }),
  ));
  assert.match(html, /class="folio-tree-nav__children"/);
  assert.match(html, /<h1>把重复操作提炼成产品能力<\/h1>/);
  assert.match(html, /aria-label="本页目录"/);
  assert.match(html, /href="#相关讨论"/);
  assert.match(html, /aria-label="文档分页"/);
  assert.match(html, /href="\/projects\/com-design\/notes"/);
  const pager = html.split('<nav class="folio-page-nav"')[1]?.split("</nav>")[0] ?? "";
  assert.ok(pager, "project pager exists");
  assert.doesNotMatch(pager, /\/projects\/mira/);
});

test("core static project reader uses the same tree, avoids broken folder links and scopes pager", () => {
  const out = mkdtempSync(resolve(tmpdir(), "folio-tree-nav-"));
  try {
    writeFileSync(resolve(out, "index.html"),
      '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>');
    const context = {
      config: { title: "Folio", description: "A project publication", siteUrl: "https://example.com/folio" },
      docs, roots: ["projects"], base: "/folio/", outDir: out,
    };
    writeFolioStaticSite(context);
    const article = readFileSync(resolve(out, "projects/com-design/story/index.html"), "utf8");
    const parent = readFileSync(resolve(out, "projects/com-design/index.html"), "utf8");
    const missing = readFileSync(resolve(out, "projects/ungrouped/story/index.html"), "utf8");
    assert.match(article, /class="folio-tree-nav"/);
    assert.match(article, /href="\/folio\/projects\/com-design\/"/);
    assert.match(article, /href="\/folio\/projects\/com-design\/story\/"/);
    assert.match(article, /aria-current="page"/);
    assert.match(article, /aria-label="本页目录"/);
    assert.match(article, /<main class="folio-doc-main"><h1>把重复操作提炼成产品能力<\/h1>/);
    assert.match(article, /<nav class="folio-page-nav"/);
    assert.match(parent, /class="folio-tree-nav__eyebrow">ComDesign/);
    assert.match(missing, /folio-tree-nav__overview--directory/);
    assert.doesNotMatch(missing, /href="\/folio\/projects\/ungrouped\/"/);
    assert.doesNotMatch(missing, /<nav class="folio-page-nav"/);
    const direct = renderFolioStaticProjectShell(context, essay);
    assert.match(direct, /class="folio-tree-nav"/);
    assert.match(direct, /folio-docs-mobile-bar--static/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("standalone TreeNav renders independent, accessible right-side disclosure controls",()=>{
  const tree=resolveFolioProjectTree(docs,essay);
  const html=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{tree,currentPath:essay.path}),
  ));
  assert.match(html,/class="folio-tree-nav__symbol" aria-hidden="true">−<\/span>/);
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/aria-controls="/);
  assert.match(html,/aria-expanded="true"/);
  // This fixture has no inactive authored branch with children yet.
  // The next fixture adds one and verifies its initial collapsed state.
  assert.match(html,/href="\/projects\/com-design"/);
  assert.match(html,/href="\/projects\/com-design\/story"/);
  assert.doesNotMatch(html,/href="\/projects\/ungrouped"/);

  const unrelatedChild=doc("projects/mira/a-story/index.md","另一个项目的文章",1);
  const scoped=resolveFolioProjectTree([...docs,unrelatedChild],essay);
  const narrowed=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{tree:scoped,currentPath:essay.path}),
  ));
  assert.match(narrowed,/class="folio-tree-nav__symbol" aria-hidden="true">\+<\/span>/);
  assert.match(narrowed,/aria-expanded="false"/);
  assert.match(narrowed,/data-expanded="false" aria-hidden="true" inert=""/);
  assert.match(narrowed,/href="\/projects\/mira\/a-story"/);
});

test("defaultExpanded and controlled opt-out remain supported by the shared tree node",()=>{
  const tree=resolveFolioProjectTree(docs,essay);
  const html=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{tree,currentPath:essay.path,defaultExpanded:true}),
  ));
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/aria-controls="/);
  assert.match(html,/class="folio-tree-nav__symbol" aria-hidden="true">−<\/span>/);
  assert.doesNotMatch(html,/data-expanded="false"/);

  const forced=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{
      tree,currentPath:essay.path,defaultExpanded:true,collapsible:false,
    }),
  ));
  assert.doesNotMatch(forced,/folio-tree-nav__toggle/);
});

test("collapsible=false leaves all nested links visible and focusable without buttons",()=>{
  const unrelatedChild=doc("projects/mira/a-story/index.md","Mira 子文章",1);
  const tree=resolveFolioProjectTree([...docs,unrelatedChild],essay);
  const html=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{tree,currentPath:essay.path,collapsible:false}),
  ));
  assert.doesNotMatch(html,/folio-tree-nav__toggle/);
  assert.doesNotMatch(html,/data-expanded="false"/);
  assert.doesNotMatch(html,/aria-hidden="true" inert=""/);
  assert.match(html,/href="\/projects\/mira\/a-story"/);
});

test("static and React tree sections share reveal and indentation markup",()=>{
  const context={
    docs,roots:[],base:"/folio/",outDir:"",
    config:{title:"Folio",description:""},
  };
  const tree=resolveFolioProjectTree(docs,essay);
  const react=renderToStaticMarkup(createElement(
    MemoryRouter,{initialEntries:[essay.path]},
    createElement(FolioTreeNav,{tree,currentPath:essay.path}),
  ));
  const staticPage=renderFolioStaticProjectShell(context,essay);
  for(const html of [react,staticPage]){
    assert.match(html,/<div[^>]*class="folio-tree-nav__reveal"[^>]*>.*?<div class="folio-tree-nav__reveal-inner"><ul class="folio-tree-nav__children"/s);
    assert.match(html,/href="(?:\/folio)?\/projects\/com-design\/story/);
  }
});
