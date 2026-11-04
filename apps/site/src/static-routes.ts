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
  type FolioStaticBuildContext,
  type FolioStaticRoute,
} from "@uichat-mira/folio/vite";
import { withFolioBaseLinks } from "./content-links";
import { buildShowcaseHome } from "./home-model";

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

  return (
    '<nav class="folio-docnav" aria-label="文档目录"><div class="folio-docnav__collection">' +
    folioEscapeHtml(collection.title) +
    "</div>" +
    sections +
    "</nav>"
  );
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
    '<main class="folio-doc-main"><div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) +
    "</div></div><h1>" +
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

function renderHome(context: FolioStaticBuildContext): string {
  const model = buildShowcaseHome(context.config, context.docs);

  const groups = model.groups
    .map(
      (group) =>
        '<article class="showcase-type-card showcase-type-card--' +
        group.type +
        '"><header><code>' +
        group.type +
        "</code><span>" +
        folioEscapeHtml(TYPE_LABEL[group.type] ?? group.type) +
        "</span></header><h3>" +
        folioEscapeHtml(group.label) +
        "</h3><p>" +
        folioEscapeHtml(group.purpose) +
        "</p><ul>" +
        group.docs
          .map(
            (doc) =>
              '<li><a href="' +
              folioEscapeHtml(href(context.base, doc.path)) +
              '">' +
              folioEscapeHtml(doc.title) +
              "</a><small>" +
              folioEscapeHtml(doc.description) +
              "</small></li>",
          )
          .join("") +
        "</ul></article>",
    )
    .join("");

  const paths = model.paths
    .map(
      (path) =>
        "<li><span>" +
        folioEscapeHtml(path.label) +
        "</span><div>" +
        path.docs
          .map(
            (doc, index) =>
              (index > 0 ? "<b aria-hidden=\"true\">→</b>" : "") +
              '<a href="' +
              folioEscapeHtml(href(context.base, doc.path)) +
              '">' +
              folioEscapeHtml(doc.title) +
              "</a>",
          )
          .join("") +
        "</div></li>",
    )
    .join("");

  const collections = model.collections
    .map(
      (collection) =>
        '<a href="' +
        folioEscapeHtml(href(context.base, collection.path)) +
        '"><code>' +
        folioEscapeHtml(collection.path) +
        "</code><h3>" +
        folioEscapeHtml(collection.title) +
        "</h3><p>" +
        folioEscapeHtml(collection.description) +
        "</p><ul>" +
        collection.docs
          .map((doc) => "<li>" + folioEscapeHtml(doc.title) + "</li>")
          .join("") +
        "</ul><small>打开集合 →</small></a>",
    )
    .join("");

  return (
    '<main class="showcase-home folio-prerender--showcase">' +
    '<section class="showcase-hero"><div class="showcase-hero__copy">' +
    '<span class="showcase-eyebrow">Reference implementation · dev</span>' +
    "<h1>先体验内容组织。再判断 Folio 能做什么。</h1>" +
    "<p>这个官网只消费 Folio 的公开 package entrypoints。首页、文档、文章、项目档案、独立页面与集合索引全部来自同一份 <code>virtual:folio/content</code> manifest。</p>" +
    '<div class="showcase-actions"><a class="showcase-btn showcase-btn--primary" href="' +
    folioEscapeHtml(href(context.base, "/showcase")) +
    '">进入能力展厅</a><a class="showcase-btn showcase-btn--secondary" href="' +
    folioEscapeHtml(href(context.base, "/showcase/content-map")) +
    '">查看内容图谱</a></div></div>' +
    '<div class="showcase-code-card"><div class="showcase-code-card__bar"><span>home-model.ts</span><small>docs -&gt; entries</small></div><pre><code>' +
    folioEscapeHtml(
      'import docs from "virtual:folio/content";\n' +
        'import { folioCollectionIndexes } from "@uichat-mira/folio";\n\n' +
        'const collections = folioCollectionIndexes(config);\n' +
        'const guides = docs.filter((doc) => doc.type === "doc");\n' +
        'const articles = docs.filter((doc) => doc.type === "article");',
    ) +
    "</code></pre></div></section>" +
    '<section class="showcase-stats" aria-label="Live Folio content metrics">' +
    "<div><strong>" + model.stats.docs + "</strong><span>内容条目</span></div>" +
    "<div><strong>" + model.stats.collections + "</strong><span>集合索引</span></div>" +
    "<div><strong>" + model.stats.headings + "</strong><span>提取标题</span></div>" +
    "<div><strong>" + model.stats.tags + "</strong><span>Frontmatter 标签</span></div>" +
    "</section>" +
    '<section class="showcase-section"><div class="showcase-section__head">' +
    '<span class="showcase-eyebrow">Four content types</span><h2>四类内容，四种阅读方式。</h2>' +
    "<p>文档进入带侧边导航的文档壳，文章按日期排序并出现页内目录，项目档案记录范围与决策，独立页面承担图谱和参考入口。</p></div>" +
    '<div class="showcase-type-grid">' +
    groups +
    "</div></section>" +
    '<section class="showcase-section showcase-section--soft"><div class="showcase-section__head">' +
    '<span class="showcase-eyebrow">Reader paths</span><h2>不要只看卡片，沿着路径走一遍。</h2></div>' +
    '<ol class="showcase-path-list">' +
    paths +
    "</ol></section>" +
    '<section class="showcase-section"><div class="showcase-section__head">' +
    '<span class="showcase-eyebrow">Collections</span><h2>集合索引来自配置，而不是另写一份列表。</h2></div>' +
    '<div class="showcase-collection-grid">' +
    collections +
    "</div></section>" +
    '<section class="showcase-cta"><div><span class="showcase-eyebrow">Boundaries are visible</span>' +
    "<h2>支持什么、缺失什么，都写在真实页面里。</h2><p>搜索、TOC、集合索引和静态输出可以亲自验证；标签聚合、搜索分面和 Mermaid 无 JS 图形则明确记录为未实现。</p></div>" +
    '<a class="showcase-btn showcase-btn--primary" href="' +
    folioEscapeHtml(href(context.base, "/showcase/from-file-to-page")) +
    '">跟踪一条内容链路</a></section>' +
    "</main>"
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
