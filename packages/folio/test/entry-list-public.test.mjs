import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import test from "node:test";
import { FolioEntryList, FolioListPage } from "../dist/index.js";

function markup(component) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, component));
}
const book = {
  id: "agent",
  href: "https://tomz.io/books/agent/",
  title: "一起学智能体",
  description: "从真实产品与工程问题出发。",
  category: "AI / AGENT",
  cover: "https://tomz.io/books/covers/agent.webp",
  date: "2026-10-20",
  meta: "13 篇 · 最近更新",
};
test("public cover list keeps outbound canonical and Folio token classes", () => {
  const html = markup(createElement(FolioListPage, {
    title: "书架", eyebrow: "BOOKS / 书架", description: "最近的出版物。",
    entries: [book], variant: "shelf",
  }));
  assert.match(html, /folio-list-page/);
  assert.match(html, /folio-entry-list--shelf folio-entry-list--covers/);
  assert.match(html, /href="https:\/\/tomz.io\/books\/agent\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /src="https:\/\/tomz.io\/books\/covers\/agent.webp"/);
  assert.match(html, /AI \/ AGENT/);
  assert.match(html, /13 篇 · 最近更新/);
  assert.match(html, /<h1>书架<\/h1>/);
  assert.equal((html.match(/<a /g) || []).length, 1, "a whole row is one link");
});
test("existing FolioDoc entries keep internal router links and editorial markup", () => {
  const doc = {
    id: "/blogs/hello", path: "/blogs/hello", sourcePath: "blogs/hello.md",
    title: "Hello", description: "Original document", type: "article", order: 1,
    date: "2026-01-01", tags: [], body: "Body", headings: [], data: {},
  };
  const html = markup(createElement(FolioEntryList, { entries: [doc], headingLevel: "h2" }));
  assert.match(html, /class="folio-entry-list"/);
  assert.match(html, /href="\/blogs\/hello"/);
  assert.match(html, /<h2 class="folio-entry-title">Hello<\/h2>/);
  assert.doesNotMatch(html, /target="_blank"/);
});
test("external tags render siblings and do not nest anchors", () => {
  const html = markup(createElement(FolioEntryList, {
    entries: [book], headingLevel: "h3",
    tagLinks: new Map([[book.href, [{ label: "内容", href: "/blogs/tag/agent" }]]]),
  }));
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /class="folio-entry-link" href="https:\/\/tomz.io\/books\/agent\//);
  assert.match(html, /class="folio-entry-tag" href="\/blogs\/tag\/agent"/);
});
test("unsafe external href is rejected, never rendered into an anchor", () => {
  assert.throws(() => markup(createElement(FolioEntryList, {
    entries: [{ title: "Bad", href: "javascript:alert(1)" }],
  })), /unsupported href/);
});
test("an empty list may expose a readable empty state", () => {
  assert.match(markup(createElement(FolioEntryList, {
    entries: [], emptyMessage: "没有记录",
  })), /没有记录/);
});
