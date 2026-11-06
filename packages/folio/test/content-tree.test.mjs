import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFolioContentTree, resolveFolioProjectTree,
  getFolioTreeNeighbors, parseFolioDoc,
} from "../dist/index.js";

const project = (source, title, order = 99, extra = "") =>
  parseFolioDoc(source, [
    "---", "type: project", `title: "${title}"`, `order: ${order}`, extra,
    "---", `# ${title}`,
  ].filter(Boolean).join("\n"));

test("index.md conventions derive parent, child and deep grandchildren without a manifest", () => {
  const overview = project("projects/com-design/index.md", "ComDesign：设计系统", 2);
  const story = project("projects/com-design/first-principle/index.md", "第一条原则", 2);
  const nested = project("projects/com-design/first-principle/notes/index.md", "笔记", 1);
  const another = project("projects/com-design/zero/index.md", "起点", 1);
  const other = project("projects/mira/index.md", "Mira：AI 系统", 1);
  const unrelated = project("projects/com-designer/index.md", "相似前缀", 3);
  const docs = [nested, unrelated, story, overview, another, other];
  const tree = buildFolioContentTree(docs, { rootPath: "/projects" });
  assert.deepEqual(tree.roots.map(n=>n.path), [
    "/projects/mira", "/projects/com-design", "/projects/com-designer",
  ]);
  const group = tree.roots[1];
  assert.equal(group.doc, overview);
  assert.deepEqual(group.children.map(n=>n.doc?.title), ["起点", "第一条原则"]);
  assert.equal(group.children[1].children[0].doc, nested);
  assert.deepEqual(getFolioTreeNeighbors(tree, overview.path), { previous: undefined, next: another });
  assert.deepEqual(getFolioTreeNeighbors(tree, another.path), { previous: overview, next: story });
  assert.deepEqual(getFolioTreeNeighbors(tree, nested.path), { previous: story, next: undefined });
  assert.deepEqual(getFolioTreeNeighbors(tree, other.path), { previous: undefined, next: undefined });
  assert.equal(resolveFolioProjectTree(docs, story).roots.length, 3);
});

test("missing overviews produce non-clickable implicit folders and never fake a page", () => {
  const orphan = project("projects/alpha/essay/index.md", "孤立的文章", 1);
  const deep = project("projects/alpha/deep/chapter/index.md", "深层文章", 2);
  const tree = buildFolioContentTree([orphan, deep], {rootPath:"/projects"});
  assert.equal(tree.roots[0].doc, undefined);
  assert.equal(tree.roots[0].title, "alpha");
  assert.equal(tree.roots[0].children.find(n => n.path.endsWith("/deep")).doc, undefined);
  assert.deepEqual(tree.roots[0].children.map(n=>n.path), ["/projects/alpha/essay","/projects/alpha/deep"]);
  assert.equal(getFolioTreeNeighbors(tree, orphan.path).next, deep);
});

test("path prefix boundaries, explicit route overrides, and duplicate paths", () => {
  const custom = project("projects/alpha/moved/index.md", "Moved", 1,
    "path: /projects/beta/overridden");
  const alpha = project("projects/alpha/index.md", "Alpha", 2);
  const tree = buildFolioContentTree([alpha,custom], {rootPath:"/projects/alpha/"});
  assert.deepEqual(tree.roots, []);
  const beta = buildFolioContentTree([alpha,custom], {rootPath:"/projects"});
  assert.deepEqual(beta.roots.map(n=>n.path), ["/projects/beta","/projects/alpha"]);
  assert.equal(beta.roots[0].children[0].doc, custom);
  assert.deepEqual(buildFolioContentTree([alpha], {rootPath:"/projects/al"}).roots, []);
  const duplicate = { ...alpha, sourcePath:"projects/another/index.md" };
  assert.throws(
    () => buildFolioContentTree([alpha,duplicate], {rootPath:"/projects"}),
    /duplicate route/,
  );
  assert.throws(
    () => buildFolioContentTree([alpha,alpha], {rootPath:"/projects"}),
    /duplicate route/,
    "even an accidentally repeated source entry must not silently overwrite itself",
  );
});

test("tree builder does not mutate the supplied docs or silently mix other types", () => {
  const overview=project("projects/p/index.md","P",2);
  const note=project("projects/p/n/index.md","N",1);
  const article = {...note, type:"article", path:"/projects/p/blog"};
  const input=[note,overview,article];
  const before=input.map(x=>x.path);
  const onlyProjects=resolveFolioProjectTree(input,note);
  assert.equal(onlyProjects.roots[0].children.length,1);
  assert.deepEqual(input.map(x=>x.path),before);
  assert.equal(buildFolioContentTree(input,{rootPath:"/projects"}).roots[0].children.length,2);
});

test("explicit top-level project overview can parent its own custom-routed children", () => {
  const top = project("projects/mira/index.md", "Mira", 1, "path: /mira");
  const child = project("projects/mira/notes/index.md", "笔记", 1, "path: /mira/notes");
  const tree = resolveFolioProjectTree([child, top], child);
  assert.equal(tree.rootPath, "/");
  assert.equal(tree.roots[0].doc, top);
  assert.equal(tree.roots[0].children[0].doc, child);
  assert.equal(getFolioTreeNeighbors(tree, top.path).next, child);
});
