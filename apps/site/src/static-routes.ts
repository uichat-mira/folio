import {
  assertNoFolioCollectionConflicts,
  findFolioDocCollection,
  folioCollectionIndexes,
  getFolioDocNeighbors,
  renderFolioMarkdown,
  selectFolioCollectionDocs,
  type FolioDoc,
} from "@uichat-mira/folio";
import {
  folioEscapeHtml,
  renderFolioStaticProjectShell,
  type FolioStaticBuildContext,
  type FolioStaticRoute,
} from "@uichat-mira/folio/vite";
import { withFolioBaseLinks } from "./content-links";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const TYPE_LABEL: Record<string, string> = {
  doc: "文档",
  article: "文章",
  project: "项目",
  page: "页面",
};

function href(base: string, path: string): string {
  const prefix = base === "/" ? "/" : base.replace(/\/+$/, "") + "/";
  const route = path.startsWith("/") ? path.slice(1) : path;
  return prefix + route;
}

function markdown(doc: FolioDoc, base: string): string {
  return renderFolioMarkdown(withFolioBaseLinks(doc.body, base), { removeH1: true });
}

function renderToc(doc: FolioDoc): string {
  if (!doc.headings.length) return "";
  return (
    '<aside class="folio-toc" aria-label="本页目录"><h2>本页目录</h2><ul>' +
    doc.headings
      .map(
        (heading) =>
          '<li class="folio-toc-depth-' +
          heading.depth +
          '"><a href="#' +
          folioEscapeHtml(heading.id) +
          '">' +
          folioEscapeHtml(heading.text) +
          "</a></li>",
      )
      .join("") +
    "</ul></aside>"
  );
}

function renderDocNav(context: FolioStaticBuildContext, doc: FolioDoc): string {
  const collection = findFolioDocCollection(context.docs, doc);
  if (!collection) return "";

  const sections = collection.sections
    .map(
      (section) =>
        "<section><h2>" +
        folioEscapeHtml(section.title) +
        "</h2><ul>" +
        section.docs
          .map(
            (item) =>
              '<li><a' +
              (item.path === doc.path ? ' class="active" aria-current="page"' : "") +
              ' href="' +
              folioEscapeHtml(href(context.base, item.path)) +
              '">' +
              folioEscapeHtml(item.title) +
              "</a></li>",
          )
          .join("") +
        "</ul></section>",
    )
    .join("");

  return '<nav class="folio-docnav" aria-label="文档目录">' + sections + "</nav>";
}

function renderPager(context: FolioStaticBuildContext, doc: FolioDoc): string {
  const { previous, next } = getFolioDocNeighbors(context.docs, doc);
  if (!previous && !next) return "";

  const previousHtml = previous
    ? '<a class="folio-page-nav__previous" href="' +
      folioEscapeHtml(href(context.base, previous.path)) +
      '"><span>上一篇</span><strong>' +
      folioEscapeHtml(previous.title) +
      "</strong></a>"
    : "<span></span>";
  const nextHtml = next
    ? '<a class="folio-page-nav__next" href="' +
      folioEscapeHtml(href(context.base, next.path)) +
      '"><span>下一篇</span><strong>' +
      folioEscapeHtml(next.title) +
      "</strong></a>"
    : "<span></span>";

  return (
    '<nav class="folio-page-nav" aria-label="文档分页">' +
    previousHtml +
    nextHtml +
    "</nav>"
  );
}

function renderEntryList(
  context: FolioStaticBuildContext,
  docs: FolioDoc[],
  heading: "h2" | "h3",
): string {
  return (
    '<div class="folio-entry-list">' +
    docs
      .map(
        (doc, index) =>
          '<a class="folio-entry" href="' +
          folioEscapeHtml(href(context.base, doc.path)) +
          '"><span class="folio-entry-number" aria-hidden="true">' +
          String(index + 1).padStart(2, "0") +
          '</span><div class="folio-entry-copy">' +
          (doc.date
            ? '<time class="folio-entry-date" datetime="' +
              folioEscapeHtml(doc.date) +
              '">' +
              folioEscapeHtml(doc.date) +
              "</time>"
            : "") +
          "<" +
          heading +
          ' class="folio-entry-title">' +
          folioEscapeHtml(doc.title) +
          "</" +
          heading +
          ">" +
          (doc.description
            ? '<p class="folio-entry-description">' + folioEscapeHtml(doc.description) + "</p>"
            : "") +
          "</div><span class=\"folio-entry-arrow\" aria-hidden=\"true\">↗</span></a>",
      )
      .join("") +
    "</div>"
  );
}

