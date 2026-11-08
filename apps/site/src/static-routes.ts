import {
  assertNoFolioCollectionConflicts,
  folioCollectionIndexes,
  renderFolioMarkdown,
  selectFolioCollectionDocs,
  type FolioDoc,
} from "@uichat-mira/folio";
import {
  folioEscapeHtml,
  renderFolioStaticPageNav,
  renderFolioStaticDocumentBody,
  renderFolioStaticTreeNav,
  renderFolioStaticToc,
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
  return '<div class="folio-docs-runtime folio-docs-runtime--static"><div class="folio-docs-shell">' +
    renderFolioStaticTreeNav(context, doc) +
    '<main class="folio-doc-main">' +
    renderFolioStaticDocumentBody(doc, markdown(doc, context.base)) +
    renderFolioStaticPageNav(context, doc) +
    '</main>' + renderFolioStaticToc(doc.headings) + '</div></div>';
}

function renderArticle(context: FolioStaticBuildContext, doc: FolioDoc): string {
  const article = '<main class="folio-doc-page folio-article-main">' +
    '<div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) + '</div></div>' +
    renderFolioStaticDocumentBody(doc, markdown(doc, context.base)) + '</main>';
  const toc = renderFolioStaticToc(doc.headings);
  if (!toc) return article;
  return '<div class="folio-article-layout">' +
    '<details class="folio-article-mobile-toc"><summary>本页目录</summary>' +
    toc + '</details>' + article + toc + '</div>';
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
          : doc.type === "article"
            ? renderArticle(context, doc)
            : renderGeneric(context, doc),
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  ];
}
