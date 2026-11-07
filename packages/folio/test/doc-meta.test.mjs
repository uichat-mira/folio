import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  FolioDocMeta, FolioDocsShell, getFolioDocByline, getFolioDocMeta, parseFolioDoc,
} from "../dist/index.js";
import { renderFolioStaticDocMeta, renderFolioStaticProjectShell } from "../dist/vite.js";

const raw = "---\ntitle: Metadata\ncreatedAt: 2020-01-02\nupdatedAt: 2021-03-04\ncreatedBy: Alice & Bob\nupdatedBy: Eva <Admin>\n---\n## Body";
const doc = parseFolioDoc("reference/metadata.md", raw);
const context = {
  config: { title: "Folio", description: "", siteUrl: "https://example.com" },
  docs: [doc], roots: [], base: "/folio/", outDir: "",
};

test("full Git history API remains independent of the compact presentation", () => {
  const entries = getFolioDocMeta(doc);
  assert.deepEqual(entries.map((item) => item.key), [
    "createdAt", "updatedAt", "createdBy", "updatedBy",
  ]);
  assert.equal(entries.find((item) => item.key === "updatedBy").value, "Eva <Admin>");
});

test("public FolioDocMeta and static HTML share a minimal, escaped byline", () => {
  const byline = getFolioDocByline(doc);
  assert.equal(byline.author.name, "Alice & Bob");
  assert.equal(byline.author.initial, "A");
  assert.equal(byline.date.value, "2020 年 1 月 2 日");
  assert.equal(byline.readingMinutes, 1);
  const html = renderToStaticMarkup(createElement(FolioDocMeta, {
    doc, className: "consumer-meta",
  }));
  const staticHtml = renderFolioStaticDocMeta(doc);
  for (const markup of [html, staticHtml]) {
    assert.match(markup, /class="folio-doc-meta/);
    assert.match(markup, /folio-doc-meta__avatar/);
    assert.match(markup, /Alice &amp; Bob/);
    assert.match(markup, /<time (?:dateTime|datetime)="2020-01-02T00:00:00.000Z">2020 年 1 月 2 日<\/time>/);
    assert.match(markup, /约 1 分钟/);
    assert.doesNotMatch(markup, /创建时间|更新时间|创建者|修改者|Eva/);
    assert.doesNotMatch(markup, /<dl/);
  }
});

test("explicit editorial author and published date win over Git provenance", () => {
  const authored = parseFolioDoc("blogs/editorial.md", [
    "---",
    "title: Editorial",
    "author:",
    "  name: 编辑部",
    "  avatar: /images/editor.png",
    "publishedAt: 2026-11-05",
    "createdAt: 2020-01-02",
    "createdBy: Git Committer",
    "updatedAt: 2026-11-07",
    "updatedBy: Different Editor",
    "---",
    "正文。",
  ].join("\n"));
  const byline = getFolioDocByline(authored);
  assert.equal(byline.author.name, "编辑部");
  assert.equal(byline.author.initial, "编");
  assert.equal(byline.author.avatar, "/images/editor.png");
  assert.equal(byline.date.value, "2026 年 11 月 5 日");
  for (const markup of [
    renderToStaticMarkup(createElement(FolioDocMeta, { doc: authored })),
    renderFolioStaticDocMeta(authored),
  ]) {
    assert.match(markup, /编辑部/);
    assert.match(markup, /src="\/images\/editor.png"/);
    assert.match(markup, /<time (?:dateTime|datetime)="2026-11-05T00:00:00.000Z">2026 年 11 月 5 日<\/time>/);
    assert.doesNotMatch(markup, /Git Committer|Different Editor|2020 年|2026 年 11 月 7 日/);
  }
});

test("no provenance still shows prose reading time without invented date or separator", () => {
  const empty = parseFolioDoc("reference/empty.md", "---\ntitle: Empty\n---\nbody");
  assert.deepEqual(getFolioDocMeta(empty), []);
  assert.deepEqual(getFolioDocByline(empty), { author: undefined, date: undefined, readingMinutes: 1 });
  for (const markup of [
    renderToStaticMarkup(createElement(FolioDocMeta, { doc: empty })),
    renderFolioStaticDocMeta(empty),
  ]) {
    assert.match(markup, /约 1 分钟/);
    assert.doesNotMatch(markup, /folio-doc-meta__separator|<time|folio-doc-meta__author/);
  }
});

test("missing values stay missing; unsafe avatar schemes are ignored", () => {
  const authored = parseFolioDoc("blogs/unknown.md", [
    "---",
    "title: Unknown",
    "author:",
    "  name: 'Mira <Co>'",
    "  avatar: 'javascript:alert(1)'",
    "---",
    "Hello world",
  ].join("\n"));
  const data = getFolioDocByline(authored);
  assert.equal(data.author.name, "Mira <Co>");
  assert.equal(data.author.avatar, undefined);
  assert.equal(data.date, undefined);
  for (const markup of [
    renderToStaticMarkup(createElement(FolioDocMeta, { doc: authored })),
    renderFolioStaticDocMeta(authored),
  ]) {
    assert.match(markup, /Mira &lt;Co&gt;/);
    assert.doesNotMatch(markup, /javascript:|<img|<time|folio-doc-meta__separator.*<time/);
  }
});

test("reading time counts prose, not fenced code, and is deterministic for Chinese content", () => {
  const authored = parseFolioDoc("blogs/long.md", [
    "---", "title: Long", "author: 编辑部", "---",
    "内容".repeat(1050),
    "```ts",
    "内容".repeat(1000),
    "```",
  ].join("\n"));
  assert.equal(getFolioDocByline(authored).readingMinutes, 6);
});

test("the reading shell and static project output render byline before Markdown", () => {
  const html = renderToStaticMarkup(createElement(
    MemoryRouter, { initialEntries: [doc.path] },
    createElement(FolioDocsShell, { doc, docs: [doc] }),
  ));
  const staticHtml = renderFolioStaticProjectShell(context, { ...doc, type: "project" });
  for (const value of [html, staticHtml]) {
    assert.equal((value.match(/class="folio-doc-meta"/g) || []).length, 1);
    assert.ok(value.indexOf("folio-doc-meta") < value.indexOf("folio-markdown"));
    assert.match(value, /Alice &amp; Bob/);
  }
});


test("GitHub avatar is rendered on both surfaces only for the matching Git author", () => {
  const gitDoc = {
    ...doc,
    gitHistory: { first: { author: "Alice & Bob", committedAt: "2020-01-02T00:00:00Z", githubAvatarUrl: "https://avatars.githubusercontent.com/u/12345?s=64" } },
  };
  for (const markup of [
    renderToStaticMarkup(createElement(FolioDocMeta, { doc: gitDoc })),
    renderFolioStaticDocMeta(gitDoc),
  ]) {
    assert.match(markup, /src="https:\/\/avatars\.githubusercontent\.com\/u\/12345\?s=64"/);
    assert.match(markup, /Alice &amp; Bob/);
    assert.doesNotMatch(markup, /@users\.noreply\.github\.com/);
  }
  const unrelated = { ...gitDoc, data: { author: "Editorial" } };
  assert.equal(getFolioDocByline(unrelated)?.author?.avatar, undefined);
});


test("metadata combinations keep React and static separators consistent", () => {
  const cases = [
    { label: "empty", data: {}, body: "", fragments: 0 },
    { label: "code-only", data: {}, body: "```js\\nconst x = 1;\\n```", fragments: 0 },
    { label: "author-only", data: { author: "Writer" }, body: "", fragments: 0 },
    { label: "date-only", data: { createdAt: "2024-01-02" }, body: "", fragments: 0 },
    { label: "author-and-prose", data: { author: "Writer" }, body: "hello", fragments: 1 },
    { label: "date-and-prose", data: { createdAt: "2024-01-02" }, body: "hello", fragments: 1 },
    { label: "all", data: { author: "Writer", createdAt: "2024-01-02" }, body: "hello", fragments: 2 },
  ];
  for (const item of cases) {
    const input = parseFolioDoc("reference/" + item.label + ".md",
      "---\\ntitle: Case\\n" + Object.entries(item.data).map(([key, value]) => key + ": " + value + "\\n").join("") + "---\\n" + item.body);
    const html = renderToStaticMarkup(createElement(FolioDocMeta, { doc: input }));
    const staticHtml = renderFolioStaticDocMeta(input);
    for (const markup of [html, staticHtml]) {
      assert.equal((markup.match(/folio-doc-meta__separator/g) || []).length, item.fragments, item.label);
      assert.equal((markup.match(/约 1 分钟/g) || []).length, item.body === "hello" ? 1 : 0, item.label);
    }
  }
});
