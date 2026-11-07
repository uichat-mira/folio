import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioHeader } from "../dist/index.js";

const config = { title: "Folio", description: "Demo" };

function renderHeader(props = {}) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(FolioHeader, {
        config,
        searchEnabled: false,
        themeEnabled: false,
        shareEnabled: false,
        ...props,
      }),
    ),
  );
}

test("header uses its default text when no custom brand is supplied", () => {
  assert.match(renderHeader(), /<span>Folio<\\/span>/);
});

test("header brand slot replaces only brand contents, keeping the link", () => {
  const html = renderHeader({
    brand: createElement("span", {
      className: "site-header-wordmark",
      role: "img",
      "aria-label": "Folio",
    }),
  });
  assert.match(html, /class="folio-brand"/);
  assert.match(html, /class="site-header-wordmark"/);
  assert.doesNotMatch(html, /<span>Folio<\\/span>/);
});
