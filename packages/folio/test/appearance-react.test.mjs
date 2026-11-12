import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioHome, useFolioAppearance, resolveFolioHome } from "../dist/index.js";
import { renderFolioStaticHome } from "../dist/vite.js";

const config = {
  title: "Field Notes",
  description: "A real consumer",
  collections: [{ path: "/notes", title: "Notes" }],
};
const docs = [
  { id: "one", path: "/notes/one", type: "article", title: "First",
    description: "Description", order: 1, body: "", headings: [], data: {}, tags: [] },
];

function reactHome(template, as = "main") {
  return renderToStaticMarkup(createElement(MemoryRouter,
    { basename: "/folio", initialEntries: ["/folio/"] },
    createElement(FolioHome, { config, docs, template, as }),
  ));
}

test("public FolioHome reuses the default Portal model and Router basename", () => {
  assert.equal(resolveFolioHome(config, docs).template, "portal");
  const html = reactHome(undefined);
  assert.match(html, /^<main class="folio-home folio-home--portal">/);
  assert.match(html, /<h1>Field Notes<\/h1>/);
  assert.match(html, /href="\/folio\/notes\/one"/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
});

test("embedded Editorial uses real template markup without a nested main", () => {
  const html = reactHome("editorial", "div");
  assert.match(html, /^<div class="folio-home folio-journal-home folio-editorial-home">/);
  assert.match(html, /FEATURED STORY/);
  assert.match(html, /href="\/folio\/notes\/one"/);
  assert.doesNotMatch(html, /<main\b/);
  assert.equal(config.home, undefined, "template override must not mutate config");
});

test("composed home preserves shared model and generated static template selection", () => {
  const editorialConfig = { ...config, home: { template: "editorial" } };
  const html = reactHome("editorial");
  assert.match(html, /PERSONAL JOURNAL/);
  const staticHtml = renderFolioStaticHome({
    config: editorialConfig, docs, roots: [], base: "/folio/", outDir: "/tmp/folio-test",
  });
  assert.match(staticHtml, /PERSONAL JOURNAL/);
  assert.match(staticHtml, /folio-editorial-home/);
});

test("appearance hook fails clearly outside its FolioApp owner", () => {
  function DisconnectedConsumer() {
    useFolioAppearance();
    return null;
  }
  assert.throws(
    () => renderToStaticMarkup(createElement(DisconnectedConsumer)),
    /must be used within FolioApp/,
  );
});