function renderDoc(context: FolioStaticBuildContext, doc: FolioDoc): string {
  return (
    '<div class="folio-docs-runtime folio-docs-runtime--static"><div class="folio-docs-shell">' +
    renderDocNav(context, doc) +
    '<main class="folio-doc-main"><h1>' +
    folioEscapeHtml(doc.title) +
    "</h1>" +
    (doc.description
      ? '<p class="folio-lede">' + folioEscapeHtml(doc.description) + "</p>"
      : "") +
    '<article class="folio-markdown">' +
    markdown(doc, context.base) +
    "</article>" +
    renderPager(context, doc) +
    "</main>" +
    renderToc(doc) +
    "</div></div>"
  );
}

function renderArticle(context: FolioStaticBuildContext, doc: FolioDoc): string {
  const article =
    '<main class="folio-doc-page folio-article-main">' +
    '<div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) +
    "</div></div><h1>" +
    folioEscapeHtml(doc.title) +
    "</h1>" +
    (doc.description
      ? '<p class="folio-lede">' + folioEscapeHtml(doc.description) + "</p>"
      : "") +
    '<article class="folio-markdown">' +
    markdown(doc, context.base) +
    "</article></main>";
  const toc = renderToc(doc);
  if (!toc) return article;
  return (
    '<div class="folio-article-layout"><details class="folio-article-mobile-toc"><summary>本页目录</summary>' +
    toc +
    "</details>" +
    article +
    toc +
    "</div>"
  );
}

function renderGeneric(context: FolioStaticBuildContext, doc: FolioDoc): string {
  return (
    '<main class="folio-prerender folio-prerender--' +
    folioEscapeHtml(doc.type) +
    '"><p class="folio-prerender__eyebrow">' +
    folioEscapeHtml(doc.group) +
    " · " +
    folioEscapeHtml(TYPE_LABEL[doc.type] ?? doc.type) +
    "</p><h1>" +
    folioEscapeHtml(doc.title) +
    "</h1>" +
    (doc.description ? "<p>" + folioEscapeHtml(doc.description) + "</p>" : "") +
    '<article class="folio-markdown">' +
    markdown(doc, context.base) +
    "</article></main>"
  );
}

// Pre-render the same public-API-only HomePage used by the client. Maintaining
// two separately handwritten home implementations previously made the static
// index.html stale after a client redesign.
function renderHome(context: FolioStaticBuildContext): string {
  const basename = context.base === "/" ? undefined : context.base.replace(/[/]$/, "");
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { basename, initialEntries: [href(context.base, "/")] },
      createElement(HomePage, { docs: context.docs }),
    ),
  );
}

function renderCollection(
  context: FolioStaticBuildContext,
  path: string,
  title: string,
  description: string,
  emptyMessage: string,
): string {
  const entries = selectFolioCollectionDocs(context.docs, path);
  return (
    '<main class="folio-home folio-collection-page"><header class="folio-journal-hero folio-collection-hero">' +
    '<span class="folio-journal-kicker">COLLECTION · ' +
    entries.length +
    " ENTRIES</span><h1>" +
    folioEscapeHtml(title) +
    "</h1>" +
    (description ? "<p>" + folioEscapeHtml(description) + "</p>" : "") +
    "</header>" +
    (entries.length
      ? renderEntryList(context, entries, "h2")
      : '<p class="folio-collection-empty">' + folioEscapeHtml(emptyMessage) + "</p>") +
    "</main>"
  );
}

export function buildShowcaseStaticRoutes(
  context: FolioStaticBuildContext,
): FolioStaticRoute[] {
  assertNoFolioCollectionConflicts(context.docs, context.config);

  return [
    {
      path: "/",
      title: context.config.title,
      description: context.config.description,
      body: renderHome(context),
      type: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: context.config.title,
        description: context.config.description,
        codeRepository: context.config.github,
        programmingLanguage: ["TypeScript", "React"],
        runtimePlatform: "Vite",
      },
    },
    ...folioCollectionIndexes(context.config).map((collection) => ({
      path: collection.path,
      title: collection.title,
      description: collection.description,
      type: "website",
      body: renderCollection(
        context,
        collection.path,
        collection.title,
        collection.description,
        collection.emptyMessage,
      ),
    })),
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        doc.type === "doc"
          ? renderDoc(context, doc)
          : doc.type === "project"
            ? renderFolioStaticProjectShell(context, doc, markdown(doc, context.base))
          : doc.type === "article"
            ? renderArticle(context, doc)
            : renderGeneric(context, doc),
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  ];
}
