import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioTreeNav, buildFolioNavigationTree } from "../dist/index.js";
import { renderFolioStaticTreeNav, renderFolioStaticProjectShell } from "../dist/vite.js";

function doc(path, title, type, group="API", order=99, collection) {
  return {
    id:path,sourcePath:path.replace(/^\//,"")+"/index.md",path,type,title,group,
    section:undefined,collection,order,description:"",body:"",headings:[],tags:[],data:{},
  };
}
const overview=doc("/reference/overview","参考索引","doc","API",40,"参考");
const build=doc("/reference/build","构建集成","doc","API",50,"参考");
const deploy=doc("/reference/deploy","部署","doc","部署",90,"参考");
const guide=doc("/guide/introduction","指南","doc","开始",1,"指南");
const components=doc("/reference/components","组件","project","API",1);
const app=doc("/reference/components/app","FolioApp","project","API",10);
const slots=doc("/reference/components/app/slots","应用插槽","project","API",10);
const navigationSlot=doc("/reference/components/app/slots/navigation","导航覆写","project","API",10);
const nav=doc("/reference/components/navigation","导航组件","project","API",20);
const tree=doc("/reference/components/navigation/tree-nav","FolioTreeNav","project","API",10);
const contentTree=doc("/reference/components/navigation/tree-nav/content-tree","内容树模型","project","API",10);
const parent=doc("/reference/components/navigation/tree-nav/content-tree/parent-inference","父级推导","project","API",10);
const stray=doc("/guide/examples/example","指南示例","project","API",2);
const docs=[guide,overview,deploy,build,slots,tree,components,nav,navigationSlot,app,parent,contentTree,stray];
const navigation=(current,props={})=>
  createElement(FolioTreeNav,{
    tree:buildFolioNavigationTree(docs,current),
    currentPath:current.path,
    ...props,
  });
const renderNavigation=(current,props={},base="/")=>
  renderToStaticMarkup(createElement(
    MemoryRouter,{
      basename:base==="/"?undefined:base,
      initialEntries:[(base==="/"?"":base)+current.path],
    },
    navigation(current,props),
  ));

test("one navigation tree mixes reference categories and nested components without leaking guide pages",()=>{
  const model=buildFolioNavigationTree(docs,overview);
  const sections=model.roots;
  const api=sections.find(s=>s.title==="API");
  assert.ok(api);
  assert.equal(api.kind,"section");
  assert.equal(api.children[0].doc,components);
  assert.equal(api.children[0].children.find(n=>n.path.endsWith("/app")).doc,app);
  assert.equal(api.children[0].children.find(n=>n.path.endsWith("/navigation")).doc,nav);
  assert.equal(api.children[0].children.find(n=>n.path.endsWith("/navigation"))
    .children[0].children[0].children[0].doc,parent);
  assert.equal(api.children[1].doc,overview);
  assert.equal(api.children[2].doc,build);
  assert.equal(sections.some(s=>s.title==="部署"),true);
  assert.equal(sections.flatMap(s=>s.children).some(n=>n.path.startsWith("/guide")),false);
  const guideTree=buildFolioNavigationTree(docs,guide);
  assert.equal(guideTree.roots[0].title,"开始");
  assert.equal(guideTree.roots.some(n=>n.path.startsWith("/reference")),false);
  assert.deepEqual(
    buildFolioNavigationTree(docs,parent).roots.map(n=>n.title),
    sections.map(n=>n.title),
  );
});

test("public TreeNav renders all nested links in one nav and honors Router basename",()=>{
  const html=renderNavigation(overview,{},"/folio");
  assert.equal((html.match(/<nav /g)||[]).length,1);
  assert.match(html,/class="folio-tree-nav folio-tree-nav--sections"/);
  assert.match(html,/href="\/folio\/reference\/components"/);
  assert.match(html,/href="\/folio\/reference\/components\/navigation\/tree-nav\/content-tree\/parent-inference"/);
  assert.match(html,/href="\/folio\/reference\/components\/app\/slots\/navigation"/);
  assert.equal((html.match(/<ul class="folio-tree-nav__children(?: folio-tree-nav__children--section)?"/g)||[]).length,8);
  assert.match(html,/folio-tree-nav__section/);
  assert.match(html,/href="\/folio\/reference\/overview"/);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/folio\/guide\/examples\/example"/);
});

test("static navigation projects the same links through the public tree renderer",()=>{
  const context={docs,base:"/folio/",config:{title:"Folio"},roots:[],outDir:""};
  const html=renderFolioStaticTreeNav(context,overview);
  assert.equal((html.match(/<nav /g)||[]).length,1);
  assert.match(html,/class="folio-tree-nav folio-tree-nav--sections"/);
  assert.match(html,/href="\/folio\/reference\/components\/"/);
  assert.match(html,/href="\/folio\/reference\/components\/navigation\/tree-nav\/content-tree\/parent-inference\/"/);
  assert.match(html,/href="\/folio\/reference\/components\/app\/slots\/navigation\/"/);
  assert.match(html,/href="\/folio\/reference\/overview\/"/);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/folio\/guide\/examples\/example\/"/);
  assert.doesNotMatch(html,/folio-tree-nav__toggle/);
});

test("project articles preserve peer document categories and their own active ancestry",()=>{
  const html=renderNavigation(parent);
  assert.match(html,/href="\/reference\/overview"/);
  assert.match(html,/<h2>部署<\/h2>/);
  assert.match(html,/href="\/reference\/deploy"/);
  assert.match(html,/href="\/reference\/components\/navigation\/tree-nav\/content-tree\/parent-inference"/);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/aria-controls="/);
  assert.match(html,/data-expanded="false" aria-hidden="true" inert=""/);
  assert.match(html,/class="folio-tree-nav__symbol" aria-hidden="true">\+<\/span>/);
  assert.match(html,/class="folio-tree-nav__symbol" aria-hidden="true">−<\/span>/);
  assert.match(html,/class="folio-tree-nav__row is-active"/);
  assert.equal((html.match(/<nav /g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/guide\/examples\/example"/);
});

test("static project output retains peers, link semantics, and no inert disclosure",()=>{
  const context={docs,base:"/folio/",config:{title:"Folio",description:"test"},roots:[],outDir:""};
  const html=renderFolioStaticProjectShell(context,parent);
  assert.match(html,/class="folio-tree-nav folio-tree-nav--sections" aria-label="文档目录"/);
  assert.match(html,/<h2>API<\/h2>/);
  assert.match(html,/<h2>部署<\/h2>/);
  assert.match(html,/href="\/folio\/reference\/overview\/"/);
  assert.match(html,/href="\/folio\/reference\/deploy\/"/);
  assert.match(html,/href="\/folio\/reference\/components\/navigation\/tree-nav\/content-tree\/parent-inference\/"/);
  assert.match(html,/aria-current="page"/);
  assert.match(html,/folio-tree-nav__children/);
  assert.doesNotMatch(html,/folio-tree-nav__toggle/);
  assert.doesNotMatch(html,/href="\/folio\/guide\/examples\/example\/"/);
});

test("controlled TreeNav expansion keeps content groups visible and allows branch toggles",()=>{
  const html=renderNavigation(parent,{expandedPaths:["/reference/components"]});
  assert.match(html,/aria-expanded="true"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/class="folio-tree-nav__toggle"/);
  assert.match(html,/data-expanded="false" aria-hidden="true" inert=""/);
});

test("parent title and +/- are independent; current parent is initially open",()=>{
  const before=renderNavigation(overview);
  const atParent=renderNavigation(components);
  assert.match(before,/href="\/reference\/components"/);
  assert.match(before,/aria-label="展开组件的子页面"/);
  assert.match(before,/aria-expanded="false"/);
  assert.match(before,/data-expanded="false" aria-hidden="true" inert=""/);
  assert.match(atParent,/href="\/reference\/components\/app"/);
  assert.match(atParent,/aria-label="收起组件的子页面"/);
  assert.match(atParent,/aria-expanded="true"/);
  assert.match(atParent,/aria-current="page"/);
  const branch=atParent.split('href="/reference/components"')[1]?.split("</section>")[0];
  assert.ok(branch);
  assert.match(branch,/data-expanded="true" aria-hidden="false"/);
});

test("taxonomy headings are permanent labels, even under controlled disclosure props",()=>{
  for (const props of [{},{expandedPaths:[]},{collapsible:false}]) {
    const html=renderNavigation(overview,props);
    for (const heading of ["API","部署"]) {
      const start=html.indexOf("<h2>"+heading+"</h2>");
      assert.notEqual(start,-1);
      const section=html.slice(start,html.indexOf("</section>",start));
      assert.match(html.slice(Math.max(0,start-180),start),
        /class="folio-tree-nav__row folio-tree-nav__row--section">$/);
      assert.doesNotMatch(section.split("</div>",1)[0],/folio-tree-nav__toggle/);
      assert.match(section,/class="folio-tree-nav__reveal" data-expanded="true" aria-hidden="false"/);
    }
    assert.doesNotMatch(html,/aria-label="收起API的子页面"/);
    assert.doesNotMatch(html,/aria-label="展开API的子页面"/);
    if (props.collapsible === false) assert.doesNotMatch(html,/folio-tree-nav__toggle/);
    else assert.match(html,/aria-label="展开组件的子页面"/);
  }
});
