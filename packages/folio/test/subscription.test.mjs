import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useFolioJsonSubscription } from "../dist/index.js";

test("public JSON subscription renders its initial verified snapshot without fetch during SSR", () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error("SSR must not request remote subscriptions"); };
  function TestConsumer() {
    const result = useFolioJsonSubscription({
      url: "https://example.org/books/catalog.json",
      initialData: { books: [{ title: "Offline verified cover" }] },
      validate: (value) => Boolean(value && typeof value === "object"),
    });
    return createElement("p", { "data-status": result.status }, result.data.books[0].title);
  }
  try {
    const html = renderToStaticMarkup(createElement(TestConsumer));
    assert.match(html, /data-status="snapshot"/);
    assert.match(html, /Offline verified cover/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
