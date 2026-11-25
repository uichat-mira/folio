import test from "node:test";
import assert from "node:assert/strict";

import worker, { isWeChatRequest, selectImagePath } from "./worker.js";

test("detects WeChat browsers, crawlers and proxied image requests", () => {
  assert.equal(
    isWeChatRequest("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 MicroMessenger/8.0.50"),
    true,
  );
  assert.equal(isWeChatRequest("WeChat/8.0.50"), true);
  assert.equal(
    isWeChatRequest("Mozilla/5.0", "https://servicewechat.com/wx123/42"),
    true,
  );
});

test("does not classify other social crawlers as WeChat", () => {
  assert.equal(isWeChatRequest("Twitterbot/1.0"), false);
  assert.equal(isWeChatRequest("facebookexternalhit/1.1"), false);
  assert.equal(isWeChatRequest("Mozilla/5.0 (Macintosh) Chrome/140.0.0.0"), false);
  assert.equal(isWeChatRequest("", "https://example.com/folio/"), false);
});

test("selects the square mark for WeChat and the wide card otherwise", () => {
  const env = {
    WECHAT_IMAGE: "/folio/icon-512.png",
    DEFAULT_IMAGE: "/folio/folio-og-1200x630.png",
  };

  assert.equal(
    selectImagePath("Mozilla/5.0 MicroMessenger/8.0.50", "", env),
    "/folio/icon-512.png",
  );
  assert.equal(
    selectImagePath("Twitterbot/1.0", "", env),
    "/folio/folio-og-1200x630.png",
  );
});

test("falls back to the default site paths", () => {
  assert.equal(selectImagePath("MicroMessenger/8.0", "", {}), "/folio/icon-512.png");
  assert.equal(selectImagePath("Twitterbot/1.0", "", {}), "/folio/folio-og-1200x630.png");
});

async function withStubbedFetch(run) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { "content-type": "image/png", "cache-control": "max-age=600" },
    });
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("serves the WeChat mark and keeps the shared URL uncacheable", async () => {
  await withStubbedFetch(async (calls) => {
    const response = await worker.fetch(
      new Request("https://worker.example/og", {
        headers: { "user-agent": "Mozilla/5.0 MicroMessenger/8.0.50" },
      }),
      {},
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-folio-og-variant"), "wechat");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("vary"), /User-Agent/);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(calls[0].url, "https://uichat-mira.github.io/folio/icon-512.png");
  });
});

test("serves the wide card to other crawlers", async () => {
  await withStubbedFetch(async (calls) => {
    const response = await worker.fetch(
      new Request("https://worker.example/og", {
        headers: { "user-agent": "Twitterbot/1.0" },
      }),
      {},
    );

    assert.equal(response.headers.get("x-folio-og-variant"), "default");
    assert.equal(calls[0].url, "https://uichat-mira.github.io/folio/folio-og-1200x630.png");
  });
});

test("rejects other paths and non-read methods", async () => {
  const notFound = await worker.fetch(new Request("https://worker.example/other"), {});
  assert.equal(notFound.status, 404);

  const notAllowed = await worker.fetch(
    new Request("https://worker.example/og", { method: "POST" }),
    {},
  );
  assert.equal(notAllowed.status, 405);
});

test("reports upstream failures as 502", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/og"), {});
    assert.equal(response.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
