import assert from "node:assert/strict";
import test from "node:test";
import { buildFolioNavigationTree, getFolioNavigationNeighbors } from "../dist/index.js";
import { renderFolioStaticTreeNav } from "../dist/vite.js";

const doc=(path,title,type="doc",group="API",order=10,collection="参考")=>({
  id:path,sourcePath:path.slice(1)+"/index.md",path,title,type,group,
  collection:type==="doc"?collection:undefined,
  section:undefined,order,description:"",body:"",headings:[],tags:[],data:{},
});

const overview=doc("/reference/overview","参考索引");
const vite=doc("/reference/build","构建","doc","API",30);
const deploy=doc("/reference/github-pages","GitHub Pages","doc","部署",20);
const components=doc("/reference/components","组件","doc","API",1);
const componentApp=doc("/reference/components/app","FolioApp","doc","API",1);
const componentSlots=doc("/reference/components/app/slots","插槽","doc","API",1);
const guide=doc("/guide/introduction","指南","doc","开始",1,"指南");
const source=[guide,componentSlots,overview,deploy,components,vite,componentApp];

test("one document navigation tree includes nested authored routes without a project type",()=>{
  const fromDocument=buildFolioNavigationTree(source,overview);
  const fromChild=buildFolioNavigationTree(source,componentSlots);
  assert.equal(fromDocument.rootPath,"/reference");
  assert.equal(fromChild.rootPath,"/reference");
  const shape=(tree)=>tree.roots.map(group=>({
    label:group.title,kind:group.kind,children:group.children.map(node=>node.path),
  }));
  assert.deepEqual(shape(fromDocument),shape(fromChild));
  assert.deepEqual(fromDocument.roots.map(x=>x.title),["API","部署"]);
  assert.ok(fromDocument.roots.every(x=>x.kind==="section" && x.doc===undefined));
  const api=fromDocument.roots.find(x=>x.title==="API");
  assert.equal(api.children[0].path,"/reference/components");
  assert.equal(api.children[0].children[0].path,"/reference/components/app");
  assert.equal(api.children[0].children[0].children[0].path,"/reference/components/app/slots");
  assert.equal(getFolioNavigationNeighbors(fromChild,componentSlots.path).previous.path,componentApp.path);
  assert.ok(!JSON.stringify(fromDocument.roots).includes("/guide"));
});

test("an authored section does not repeat its sole un-authored route folder",()=>{
  const principles=doc("/reference/design/principles","秩序与气质","doc","设计",10);
  const tokens=doc("/reference/design/tokens","Token 图鉴","doc","设计",20);
  const refs=[...source,principles,tokens];
  const tree=buildFolioNavigationTree(refs,principles);
  const section=tree.roots.find(node=>node.title==="设计");
  assert.ok(section);
  assert.equal(section.kind,"section");
  assert.deepEqual(section.children.map(node=>node.path),[
    "/reference/design/principles","/reference/design/tokens",
  ]);
  assert.ok(section.children.every(node=>node.doc && node.children.length===0));
  assert.equal(getFolioNavigationNeighbors(tree,principles.path).next.path,tokens.path);

  const staticHtml=renderFolioStaticTreeNav({
    docs:refs,base:"/folio/",config:{title:"Folio"},roots:[],outDir:"",
  },principles);
  assert.match(staticHtml,/<h2>设计<\/h2>/);
  assert.match(staticHtml,/href="\/folio\/reference\/design\/principles\/"/);
  assert.match(staticHtml,/href="\/folio\/reference\/design\/tokens\/"/);
  assert.doesNotMatch(staticHtml,/>design<\/span>/);
  // The actual authored overview remains a real ancestor in another section.
  const api=tree.roots.find(node=>node.title==="API");
  assert.ok(api.children.some(node=>node.path==="/reference/components" && node.doc));
});

