import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { FolioFooter } from "../dist/index.js";

function render(footer, { siteTitle = "Example", basename } = {}) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { basename, initialEntries: [basename ? basename + "/" : "/"] },
      createElement(FolioFooter, { footer, siteTitle }),
    ),
  );
}

test("the default footer is unchanged for existing consumers", () => {
  assert.equal(
    render(undefined),
    '<footer class="folio-footer">Built with Folio.</footer>',
  );
  assert.equal(
    render("From the archive."),
    '<footer class="folio-footer">From the archive.</footer>',
  );
  assert.equal(
    render(""),
    '<footer class="folio-footer"></footer>',
    "an explicit empty string must not be replaced with the fallback",
  );
});

test("footer false suppresses the entire landmark", () => {
  assert.equal(render(false), "");
});

test("structured footer renders brand, groups and legal metadata", () => {
  const html = render({
    brand: { description: "A source-controlled publication." },
    groups: [
      { title: "Read", links: [
        { label: "Introduction", href: "/guide/introduction" },
        { label: "GitHub", href: "https://github.com/example/folio", newTab: true },
      ] },
      { title: "About", links: [{ label: "The team", href: "/about" }] },
    ],
    legal: {
      copyright: "© 2026 Example",
      registrations: [{ label: "Official registry", href: "https://registry.example/id" }],
      links: [{ label: "Privacy", href: "/privacy" }],
    },
  });
  assert.match(html, /^<footer class="folio-footer folio-footer--structured">/);
  assert.match(html, /aria-label="页脚导航"/);
  assert.match(html, /href="\/"[^>]*>.*?Example/s);
  assert.match(html, /<h2>Read<\/h2>/);
  assert.match(html, /<h2>About<\/h2>/);
  assert.match(html, /href="\/guide\/introduction"/);
  assert.match(html, /href="https:\/\/github.com\/example\/folio"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /Official registry/);
  assert.match(html, /© 2026 Example/);
});

test("root-relative brand assets and internal links honor a subpath basename", () => {
  const html = render({
    brand: { logo: {
      src: "/folio-logo.svg",
      darkSrc: "/folio-logo-inverse.svg",
      alt: "Folio logotype",
    } },
    groups: [{ title: "Docs", links: [{ label: "Start", href: "/guide/start" }] }],
  }, { basename: "/folio" });
  assert.match(html, /src="\/folio\/folio-logo.svg"/);
  assert.match(html, /src="\/folio\/folio-logo-inverse.svg"/);
  assert.match(html, /alt="Folio logotype"/);
  assert.match(html, /href="\/folio\/guide\/start"/);
  assert.match(html, /href="\/folio"/, "React Router may omit the trailing slash for its basename root");
  assert.doesNotMatch(html, /href="\/guide\/start"/);
});

test("external logo URL is not rewritten; labels are HTML-escaped", () => {
  const html = render({
    brand: {
      name: "<Folio>",
      logo: { src: "https://cdn.example/brand.svg" },
    },
    groups: [{ title: "Safety", links: [{ label: "<b>not HTML</b>", href: "/safe" }] }],
  });
  assert.match(html, /src="https:\/\/cdn.example\/brand.svg"/);
  assert.match(html, /alt="&lt;Folio&gt;"/);
  assert.match(html, /&lt;b&gt;not HTML&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>not HTML<\/b>/);
});

test("legal-only structured footer and empty object do not invent claims", () => {
  const legalOnly = render({ legal: { registrations: [{ label: "A registration", href: "/registry" }] } });
  assert.doesNotMatch(legalOnly, /folio-footer__brand/);
  assert.match(legalOnly, /A registration/);
  assert.doesNotMatch(legalOnly, /©/);
  assert.doesNotMatch(render({}), /©|备案|Official registry/);
});
