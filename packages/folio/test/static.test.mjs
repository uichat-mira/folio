import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  renderFolioStaticHtml,
  writeFolioStaticSite,
} from "../dist/vite.js";

const template = `<!doctype html><html><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>`;

function context(outDir = "/tmp/folio") {
  return {
    config: {
      title: "Folio",
      description: "Docs runtime",
      siteUrl: "https://example.com",
    },
    docs: [],
    roots: [],
    base: "/guide/",
    outDir,
  };
}

test("static HTML includes canonical, social metadata, JSON-LD, and body", () => {
  const html = renderFolioStaticHtml(
    template,
    {
      path: "/intro",
      title: "Introduction",
      description: "Start here",
      body: "<main><h1>Hello</h1></main>",
      type: "article",
      robots: "index,follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Introduction",
      },
    },
    context(),
    {
      locale: "zh_CN",
      defaultImage: "logo.png",
      image: { type: "image/png", width: 940, height: 760 },
    },
  );

  assert.match(html, /<title>Introduction · Folio<\/title>/);
  assert.match(html, /https:\/\/example\.com\/guide\/intro\//);
  assert.match(html, /https:\/\/example\.com\/guide\/logo\.png/);
  assert.match(html, /property="og:locale" content="zh_CN"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<div id="root"><main><h1>Hello<\/h1><\/main><\/div>/);
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
});

test("static site writer creates routes, 404, sitemap, and robots", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-static-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const result = writeFolioStaticSite(context(outDir), {
      routes: () => [
        {
          path: "/",
          title: "Home",
          description: "Home page",
          body: "<main>Home</main>",
        },
        {
          path: "/article",
          title: "Article",
          description: "Article page",
          body: "<main>Article</main>",
          type: "article",
        },
      ],
      notFound: () => ({
        path: "/404",
        title: "Missing",
        description: "Missing page",
        body: "<main>Missing</main>",
        robots: "noindex,nofollow",
      }),
    });

    assert.equal(result.routes, 2);
    assert.match(readFileSync(resolve(outDir, "index.html"), "utf8"), /Home/);
    assert.match(
      readFileSync(resolve(outDir, "article/index.html"), "utf8"),
      /Article/,
    );
    assert.match(
      readFileSync(resolve(outDir, "404.html"), "utf8"),
      /noindex,nofollow/,
    );
    assert.match(
      readFileSync(resolve(outDir, "sitemap.xml"), "utf8"),
      /https:\/\/example\.com\/guide\/article\//,
    );
    assert.equal(
      readFileSync(resolve(outDir, "robots.txt"), "utf8"),
      "User-agent: *\nAllow: /\nSitemap: https://example.com/guide/sitemap.xml\n",
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});


test("default document routes use the documentation structure shell", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-doc-shell-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const docs = [
      {
        id: "intro",
        path: "/docs/intro",
        sourcePath: "docs/intro.md",
        type: "doc",
        title: "Introduction",
        description: "Start here",
        group: "Guide",
        collection: "Core",
        section: "Getting started",
        order: 1,
        tags: [],
        body: "## First section\nHello",
        headings: [{ depth: 2, text: "First section", id: "first-section" }],
        data: {},
      },
      {
        id: "runtime",
        path: "/docs/runtime",
        sourcePath: "docs/runtime.md",
        type: "doc",
        title: "Runtime",
        description: "Runtime docs",
        group: "Guide",
        collection: "Core",
        section: "Runtime",
        order: 2,
        tags: [],
        body: "## Runtime section\nBody",
        headings: [{ depth: 2, text: "Runtime section", id: "runtime-section" }],
        data: {},
      },
    ];

    writeFolioStaticSite({ ...context(outDir), docs });

    const html = readFileSync(
      resolve(outDir, "docs/intro/index.html"),
      "utf8",
    );

    assert.match(html, /class="folio-docs-shell"/);
    assert.match(html, /class="folio-docnav"/);
    assert.match(html, /class="folio-toc"/);
    assert.match(html, /class="folio-page-nav"/);
    assert.match(html, /href="\/guide\/docs\/runtime\/"/);
    assert.match(html, /href="#first-section"/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});