test("static document navigation renders nested links, section labels and one active route",()=>{
  const context={docs:source,base:"/folio/",config:{title:"Folio"},roots:[],outDir:""};
  for (const current of [overview,componentSlots]) {
    const html=renderFolioStaticTreeNav(context,current);
    assert.match(html,/class="folio-tree-nav__section"/);
    assert.match(html,/<h2>API<\/h2>/);
    assert.match(html,/<h2>部署<\/h2>/);
    assert.match(html,/href="\/folio\/reference\/components\/"/);
    assert.match(html,/href="\/folio\/reference\/components\/app\/slots\/"/);
    assert.match(html,/href="\/folio\/reference\/github-pages\/"/);
    assert.doesNotMatch(html,/href="\/folio\/guide\/introduction\/"/);
    assert.doesNotMatch(html,/folio-tree-nav__toggle/);
    assert.doesNotMatch(html,/href="folio:section:/);
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  }
});

test("article, page and arbitrary types do not acquire document navigation",()=>{
  for(const type of ["article","page","project","custom"]){
    const item=doc("/content/"+type,"内容",type);
    assert.deepEqual(buildFolioNavigationTree([...source,item],item).roots,[]);
    assert.ok(!JSON.stringify(buildFolioNavigationTree([...source,item],overview)).includes(item.path));
  }
});

test("multi-directory collection shares one scope without swallowing other collections",()=>{
  const first=doc("/guide/start","指南首页","doc","开始",10,"Cross Directory");
  const extra=doc("/misc/extra","补充文档","doc","开始",20,"Cross Directory");
  const related=doc("/misc/feature","同集合文档","doc","开始",15,"Cross Directory");
  const outside=doc("/projects/other/item","其他集合文档","doc","项目",1,"Other");
  const docs=[first,extra,related,outside];
  const tree=buildFolioNavigationTree(docs,first);
  assert.equal(tree.rootPath,"/");
  assert.equal(tree.scopeId,buildFolioNavigationTree(docs,related).scopeId);
  assert.match(JSON.stringify(tree.roots),/misc\/feature/);
  assert.doesNotMatch(JSON.stringify(tree.roots),/projects\/other/);
  const otherTree=buildFolioNavigationTree(docs,outside);
  assert.notEqual(otherTree.scopeId,tree.scopeId);
  assert.doesNotMatch(JSON.stringify(otherTree.roots),/guide\/start/);
  const explicit=buildFolioNavigationTree(docs,first,{scopePath:"/"});
  assert.match(JSON.stringify(explicit.roots),/projects\/other/);
});

test("same-named sections from distinct collections remain separate in explicit scope",()=>{
  const alpha=doc("/a/first","Alpha 文档","doc","API",10,"Alpha");
  const beta=doc("/b/second","Beta 文档","doc","API",10,"Beta");
  const nested=doc("/b/second/child","Beta 子文档","doc","API",11,"Beta");
  const tree=buildFolioNavigationTree([alpha,beta,nested],alpha,{scopePath:"/"});
  const groups=tree.roots.filter(group=>group.title==="API");
  assert.equal(groups.length,2);
  const a=groups.find(group=>JSON.stringify(group).includes(alpha.path));
  const b=groups.find(group=>JSON.stringify(group).includes(beta.path));
  assert.ok(a && b && a!==b);
  assert.doesNotMatch(JSON.stringify(a),/b\/second/);
  assert.equal(b.children[0].children[0].children[0].path,nested.path);
});

test("missing authored parents never become fake links in the reading sidebar",()=>{
  const child=doc("/reference/deep/unknown/leaf","叶子","doc","API",9);
  const tree=buildFolioNavigationTree([...source,child],child);
  const all=JSON.stringify(tree.roots);
  assert.match(all,/reference\/deep\/unknown\/leaf/);
  assert.match(all,/"path":"\/reference\/deep\/unknown","title":"unknown"/);
  const context={docs:[...source,child],base:"/folio/",config:{title:"Folio"},roots:[],outDir:""};
  assert.doesNotMatch(renderFolioStaticTreeNav(context,child),/href="\/folio\/reference\/deep\/unknown\/"/);
});

test("authored orders above 99 are retained without clipping or fake project grouping",()=>{
  const first=doc("/projects/real","前文","doc","项目",110,"Independent");
  const second=doc("/projects/implicit/child","后文","doc","项目",120,"Independent");
  const tree=buildFolioNavigationTree([first,second],first);
  assert.deepEqual(tree.roots.map(x=>x.title),["项目"]);
  assert.deepEqual(tree.roots[0].children.map(x=>x.path),[first.path,"/projects/implicit"]);
  assert.equal(tree.roots[0].children[1].children[0].path,second.path);
  assert.equal(tree.roots[0].children[1].doc,undefined);
  assert.equal(getFolioNavigationNeighbors(tree,first.path).next.path,second.path);
});
