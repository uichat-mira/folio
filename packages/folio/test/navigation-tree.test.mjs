import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFolioNavigationTree,
} from "../dist/index.js";
import {
  renderFolioStaticTreeNav,
} from "../dist/vite.js";

const doc=(path,title,type="doc",group="API",order=10,collection="参考")=>({
  id:path,sourcePath:path.slice(1)+"/index.md",path,title,type,group,
  collection:type==="doc"?collection:undefined,
  section:undefined,order,description:"",body:"",headings:[],tags:[],data:{},
});

const overview=doc("/reference/overview","参考索引");
const vite=doc("/reference/build","构建", "doc","API",30);
const deploy=doc("/reference/github-pages","GitHub Pages","doc","部署",20);
const components=doc("/reference/components","组件","project","API",1);
const componentApp=doc("/reference/components/app","FolioApp","project","API",1);
const componentSlots=doc("/reference/components/app/slots","插槽","project","API",1);
const guide=doc("/guide/introduction","指南","doc","开始",1,"指南");
const source=[guide,componentSlots,overview,deploy,components,vite,componentApp];

test("one navigation tree owns both collection sections and nested projects",()=>{
  const fromDocument=buildFolioNavigationTree(source,overview);
  const fromProject=buildFolioNavigationTree(source,componentSlots);
  assert.equal(fromDocument.rootPath,"/reference");
  assert.equal(fromProject.rootPath,"/reference");
  const shape=(tree)=>tree.roots.map(group=>({
    label:group.title,kind:group.kind,
    children:group.children.map(node=>node.path),
  }));
  assert.deepEqual(shape(fromDocument),shape(fromProject));
  assert.deepEqual(fromDocument.roots.map(x=>x.title),["API","部署"]);
  assert.ok(fromDocument.roots.every(x=>x.kind==="section"&&x.doc===undefined));
  const api=fromDocument.roots.find(x=>x.title==="API");
  assert.equal(api.children[0].path,"/reference/components");
  assert.equal(api.children[0].children[0].path,"/reference/components/app");
  assert.equal(api.children[0].children[0].children[0].path,"/reference/components/app/slots");
  assert.ok(!fromDocument.roots.some(x=>x.path.startsWith("/guide")));
  assert.equal(buildFolioNavigationTree(source, overview).roots[0].title, "API");
  assert.equal(buildFolioNavigationTree(source, componentSlots).roots[0].title, "API");
});

test("static navigation projects the same tree without fake links or inactive controls",()=>{
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

test("non-reading pages stay outside document navigation",()=>{
  const article=doc("/blogs/story","独立文章","article","博客");
  assert.deepEqual(buildFolioNavigationTree([...source,article],article).roots,[]);
  assert.deepEqual(buildFolioNavigationTree([...source, article], article).roots, []);
});

test("multi-directory collection does not claim unrelated projects via common root /",()=>{
  const guideDoc=doc("/guide/start","指南首页","doc","开始",10,"Cross Directory");
  const miscDoc=doc("/misc/extra","补充文档","doc","开始",20,"Cross Directory");
  const otherProject=doc("/projects/other/item","无关项目","project","项目",1);
  const relatedProject=doc("/misc/feature","同集合子项目","project","开始",15);
  const docs=[guideDoc,miscDoc,otherProject,relatedProject];
  const guideTree=buildFolioNavigationTree(docs,guideDoc);
  const relatedTree=buildFolioNavigationTree(docs,relatedProject);
  assert.equal(guideTree.rootPath,"/");
  assert.equal(guideTree.scopeId,relatedTree.scopeId,
    "related project and collection pages should retain expansion state");
  const all=(tree)=>JSON.stringify(tree.roots);
  assert.doesNotMatch(all(guideTree),/projects\/other/);
  assert.match(all(guideTree),/misc\/feature/);
  assert.deepEqual(guideTree.roots.map(group=>group.title),relatedTree.roots.map(group=>group.title));
  const unrelatedTree=buildFolioNavigationTree(docs,otherProject);
  assert.notEqual(unrelatedTree.scopeId,guideTree.scopeId);
  assert.doesNotMatch(all(unrelatedTree),/guide\/start/);
  const explicit=buildFolioNavigationTree(docs,guideDoc,{scopePath:"/"});
  assert.match(all(explicit),/projects\/other/,"explicit root scope may intentionally include other projects");
});

test("a project joins only the section of its owning collection, never a namesake",()=>{
  const alpha=doc("/a/first","Alpha 文档","doc","API",10,"Alpha");
  const beta=doc("/b/second","Beta 文档","doc","API",10,"Beta");
  const project=doc("/b/tree","Beta 项目","project","API",11);
  const tree=buildFolioNavigationTree([alpha,beta,project],alpha,{scopePath:"/"});
  const groups=tree.roots.filter(group=>group.title==="API");
  assert.equal(groups.length,2);
  const alphaGroup=groups.find(group=>group.children.some(child=>child.path==="/a/first"));
  const betaGroup=groups.find(group=>group.children.some(child=>child.path==="/b/second"));
  assert.ok(alphaGroup && betaGroup && alphaGroup!==betaGroup);
  assert.equal(alphaGroup.children.some(child=>JSON.stringify(child).includes("/b/tree")),false);
  assert.equal(betaGroup.children.some(child=>JSON.stringify(child).includes("/b/tree")),true);
});

test("ambiguous collection ownership never merges projects by label",()=>{
  const a=doc("/shared/a","Alpha","doc","API",5,"Alpha");
  const b=doc("/shared/b","Beta","doc","API",5,"Beta");
  const project=doc("/shared/project","项目","project","API",9);
  const model=buildFolioNavigationTree([a,b,project],a,{scopePath:"/shared"});
  const owners=model.roots.filter(group=>group.path.startsWith("folio:section:collection:"));
  assert.ok(owners.every(group=>group.children.every(child=>child.path!==project.path)));
  assert.ok(model.roots.some(group=>group.children.some(child=>child.path===project.path)),
    "project remains visible in its own unowned group");
});

test("out-of-range authored sort values are not silently capped at 99",()=>{
  const below=doc("/projects/real","低优先级文档","project","项目",110);
  const above=doc("/projects/implicit/child","更晚的子文档","project","项目",120);
  const model=buildFolioNavigationTree([below,above],below);
  assert.deepEqual(model.roots.map(x=>x.path),["/projects/real","/projects/implicit"]);
});
