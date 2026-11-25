import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioDocsShell, FolioTreeNav, FolioToc, buildFolioNavigationTree } from "../dist/index.js";
import { writeFolioStaticSite } from "../dist/vite.js";

const docs = [
  {
    id: "vite", path: "/reference/vite", sourcePath: "reference/vite.md",
    title: "Vite 构建集成", description: "一篇示例文档",
    type: "doc", group: "API", collection: "参考", section: "构建",
    order: 1, tags: [], body: "## 内容链路\n\nMarkdown 正文。",
    headings: [{ depth: 2, id: "pipeline", text: "内容链路" }], data: {},
  },
  {
    id: "next", path: "/reference/next", sourcePath: "reference/next.md",
    title: "下一篇", description: "", type: "doc", group: "API",
    collection: "参考", section: "构建", order: 2, tags: [],
    body: "## 后续章节", headings: [], data: {},
  },
];

test("documentation reader starts with the title, not a category/share toolbar", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [docs[0].path] },
    createElement(FolioDocsShell, { doc: docs[0], docs, share: true }),
  ));
  assert.match(html, /<main class="folio-doc-main"><h1>Vite 构建集成<\/h1>/);
  assert.doesNotMatch(html, /folio-doc-toolbar|folio-share-button/);
  assert.match(html, /<p class="folio-lede">一篇示例文档<\/p>/);
  assert.match(html, /aria-label="文档目录"/);
  assert.match(html, /aria-label="本页目录"/);
  assert.match(html, /aria-label="文档分页"/);
  assert.match(html, /下一篇/);
  // Document location remains legible in the sidebar without duplicating
  // metadata above the page title.
  assert.match(html, /class="folio-tree-nav folio-tree-nav--sections"/);
  assert.match(html, /<h2>构建<\/h2>/);
});

test("Folio core static docs match the uncluttered runtime; articles retain their metadata", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "folio-document-toolbar-"));
  try {
    writeFileSync(resolve(dir, "index.html"),
      '<!doctype html><html><head><title>Folio</title></head><body><div id="root"></div></body></html>');
    const article = {
      ...docs[0], id: "story", path: "/blog/story", type: "article",
      title: "文章", group: "Blog", sourcePath: "blog/story.md", collection: undefined,
    };
    const page = {
      ...docs[0], id: "about", path: "/about", type: "page",
      title: "关于", group: "Folio", sourcePath: "about.md", collection: undefined,
    };
    writeFolioStaticSite({
      config: { title: "Folio", description: "Test", siteUrl: "https://example.com" },
      docs: [...docs, article, page], roots: [], base: "/", outDir: dir,
    });
    const docHtml = readFileSync(resolve(dir, "reference/vite/index.html"), "utf8");
    const articleHtml = readFileSync(resolve(dir, "blog/story/index.html"), "utf8");
    const pageHtml = readFileSync(resolve(dir, "about/index.html"), "utf8");
    assert.match(docHtml, /<main class="folio-doc-main"><h1>Vite 构建集成<\/h1>/);
    assert.doesNotMatch(docHtml, /folio-doc-toolbar|folio-share-button/);
    assert.match(docHtml, /aria-label="文档目录"/);
    assert.match(docHtml, /class="folio-tree-nav folio-tree-nav--sections"/);
    assert.doesNotMatch(articleHtml, /folio-doc-toolbar|folio-eyebrow|folio-share-button/);
    assert.match(articleHtml, /<main class="folio-doc-page folio-article-main"><h1>文章<\/h1>/);
    assert.doesNotMatch(pageHtml, /folio-doc-toolbar|folio-eyebrow|folio-share-button/);
    assert.match(pageHtml, /<main class="folio-prerender"><h1>关于<\/h1>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("public FolioTreeNav uses the current collection and exposes safe composition props", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter,
    { basename: "/folio", initialEntries: ["/folio/reference/vite"] },
    createElement(FolioTreeNav, {
      tree: buildFolioNavigationTree(docs, docs[0]),
      currentPath: docs[0].path,
      className: "consumer-doc-nav",
      ariaLabel: "产品文档导航",
      onNavigate() {},
    }),
  ));
  assert.match(html, /class="folio-tree-nav folio-tree-nav--sections consumer-doc-nav"/);
  assert.match(html, /aria-label="产品文档导航"/);
  assert.match(html, /<h2>构建<\/h2>/);
  assert.match(html, /href="\/folio\/reference\/vite"/);
  assert.match(html, /href="\/folio\/reference\/next"/);
  assert.match(html, /aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /folio-tree-nav__section/);

  const missing = { ...docs[0], type: "article", collection: "missing" };
  assert.equal(renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: ["/"] },
    createElement(FolioTreeNav, {
      tree: buildFolioNavigationTree(docs, missing),
      currentPath: missing.path,
    }),
  )), "", "a document outside the supplied collection is not invented");
});

test("FolioDocsShell render callbacks receive current nav/TOC props and preserve layout", () => {
  const received = [];
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [docs[0].path] },
    createElement(FolioDocsShell, {
      doc: docs[0],
      docs,
      renderNav(props) {
        received.push({
          kind: "nav",
          path: props.currentPath,
          roots: props.tree.roots.length,
          dismissable: typeof props.onNavigate === "function",
        });
        return createElement(FolioTreeNav, { ...props, className: "custom-nav" });
      },
      renderToc(props) {
        received.push({
          kind: "toc",
          ids: props.headings.map(h => h.id),
          dismissable: typeof props.onNavigate === "function",
        });
        return createElement(FolioToc, { ...props, className: "custom-toc" });
      },
    }),
  ));
  // The mobile drawer and TOC stay mounted (but inert while closed) so the
  // drawer keeps expansion state and the TOC panel can animate out. Both
  // desktop and mobile use the consumer renderer; only the mobile instance
  // receives a dismiss callback.
  assert.deepEqual(received, [
    { kind: "nav", path: "/reference/vite", roots: 1, dismissable: true },
    { kind: "toc", ids: ["pipeline"], dismissable: true },
    { kind: "nav", path: "/reference/vite", roots: 1, dismissable: false },
    { kind: "toc", ids: ["pipeline"], dismissable: false },
  ]);
  assert.match(html, /class="folio-mobile-toc" aria-hidden="true" inert=""/);
  assert.match(html, /class="folio-tree-nav folio-tree-nav--sections custom-nav"/);
  assert.match(html, /class="folio-toc custom-toc"/);
  assert.match(html, /aria-label="文档分页"/);
  assert.match(html, /href="#pipeline"/);
});

test("public navigation selection follows the provided current route", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [docs[1].path] },
    createElement(FolioTreeNav, {
      tree: buildFolioNavigationTree(docs, docs[1]),
      currentPath: docs[1].path,
    }),
  ));
  assert.match(html, /<a class="active" aria-current="page" href="\/reference\/next"/);
  assert.doesNotMatch(html, /<a class="active" aria-current="page" href="\/reference\/vite"/);
});
