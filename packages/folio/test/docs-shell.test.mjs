import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioDocsShell, FolioDocNav, FolioToc } from "../dist/index.js";
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
  assert.doesNotMatch(html, /folio-docnav__collection/);
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
    writeFolioStaticSite({
      config: { title: "Folio", description: "Test", siteUrl: "https://example.com" },
      docs: [...docs, article], roots: [], base: "/", outDir: dir,
    });
    const docHtml = readFileSync(resolve(dir, "reference/vite/index.html"), "utf8");
    const articleHtml = readFileSync(resolve(dir, "blog/story/index.html"), "utf8");
    assert.match(docHtml, /<main class="folio-doc-main"><h1>Vite 构建集成<\/h1>/);
    assert.doesNotMatch(docHtml, /folio-doc-toolbar|folio-share-button/);
    assert.match(docHtml, /aria-label="文档目录"/);
    assert.doesNotMatch(docHtml, /folio-docnav__collection/);
    assert.match(articleHtml, /folio-doc-toolbar/);
    assert.match(articleHtml, /<h1>文章<\/h1>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("public FolioDocNav uses the current collection and exposes safe composition props", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter,
    { basename: "/folio", initialEntries: ["/folio/reference/vite"] },
    createElement(FolioDocNav, {
      doc: docs[0],
      docs,
      className: "consumer-doc-nav",
      ariaLabel: "产品文档导航",
      onNavigate() {},
    }),
  ));
  assert.match(html, /class="folio-docnav consumer-doc-nav"/);
  assert.match(html, /aria-label="产品文档导航"/);
  assert.match(html, /<h2>构建<\/h2>/);
  assert.match(html, /href="\/folio\/reference\/vite"/);
  assert.match(html, /href="\/folio\/reference\/next"/);
  assert.match(html, /aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.doesNotMatch(html, /folio-docnav__collection/);

  const missing = { ...docs[0], type: "article", collection: "missing" };
  assert.equal(renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: ["/"] },
    createElement(FolioDocNav, { doc: missing, docs }),
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
        received.push({ kind: "nav", path: props.doc.path, total: props.docs.length });
        return createElement(FolioDocNav, { ...props, className: "custom-nav" });
      },
      renderToc(props) {
        received.push({ kind: "toc", ids: props.headings.map(h => h.id) });
        return createElement(FolioToc, { ...props, className: "custom-toc" });
      },
    }),
  ));
  assert.deepEqual(received, [
    { kind: "nav", path: "/reference/vite", total: 2 },
    { kind: "toc", ids: ["pipeline"] },
  ]);
  assert.match(html, /class="folio-docnav custom-nav"/);
  assert.match(html, /class="folio-toc custom-toc"/);
  assert.match(html, /aria-label="文档分页"/);
  assert.match(html, /href="#pipeline"/);
});

test("public navigation selection follows the provided current route", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [docs[1].path] },
    createElement(FolioDocNav, { doc: docs[1], docs }),
  ));
  assert.match(html, /<a class="active" aria-current="page" href="\/reference\/next"/);
  assert.doesNotMatch(html, /<a class="active" aria-current="page" href="\/reference\/vite"/);
});
