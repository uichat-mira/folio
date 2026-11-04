import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  FolioHeader,
  FolioShareButton,
  resolveFolioNavigation,
} from "../dist/index.js";

// The header has a real router dependency, so these tests render actual markup
// instead of asserting on source text. Markup assertions catch the regressions
// that matter here: a lost ARIA attribute, a nav entry that stopped being a
// link, a mobile disclosure that lost its state.

const config = {
  title: "Folio",
  description: "Test site",
  github: "https://github.com/uichat-mira/folio",
  navigation: [{ label: "文章", href: "/blogs" }],
};

function render(props = {}, path = "/") {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(FolioHeader, { config, ...props }),
    ),
  );
}

const structured = [
  {
    label: "开始",
    href: "/docs/introduction",
    children: [
      {
        label: "内容协议",
        href: "/docs/content-contract",
        icon: "file",
        description: "Frontmatter 字段与目录即路由的约定。",
      },
    ],
    panel: { eyebrow: "FOLIO HANDBOOK", title: "从零到第一篇文档" },
  },
];

test("header primitives are public runtime exports", () => {
  assert.equal(typeof FolioHeader, "function");
  assert.equal(typeof FolioShareButton, "function");
  assert.equal(typeof resolveFolioNavigation, "function");
});

test("the header keeps its shell, brand and right-hand cluster", () => {
  const html = render();
  assert.ok(html.startsWith('<header class="folio-header">'), "header shell renders");
  assert.match(html, /class="folio-header__wrap"/);
  assert.match(html, /class="folio-brand"/);
  assert.match(html, /class="folio-header__nav"/);
  assert.match(html, /class="folio-header-actions"/);
  assert.match(html, /class="folio-desktop-nav"/);
});

test("plain navigation entries still render as ordinary links", () => {
  const html = render();
  assert.match(html, /<li><a class="" href="\/blogs"/);
  assert.match(html, /href="\/blogs"/);
  assert.doesNotMatch(html, /aria-haspopup/, "a plain entry must not become a menu");
});

test("an active plain entry is marked for assistive technology", () => {
  const html = render({}, "/blogs");
  assert.match(html, /<a class="active" aria-current="page" href="\/blogs"/);
  assert.match(html, /aria-current="page"/);
});

test("a structured entry renders a disclosure trigger and its panel", () => {
  const html = render({ navigation: structured });

  assert.match(html, /class="folio-nav-menu__trigger/);
  assert.match(html, /aria-haspopup="true"/);
  assert.match(html, /aria-expanded="false"/, "closed by default");
  assert.match(html, /class="folio-nav-menu__panel"/);
  assert.match(html, /FOLIO HANDBOOK/);
  assert.match(html, /从零到第一篇文档/);
  assert.match(html, /href="\/docs\/content-contract"/);
  assert.match(html, /Frontmatter 字段与目录即路由的约定。/);
  assert.match(html, /全部开始/, "generated overview entry is present");
});

test("the panel does not claim to be open on first render", () => {
  const html = render({ navigation: structured });
  assert.doesNotMatch(html, /aria-expanded="true"/);
});

test("the mobile panel exposes an accordion, not the desktop panel", () => {
  const html = render({ navigation: structured });

  assert.match(html, /class="folio-mobile-panel"/);
  assert.match(html, /class="folio-mobile-group"/);
  assert.match(html, /class="folio-mobile-group__trigger"/);
  assert.match(html, /class="folio-mobile-group__panel"/);

  // The desktop panel markup must not be reused inside the mobile panel: the
  // mobile disclosure owns its own buttons and its own ids.
  const mobile = html.slice(html.indexOf('class="folio-mobile-panel"'));
  assert.doesNotMatch(mobile, /folio-nav-menu__panel/);
});

test("mobile disclosure buttons start collapsed and are labelled", () => {
  const html = render({ navigation: structured });

  const trigger = html.match(/<button[^>]*folio-mobile-group__trigger[^>]*>/);
  assert.ok(trigger, "mobile group trigger renders as a button");
  assert.match(trigger[0], /aria-expanded="false"/);
  assert.match(trigger[0], /aria-controls="/);

  const menuButton = html.match(/<button[^>]*folio-mobile-menu-button[^>]*>/);
  assert.ok(menuButton, "menu button renders");
  assert.match(menuButton[0], /aria-expanded="false"/);
  assert.match(menuButton[0], /aria-controls="/);
});

test("utility actions keep their labels and the search hint", () => {
  const html = render({ onSearch: () => {}, onToggleTheme: () => {}, darkMode: true });
  assert.match(html, /class="folio-search-trigger"/);
  assert.match(html, /⌘K/);
  assert.match(html, /切换到浅色模式/);
  assert.match(html, /href="https:\/\/github.com\/uichat-mira\/folio"/);
});

test("navigation defaults to the config's own navigation", () => {
  const html = render();
  assert.match(html, /href="\/blogs"/);
});

test("no navigation config renders no nav items but keeps the header", () => {
  const html = render({ config: { title: "Empty", description: "" } });
  assert.match(html, /class="folio-header"/);
  assert.doesNotMatch(html, /class="folio-nav-menu"/);
});

test("a consumer render prop still reaches the header actions", () => {
  const html = render({ actions: createElement("span", { id: "x" }, "custom") });
  assert.match(html, /class="folio-consumer-header-actions"/);
  assert.match(html, /<span id="x">custom<\/span>/);
});

test("the share button hides until there is a current document", () => {
  const withoutDoc = render();
  assert.doesNotMatch(withoutDoc, /folio-share-button/);

  const withDoc = render({ currentDoc: { title: "介绍", description: "一个文档" } });
  assert.match(withDoc, /folio-mobile-doc-share/);
});