test("static document shell keeps mobile navigation without JavaScript", () => {
  const outDir = mkdtempSync(resolve(tmpdir(), "folio-static-mobile-docs-"));
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    const docs = [
      {
        id: "intro",
        path: "/docs/intro",
        sourcePath: "docs/intro.md",
        type: "doc",
        title: "Introduction",
        description: "Start here",
        group: "Guide",
        collection: "Core",
        section: "Start",
        order: 1,
        tags: [],
        body: "## First section\nHello",
        headings: [{ depth: 2, text: "First section", id: "first-section" }],
        data: {},
      },
    ];

    writeFolioStaticSite({ ...context(outDir), docs });

    const html = readFileSync(
      resolve(outDir, "docs/intro/index.html"),
      "utf8",
    );

    assert.match(html, /folio-docs-mobile-bar--static/);
    assert.match(html, /<details class="folio-static-doc-menu">/);
    assert.match(html, /<summary>菜单<\/summary>/);
    assert.match(html, /<summary>页面导航<\/summary>/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// 越界回归：(outDir, outside/index.html 哨兵文件)，越界路由恰好指向该哨兵。
function escapeFixture(prefix) {
  const base = mkdtempSync(resolve(tmpdir(), prefix));
  const outDir = resolve(base, "out");
  const outside = resolve(base, "outside");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(resolve(outDir, "index.html"), template, "utf8");
  const sentinel = resolve(outside, "index.html");
  writeFileSync(sentinel, "sentinel", "utf8");
  return { base, outDir, sentinel };
}

test("static site writer keeps valid nested routes inside outDir", () => {
  const base = mkdtempSync(resolve(tmpdir(), "folio-nested-routes-"));
  const outDir = resolve(base, "out");
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");

    writeFolioStaticSite(context(outDir), {
      routes: () => [
        {
          path: "/",
          title: "Home",
          description: "Home page",
          body: "<main>Home</main>",
        },
        {
          path: "/docs/guide/intro",
          title: "Intro",
          description: "Nested route",
          body: "<main>Nested</main>",
        },
      ],
    });

    const nested = resolve(outDir, "docs/guide/intro/index.html");
    assert.equal(existsSync(nested), true);
    assert.match(readFileSync(nested, "utf8"), /Nested/);
    assert.equal(existsSync(resolve(base, "docs")), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("static site writer refuses traversal routes without writing outside outDir", () => {
  const { base, outDir, sentinel } = escapeFixture("folio-escape-");
  try {
    assert.throws(
      () =>
        writeFolioStaticSite(context(outDir), {
          routes: () => [
            {
              path: "/docs/ok",
              title: "Ok",
              description: "Valid route",
              body: "<main>Ok</main>",
            },
            {
              path: "/../outside",
              title: "Escaped",
              description: "Traversal route",
              body: "<main>Escaped</main>",
            },
          ],
        }),
      (error) => {
        assert.match(error.message, /folio static route "\/\.\.\/outside"/);
        assert.match(
          error.message,
          /path segment "\.\." escapes the output directory/,
        );
        assert.ok(error.message.includes(JSON.stringify(outDir)));
        return true;
      },
    );

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
    // 校验先于落盘：合法路由也不会留下半成品输出。
    assert.equal(existsSync(resolve(outDir, "docs/ok/index.html")), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("static site writer refuses escapes that only appear after normalization", () => {
  const { base, outDir, sentinel } = escapeFixture("folio-escape-normalized-");
  try {
    assert.throws(
      () =>
        writeFolioStaticSite(context(outDir), {
          routes: () => [
            {
              path: "/guide/../../outside",
              title: "Escaped",
              description: "Traversal route",
              body: "<main>Escaped</main>",
            },
          ],
        }),
      /path segment "\.\." escapes the output directory/,
    );

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("static site writer refuses ambiguous Windows path segments", () => {
  const { base, outDir, sentinel } = escapeFixture("folio-escape-windows-");
  try {
    for (const path of ["/..\\\\outside", "/...", "/.. "]) {
      assert.throws(
        () =>
          writeFolioStaticSite(context(outDir), {
            routes: () => [
              {
                path,
                title: "Bad",
                description: "Bad route",
                body: "<main>Bad</main>",
              },
            ],
          }),
        /folio static route/,
        `expected ${JSON.stringify(path)} to be refused`,
      );
    }

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("default document routes are validated before any static output", () => {
  const { base, outDir, sentinel } = escapeFixture("folio-escape-default-");
  try {
    const docs = [
      {
        id: "escaped",
        path: "/../outside",
        sourcePath: "docs/escaped.md",
        type: "doc",
        title: "Escaped",
        description: "Traversal doc",
        group: "Guide",
        collection: "Core",
        section: "Start",
        order: 1,
        tags: [],
        body: "## Escaped\nBody",
        headings: [],
        data: {},
      },
    ];

    assert.throws(
      () => writeFolioStaticSite({ ...context(outDir), docs }),
      /path segment "\.\." escapes the output directory/,
    );
    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
    assert.equal(existsSync(resolve(outDir, "escaped/index.html")), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// symlink / Windows junction 只能在支持的平台上创建；不支持时用例显式跳过而不是假装通过。
function supportsLinks(kind) {
  const base = mkdtempSync(resolve(tmpdir(), "folio-link-probe-"));
  try {
    if (kind === "dir") {
      const target = resolve(base, "target");
      mkdirSync(target);
      symlinkSync(
        target,
        resolve(base, "link"),
        process.platform === "win32" ? "junction" : "dir",
      );
      return true;
    }
    const file = resolve(base, "target.txt");
    writeFileSync(file, "probe", "utf8");
    symlinkSync(file, resolve(base, "link.txt"), "file");
    return true;
  } catch {
    return false;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

test("static site writer refuses routes that escape through an existing directory link", (t) => {
  if (!supportsLinks("dir")) {
    t.skip("this platform cannot create a directory symlink/junction here");
    return;
  }

  const base = mkdtempSync(resolve(tmpdir(), "folio-escape-link-"));
  const outDir = resolve(base, "out");
  const outside = resolve(base, "outside");
  try {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");
    const sentinel = resolve(outside, "index.html");
    writeFileSync(sentinel, "sentinel", "utf8");

    // 词法上 /docs 完全合法；只有真实路径暴露出这是越界链接。
    symlinkSync(outside, resolve(outDir, "docs"), directoryLinkType);
    assert.equal(
      lstatSync(resolve(outDir, "docs")).isSymbolicLink(),
      true,
      "fixture precondition: docs must be a directory link",
    );

    assert.throws(
      () =>
        writeFolioStaticSite(context(outDir), {
          routes: () => [
            {
              path: "/docs",
              title: "Linked",
              description: "Escape through an existing directory link",
              body: "<main>Linked</main>",
            },
          ],
        }),
      (error) => {
        assert.match(
          error.message,
          /resolves outside of the output directory/,
        );
        assert.ok(error.message.includes(JSON.stringify(resolve(outDir, "docs"))));
        return true;
      },
    );

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");

    // 对照：无链接的正常嵌套路由仍然可以写入。
    writeFolioStaticSite(context(outDir), {
      routes: () => [
        {
          path: "/guide/intro",
          title: "Intro",
          description: "Valid route",
          body: "<main>Guide intro</main>",
        },
      ],
    });
    assert.match(
      readFileSync(resolve(outDir, "guide/intro/index.html"), "utf8"),
      /Guide intro/,
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("static site writer refuses an existing symlink at the target file", (t) => {
  if (!supportsLinks("file")) {
    t.skip("this platform cannot create a file symlink here");
    return;
  }

  const base = mkdtempSync(resolve(tmpdir(), "folio-escape-target-link-"));
  const outDir = resolve(base, "out");
  const outside = resolve(base, "outside");
  try {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), template, "utf8");
    mkdirSync(resolve(outDir, "docs"), { recursive: true });

    const sentinel = resolve(outside, "index.html");
    writeFileSync(sentinel, "sentinel", "utf8");
    symlinkSync(sentinel, resolve(outDir, "docs/index.html"), "file");

    assert.throws(
      () =>
        writeFolioStaticSite(context(outDir), {
          routes: () => [
            {
              path: "/docs",
              title: "Linked file",
              description: "Escape through an existing target file link",
              body: "<main>Linked file</main>",
            },
          ],
        }),
      /existing target .* is a symbolic link/,
    );

    assert.equal(readFileSync(sentinel, "utf8"), "sentinel");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
