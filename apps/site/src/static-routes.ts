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
import {
  buildSiteArchiveModel,
  siteArchiveDescription,
  siteArchivePath,
  type SiteArchiveModel,
  type SiteArchiveTagLink,
} from "./archive";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const TYPE_LABEL: Record<string, string> = {
  doc: "文档",
  article: "文章",
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
  tagLinks?: ReadonlyMap<string, readonly SiteArchiveTagLink[]>,
): string {
  return (
    '<div class="folio-entry-list">' +
    docs
      .map((doc, index) => {
        const tags = tagLinks?.get(doc.path) ?? [];
        const number =
          '<span class="folio-entry-number" aria-hidden="true">' +
          String(index + 1).padStart(2, "0") +
          "</span>";
        const copy =
          '<div class="folio-entry-copy">' +
          (doc.date
            ? '<time class="folio-entry-date" datetime="' +
              folioEscapeHtml(doc.date) +
              '">' +
              folioEscapeHtml(doc.date) +
              "</time>"
            : "") +
          (tags.length
            ? "<" +
              heading +
              ' class="folio-entry-title"><a class="folio-entry-link" href="' +
              folioEscapeHtml(href(context.base, doc.path)) +
              '">' +
              folioEscapeHtml(doc.title) +
              "</a></" +
              heading +
              ">"
            : "<" +
              heading +
              ' class="folio-entry-title">' +
              folioEscapeHtml(doc.title) +
              "</" +
              heading +
              ">") +
          (doc.description
            ? '<p class="folio-entry-description">' + folioEscapeHtml(doc.description) + "</p>"
            : "") +
          (tags.length
            ? '<span class="folio-entry-tags">' +
              tags
                .map(
                  (tag) =>
                    '<a class="folio-entry-tag" href="' +
                    folioEscapeHtml(tag.href) +
                    '">' +
                    folioEscapeHtml(tag.label) +
                    "</a>",
                )
                .join("") +
              "</span>"
            : "") +
          "</div>";
        const arrow = '<span class="folio-entry-arrow" aria-hidden="true">↗</span>';
        if (!tags.length) {
          return (
            '<a class="folio-entry" href="' +
            folioEscapeHtml(href(context.base, doc.path)) +
            '">' +
            number +
            copy +
            arrow +
            "</a>"
          );
        }
        return '<div class="folio-entry">' + number + copy + arrow + "</div>";
      })
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

function renderArticle(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
  archive: SiteArchiveModel,
): string {
  const tagLinks = archive.tagsByDoc.get(doc.path) ?? [];
  const tags = tagLinks.length
    ? '<nav class="folio-article-tags" aria-label="文章标签">' +
      '<span class="folio-article-tags__label">标签</span>' +
      tagLinks
        .map(
          (link) =>
            '<a class="folio-article-tag" href="' +
            folioEscapeHtml(link.href) +
            '">' +
            folioEscapeHtml(link.label) +
            "</a>",
        )
        .join("") +
      "</nav>"
    : "";
  const article = '<main class="folio-doc-page folio-article-main">' +
    '<div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) + '</div></div>' +
    tags +
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

function renderCategoryRow(
  context: FolioStaticBuildContext,
  archive: SiteArchiveModel,
  collectionPath: string,
  collectionTitle: string,
): string {
  const groups = archive.byCollection.get(collectionPath)?.index.categories ?? [];
  if (!groups.length) return "";
  return (
    '<nav class="folio-archive-row" aria-label="' +
    folioEscapeHtml(collectionTitle + "分类归档") +
    '"><span class="folio-archive-row__label">分类</span>' +
    '<ul class="folio-archive-row__list">' +
    groups
      .map(
        (group) =>
          '<li><a class="folio-archive-chip" href="' +
          folioEscapeHtml(href(context.base, siteArchivePath(collectionPath, "category", group.slug))) +
          '">' +
          folioEscapeHtml(group.title) +
          "</a></li>",
      )
      .join("") +
    "</ul></nav>"
  );
}

function renderCollection(
  context: FolioStaticBuildContext,
  archive: SiteArchiveModel,
  path: string,
  title: string,
  description: string,
  emptyMessage: string,
): string {
  const entries = selectFolioCollectionDocs(context.docs, path);
  const archiveCollection = archive.byCollection.get(path);
  return (
    '<main class="folio-home folio-collection-page"><header class="folio-journal-hero folio-collection-hero">' +
    '<span class="folio-journal-kicker">COLLECTION · ' +
    entries.length +
    " ENTRIES</span><h1>" +
    folioEscapeHtml(title) +
    "</h1>" +
    (description ? "<p>" + folioEscapeHtml(description) + "</p>" : "") +
    "</header>" +
    renderCategoryRow(context, archive, path, title) +
    (entries.length
      ? renderEntryList(
          context,
          entries,
          "h2",
          archiveCollection ? archive.tagsByDoc : undefined,
        )
      : '<p class="folio-collection-empty">' + folioEscapeHtml(emptyMessage) + "</p>") +
    "</main>"
  );
}

function renderArchivePage(
  context: FolioStaticBuildContext,
  archive: SiteArchiveModel,
  route: SiteArchiveModel["routes"][number],
): string {
  const { collection, group } = route;
  const category = group.kind === "category";
  return (
    '<main class="folio-home folio-collection-page folio-archive-page">' +
    '<header class="folio-journal-hero folio-collection-hero">' +
    '<span class="folio-journal-kicker">' +
    (category ? "CATEGORY ARCHIVE" : "TAG ARCHIVE") +
    " · " +
    group.docs.length +
    " ARTICLES</span><h1>" +
    folioEscapeHtml(group.title) +
    "</h1><p>" +
    folioEscapeHtml(
      collection.title + " · " + (category ? "分类" : "标签") + "归档 · 共 " + group.docs.length + " 篇文章",
    ) +
    '</p><a class="folio-archive-back" href="' +
    folioEscapeHtml(href(context.base, collection.path)) +
    '">返回' +
    folioEscapeHtml(collection.title) +
    ' <span aria-hidden="true">↗</span></a></header>' +
    renderEntryList(context, group.docs, "h2", archive.tagsByDoc) +
    "</main>"
  );
}

export function buildFolioSiteStaticRoutes(
  context: FolioStaticBuildContext,
): FolioStaticRoute[] {
  assertNoFolioCollectionConflicts(context.docs, context.config);
  const archive = buildSiteArchiveModel(
    context.config,
    context.docs,
    (path) => href(context.base, path),
  );

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
        archive,
        collection.path,
        collection.title,
        collection.description,
        collection.emptyMessage,
      ),
    })),
    ...archive.routes.map((route) => ({
      path: route.path,
      title: `${route.group.kind === "category" ? "分类" : "标签"}：${route.group.title}`,
      description: siteArchiveDescription(route.collection, route.group),
      type: "website",
      body: renderArchivePage(context, archive, route),
    })),
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        doc.type === "doc"
          ? renderDoc(context, doc)
          : doc.type === "article"
            ? renderArticle(context, doc, archive)
            : renderGeneric(context, doc),
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  ];
}
