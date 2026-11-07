import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFolioNavigationTree, getFolioNavigationNeighbors } from "./core/navigation-tree";
import {
  folioTreeDisplayLabel,
  type FolioContentTreeNode,
} from "./core/content-tree";
import {
  folioCollectionIndexes,
  selectFolioCollectionDocs,
  assertNoFolioCollectionConflicts,
  type FolioCollectionIndex,
} from "./core/collection-index";
import { renderFolioMarkdown } from "./core/markdown";
import { buildFolioOutlineTree, type FolioOutlineNode } from "./core/outline";
import { getFolioDocByline } from "./core/doc-meta";
import { resolveFolioHome, type FolioHomeModel } from "./core/home";
import {
  assertFolioSiteIndexing,
  FOLIO_NOT_FOUND_ROBOTS,
  folioIndexingRobots,
  folioRobotsTxt,
  resolveFolioIndexingRobots,
} from "./build/indexing";
import {
  buildFolioStaticFeedPlan,
  type FolioStaticFeedOptions,
  type FolioStaticFeedPlan,
} from "./build/feed";
import {
  normalizeStaticRoute,
  writeFolioStaticOutputs,
  writeFolioStaticRootFile,
} from "./static-output";
import {
  defaultFolioJsonLd,
  resolveFolioSitemapLastmod,
} from "./build/structured-data";
import type { FolioDoc, FolioConfig, FolioHeading } from "./types";

export type FolioStaticRoute = {
  path: string;
  title: string;
  description: string;
  body: string;
  type?: string;
  image?: string;
  robots?: string;
  jsonLd?: unknown;
  /**
   * Explicit sitemap `<lastmod>` for this route (YYYY-MM-DD or a date-time with
   * an explicit timezone). It wins over the document's trusted `updatedAt`;
   * invalid values fail the static build.
   */
  lastmod?: string;
  doc?: FolioDoc;
};

export type FolioStaticBuildContext = {
  config: FolioConfig;
  docs: FolioDoc[];
  roots: string[];
  base: string;
  outDir: string;
};

export type FolioStaticImageMetadata = {
  type?: string;
  width?: number;
  height?: number;
};

export type FolioStaticHomeOverride =
  | Partial<Omit<FolioStaticRoute, "path">>
  | ((
      context: FolioStaticBuildContext,
      home: FolioStaticRoute,
    ) => FolioStaticRoute | Partial<Omit<FolioStaticRoute, "path">>);

export type FolioStaticBuildOptions = {
  routes?: (context: FolioStaticBuildContext) => FolioStaticRoute[];
  /**
   * Replaces only the `/` route body/metadata. Other routes keep coming from
   * `routes` or the default route set. Provide explicit HTML; React nodes are
   * not serialized automatically.
   */
  home?: FolioStaticHomeOverride;
  notFound?: (context: FolioStaticBuildContext) => FolioStaticRoute;
  locale?: string;
  siteName?: string;
  defaultImage?: string;
  image?: FolioStaticImageMetadata;
  twitterCard?: "summary" | "summary_large_image";
  title?: (route: FolioStaticRoute, config: FolioConfig) => string;
  transformTemplate?: (
    template: string,
    context: FolioStaticBuildContext,
  ) => string;
  rootPlaceholder?: string;
  sitemap?: boolean;
  robots?: boolean;
  /**
   * Declares RSS 2.0 / Atom 1.0 feeds for route directories. Requires
   * `config.siteUrl`; omitting this field (or passing an empty array) leaves
   * every existing static output byte-for-byte unchanged.
   */
  feeds?: FolioStaticFeedOptions[];
  /**
   * Site-level indexing policy. Leave it out for the unchanged, indexable
   * default.
   *
   * `"noindex"` makes every default route page (home, collection indexes,
   * document/article pages) and every custom `routes` page carry
   * `<meta name="robots" content="noindex,nofollow">`, and writes a preview
   * `robots.txt` that keeps crawling allowed but omits the `Sitemap:` line.
   * `404.html` stays `noindex,nofollow` in both modes.
   *
   * Explicit opt-in only: Folio never infers a preview deployment from the
   * hostname, `github.io`, `localhost`, sub-path, environment or repository
   * name. Precedence: explicit `FolioStaticRoute.robots` > this policy >
   * built-in `"index,follow"`. Independent from `robots`, which only controls
   * whether `robots.txt` is written. Canonical, Open Graph, JSON-LD and base
   * URL handling are unaffected; the policy changes indexing signals only.
   */
  siteIndexing?: "index" | "noindex";
};

function normalizeBase(base: string): string {
  if (!base || base === "/") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

export function folioEscapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}


/** Static HTML projection of the same compact byline model used by FolioDocMeta. */
export function renderFolioStaticDocMeta(doc: FolioDoc): string {
  const byline = getFolioDocByline(doc);
  if (!byline) return "";
  const author = byline.author
    ? '<span class="folio-doc-meta__author"><span class="folio-doc-meta__avatar" aria-hidden="true">' +
      folioEscapeHtml(byline.author.initial) +
      (byline.author.avatar
        ? '<img src="' + folioEscapeHtml(byline.author.avatar) + '" alt="" loading="lazy">'
        : "") +
      '</span><span class="folio-doc-meta__name">' + folioEscapeHtml(byline.author.name) + '</span></span>'
    : "";
  const separator = '<span class="folio-doc-meta__separator" aria-hidden="true">/</span>';
  const date = byline.date
    ? '<span class="folio-doc-meta__detail">' + (byline.author ? separator : "") +
      '<time datetime="' + folioEscapeHtml(byline.date.dateTime) + '">' +
      folioEscapeHtml(byline.date.value) + '</time></span>'
    : "";
  const reading = byline.readingMinutes
    ? '<span class="folio-doc-meta__detail">' + (byline.author || byline.date ? separator : "") +
      '<span>约 ' + byline.readingMinutes + ' 分钟</span></span>'
    : "";
  return '<div class="folio-doc-meta" role="group" aria-label="文章信息">' +
    author + date + reading + '</div>';
}

export function folioAbsoluteRouteUrl(
  siteUrl: string,
  base: string,
  path: string,
): string {
  const origin = siteUrl.replace(/\/$/, "");
  const route = normalizeStaticRoute(path);
  return `${origin}${normalizeBase(base)}${route === "/" ? "/" : `${route}/`}`;
}

export function folioAbsoluteAssetUrl(
  siteUrl: string,
  base: string,
  path: string,
): string {
  const origin = siteUrl.replace(/\/$/, "");
  const assetPath = path.replace(/^\/+/, "");
  return `${origin}${normalizeBase(base)}/${assetPath}`;
}

// One plan serves both stages: HTML discovery renders only alternates for files
// that are actually publishable, and the write stage writes exactly this plan.
// Building it before the first page write is also where duplicate feed output
// names and feed-vs-static-output collisions are rejected.
function buildStaticFeedPlan(
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions,
  reservedOutputs?: readonly string[],
): FolioStaticFeedPlan {
  return buildFolioStaticFeedPlan({
    config: context.config,
    docs: context.docs,
    feeds: options.feeds,
    reservedOutputs,
    routeUrl: (path) =>
      folioAbsoluteRouteUrl(context.config.siteUrl!, context.base, path),
    assetUrl: (name) =>
      folioAbsoluteAssetUrl(context.config.siteUrl!, context.base, name),
  });
}

// A consumer template may already contain feed discovery links. They are
// removed before our own (absolute) links are injected so a page never
// advertises two different feeds with the same type.
const FOLIO_FEED_ALTERNATE_LINK =
  /<link\b(?=[^>]*\brel\s*=\s*["']alternate["'])(?=[^>]*\btype\s*=\s*["']application\/(?:rss|atom)\+xml["'])[^>]*>\s*/gi;

function resolveImage(
  route: FolioStaticRoute,
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions,
): string | undefined {
  const value = route.image || options.defaultImage || context.config.logo;
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  if (!context.config.siteUrl) {
    return `${normalizeBase(context.base)}/${value.replace(/^\/+/, "")}`;
  }
  return folioAbsoluteAssetUrl(context.config.siteUrl, context.base, value);
}

export function renderFolioStaticHtml(
  template: string,
  route: FolioStaticRoute,
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions = {},
): string {
  // A direct caller must fail on an ambiguous policy too, not only the site
  // writer: a typoed preview flag must never produce an indexable page.
  assertFolioSiteIndexing(options.siteIndexing);
  const pageTitle =
    options.title?.(route, context.config) ??
    (route.title === context.config.title
      ? route.title
      : `${route.title} · ${context.config.title}`);
  const canonical = context.config.siteUrl
    ? folioAbsoluteRouteUrl(context.config.siteUrl, context.base, route.path)
    : "";
  const image = resolveImage(route, context, options);
  const robots = resolveFolioIndexingRobots(
    route.robots,
    folioIndexingRobots(options.siteIndexing),
  );
  const jsonLd =
    route.jsonLd ?? defaultFolioJsonLd(route, context, canonical, image);
  const imageMetadata = options.image ?? {};
  const alternates = buildStaticFeedPlan(context, options).alternates
    .map(
      (alternate) =>
        `<link rel="alternate" type="${alternate.type}" title="${folioEscapeHtml(alternate.title)}" href="${folioEscapeHtml(alternate.href)}">`,
    )
    .join("");

  const head = [
    `<meta name="description" content="${folioEscapeHtml(route.description)}">`,
    `<meta name="robots" content="${folioEscapeHtml(robots)}">`,
    canonical
      ? `<link rel="canonical" href="${folioEscapeHtml(canonical)}">`
      : "",
    alternates,
    `<meta property="og:locale" content="${folioEscapeHtml(options.locale || "en_US")}">`,
    `<meta property="og:title" content="${folioEscapeHtml(pageTitle)}">`,
    `<meta property="og:description" content="${folioEscapeHtml(route.description)}">`,
    `<meta property="og:type" content="${folioEscapeHtml(route.type || "website")}">`,
    canonical
      ? `<meta property="og:url" content="${folioEscapeHtml(canonical)}">`
      : "",
    `<meta property="og:site_name" content="${folioEscapeHtml(options.siteName || context.config.title)}">`,
    image
      ? `<meta property="og:image" content="${folioEscapeHtml(image)}"><meta property="og:image:secure_url" content="${folioEscapeHtml(image)}">`
      : "",
    image && imageMetadata.type
      ? `<meta property="og:image:type" content="${folioEscapeHtml(imageMetadata.type)}">`
      : "",
    image && imageMetadata.width
      ? `<meta property="og:image:width" content="${imageMetadata.width}">`
      : "",
    image && imageMetadata.height
      ? `<meta property="og:image:height" content="${imageMetadata.height}">`
      : "",
    `<meta name="twitter:card" content="${options.twitterCard || "summary_large_image"}">`,
    `<meta name="twitter:title" content="${folioEscapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${folioEscapeHtml(route.description)}">`,
    image
      ? `<meta name="twitter:image" content="${folioEscapeHtml(image)}">`
      : "",
    jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`
      : "",
  ].join("");

  const transformed = options.transformTemplate?.(template, context) ?? template;
  const rootPlaceholder = options.rootPlaceholder || '<div id="root"></div>';

  let html = transformed
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${folioEscapeHtml(pageTitle)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/gi, "")
    .replace(/<meta name="robots"[^>]*>\s*/gi, "")
    .replace(/<link rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");

  // Only strip when we have something to inject: with feeds omitted the page
  // head must stay exactly as the consumer wrote it.
  if (alternates) {
    html = html.replace(FOLIO_FEED_ALTERNATE_LINK, "");
  }

  return html
    .replace("</head>", `${head}</head>`)
    .replace(rootPlaceholder, `<div id="root">${route.body}</div>`);
}


function staticRouteHref(
  context: FolioStaticBuildContext,
  path: string,
): string {
  const route = normalizeStaticRoute(path);
  const base = normalizeBase(context.base);
  return `${base}${route === "/" ? "/" : `${route}/`}`;
}

/**
 * Static counterpart of the one public tree renderer. Every descendant stays
 * visible without JavaScript, and no inert disclosure buttons are emitted.
 */
function renderStaticNavigationNode(
  context: FolioStaticBuildContext,
  node: FolioContentTreeNode,
  currentPath: string,
  root = false,
): string {
  const group = node.kind === "section";
  const active = node.path === currentPath;
  const display = root && !group ? folioTreeDisplayLabel(node.title) : undefined;
  const title = display
    ? (display.eyebrow
      ? '<span class="folio-tree-nav__eyebrow">' + folioEscapeHtml(display.eyebrow) + '</span>'
      : '') +
      '<span class="folio-tree-nav__title">' + folioEscapeHtml(display.title) + '</span>'
    : folioEscapeHtml(node.title);

  const label = group
    ? '<h2>' + title + '</h2>'
    : node.doc
      ? '<a' + (root ? ' class="folio-tree-nav__overview' + (active ? ' active"' : '"')
        : active ? ' class="active"' : '') +
        (active ? ' aria-current="page"' : '') +
        ' href="' + folioEscapeHtml(staticRouteHref(context, node.doc.path)) +
        '">' + title + '</a>'
      : root
        ? '<div class="folio-tree-nav__overview folio-tree-nav__overview--directory">' +
          title + '</div>'
        : '<span class="folio-tree-nav__directory">' + title + '</span>';

  const wrapper = root ? "section" : "li";
  const kindClass = root
    ? group ? "folio-tree-nav__section" : "folio-tree-nav__group"
    : "folio-tree-nav__item";
  // Keep the React layout containers for identical CSS behavior; no JS means
  // that every link is initially visible and there is no inert toggle.
  const children = node.children.length
    ? '<div class="folio-tree-nav__reveal" data-expanded="true" aria-hidden="false">' +
      '<div class="folio-tree-nav__reveal-inner">' +
      '<ul class="folio-tree-nav__children' +
      (group ? ' folio-tree-nav__children--section' : '') + '">' +
      node.children.map((child) =>
        renderStaticNavigationNode(context, child, currentPath)).join("") +
      '</ul></div></div>'
    : "";
  return '<' + wrapper + ' class="' + kindClass + '"><div class="folio-tree-nav__row' +
    (active ? ' is-active' : '') + (group ? ' folio-tree-nav__row--section' : '') +
    '">' + label + '</div>' + children + '</' + wrapper + '>';
}

/** One static sidebar renderer for document collections and project hierarchies. */
export function renderFolioStaticTreeNav(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const tree = buildFolioNavigationTree(context.docs, doc);
  if (!tree.roots.length) return "";
  const documentMode = tree.roots.some((node) => node.kind === "section");
  const roots = tree.roots.map((node) =>
    renderStaticNavigationNode(context, node, doc.path, true)).join("");
  const navClass = documentMode ? "folio-tree-nav folio-tree-nav--sections" : "folio-tree-nav";
  return '<nav class="' + navClass + '" aria-label="' +
    (documentMode ? "文档目录" : "项目目录") +
    '"><div class="folio-tree-nav__groups">' + roots + '</div></nav>';
}

function renderStaticOutlineList(
  nodes: readonly FolioOutlineNode[],
  nested = false,
): string {
  return (
    `<ul class="folio-toc__list${nested ? " folio-toc__list--nested" : ""}">` +
    nodes
      .map(
        (node) =>
          `<li class="folio-toc-depth-${node.depth}"><a href="#${folioEscapeHtml(node.id)}" title="${folioEscapeHtml(node.text)}">${folioEscapeHtml(node.text)}</a>` +
          (node.children.length
            ? renderStaticOutlineList(node.children, true)
            : "") +
          "</li>",
      )
      .join("") +
    "</ul>"
  );
}

/**
 * Static counterpart of `FolioToc`. It shares the Core outline tree, so the
 * published markup and the React runtime stay structurally identical. Static
 * pages have no active marker; the rail and nested list are still rendered.
 */
export function renderFolioStaticToc(
  headings: readonly FolioHeading[],
  options: { title?: string } = {},
): string {
  if (!headings.length) return "";
  const title = options.title ?? "本页目录";
  return (
    `<nav class="folio-toc" aria-label="${folioEscapeHtml(title)}">` +
    '<div class="folio-toc__content">' +
    `<h2>${folioEscapeHtml(title)}</h2>` +
    renderStaticOutlineList(buildFolioOutlineTree(headings)) +
    "</div></nav>"
  );
}

function renderStaticToc(doc: FolioDoc): string {
  return renderFolioStaticToc(doc.headings);
}

function renderStaticMobileDocs(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const nav = renderFolioStaticTreeNav(context, doc);
  const toc = renderStaticToc(doc);

  return `<div class="folio-docs-mobile-bar folio-docs-mobile-bar--static"><details class="folio-static-doc-menu"><summary>菜单</summary><div class="folio-static-doc-menu__panel">${nav}</div></details>${toc ? `<details class="folio-static-doc-menu folio-static-doc-menu--toc"><summary>页面导航</summary><div class="folio-static-doc-menu__panel">${toc}</div></details>` : ""}</div>`;
}

/**
 * The single static paginator for package readers and consumer-rendered docs.
 * Resolve neighbors from the same navigation tree as React and the sidebar.
 */
export function renderFolioStaticPageNav(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const { previous, next } = getFolioNavigationNeighbors(
    buildFolioNavigationTree(context.docs, doc), doc.path,
  );
  if (!previous && !next) return "";

  const anchor = (
    target: typeof previous,
    direction: "previous" | "next",
    label: string,
  ) => target
    ? '<a class="folio-page-nav__' + direction + '" href="' +
      folioEscapeHtml(staticRouteHref(context, target.path)) +
      '"><span>' + label + '</span><strong>' +
      folioEscapeHtml(target.title) + '</strong></a>'
    : "<span></span>";

  return '<nav class="folio-page-nav" aria-label="文档分页">' +
    anchor(previous, "previous", "上一篇") +
    anchor(next, "next", "下一篇") +
    '</nav>';
}

function renderStaticDocShell(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  return `<div class="folio-docs-runtime folio-docs-runtime--static">${renderStaticMobileDocs(context, doc)}<div class="folio-docs-shell">${renderFolioStaticTreeNav(context, doc)}<main class="folio-doc-main"><h1>${folioEscapeHtml(doc.title)}</h1>${doc.description ? `<p class="folio-lede">${folioEscapeHtml(doc.description)}</p>` : ""}${renderFolioStaticDocMeta(doc)}<article class="folio-markdown">${renderFolioMarkdown(doc.body, { removeH1: true })}</article>${renderFolioStaticPageNav(context, doc)}</main>${renderStaticToc(doc)}</div></div>`;
}

/** Static counterpart of the public tree navigation, derived from the same
 * route tree and rendered with the same classes as the React component.
 */
export function renderFolioStaticProjectShell(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
  markdownHtml = renderFolioMarkdown(doc.body, { removeH1: true }),
): string {
  const nav = renderFolioStaticTreeNav(context, doc);
  const toc = renderStaticToc(doc);
  const pager = renderFolioStaticPageNav(context, doc);
  const mobile = '<div class="folio-docs-mobile-bar folio-docs-mobile-bar--static">' +
    '<details class="folio-static-doc-menu"><summary>菜单</summary>' +
    '<div class="folio-static-doc-menu__panel">' + nav + '</div></details>' +
    (toc ? '<details class="folio-static-doc-menu folio-static-doc-menu--toc">' +
      '<summary>页面导航</summary><div class="folio-static-doc-menu__panel">' +
      toc + '</div></details>' : '') + '</div>';
  return '<div class="folio-docs-runtime folio-docs-runtime--static">' +
    mobile + '<div class="folio-docs-shell">' + nav +
    '<main class="folio-doc-main"><h1>' + folioEscapeHtml(doc.title) + '</h1>' +
    (doc.description ? '<p class="folio-lede">' +
      folioEscapeHtml(doc.description) + '</p>' : '') +
    renderFolioStaticDocMeta(doc) +
    '<article class="folio-markdown">' + markdownHtml + '</article>' +
    pager + '</main>' + toc + '</div></div>';
}

function renderStaticEntryList(
  context: FolioStaticBuildContext,
  docs: FolioDoc[],
  heading: "h2" | "h3",
): string {
  return '<div class="folio-entry-list">' + docs.map((doc, index) =>
    '<a class="folio-entry" href="' + folioEscapeHtml(staticRouteHref(context, doc.path)) + '">' +
    '<span class="folio-entry-number" aria-hidden="true">' + String(index + 1).padStart(2, "0") + '</span>' +
    '<div class="folio-entry-copy">' +
    (doc.date ? '<time class="folio-entry-date" datetime="' + folioEscapeHtml(doc.date) + '">' +
      folioEscapeHtml(doc.date) + '</time>' : '') +
    '<' + heading + ' class="folio-entry-title">' + folioEscapeHtml(doc.title) + '</' + heading + '>' +
    (doc.description ? '<p class="folio-entry-description">' +
      folioEscapeHtml(doc.description) + '</p>' : '') +
    '</div><span class="folio-entry-arrow" aria-hidden="true">↗</span></a>'
  ).join("") + "</div>";
}

function renderStaticCollectionIndex(
  context: FolioStaticBuildContext,
  collection: FolioCollectionIndex,
): string {
  const entries = selectFolioCollectionDocs(context.docs, collection.path);
  const list = entries.length
    ? renderStaticEntryList(context, entries, "h2")
    : '<p class="folio-collection-empty">' + folioEscapeHtml(collection.emptyMessage) + '</p>';
  return '<main class="folio-home folio-collection-page">' +
    '<header class="folio-journal-hero folio-collection-hero">' +
    '<span class="folio-journal-kicker">COLLECTION</span>' +
    '<h1>' + folioEscapeHtml(collection.title) + '</h1>' +
    (collection.description ? '<p>' + folioEscapeHtml(collection.description) + '</p>' : '') +
    '</header>' + list + "</main>";
}

function renderDefaultStaticHome(context: FolioStaticBuildContext): string {
  const collections = folioCollectionIndexes(context.config);
  const primary = collections[0];
  const primaryDocs = primary
    ? selectFolioCollectionDocs(context.docs, primary.path)
    : context.docs.filter((doc) => doc.type !== "page");
  const featured = primaryDocs[0];
  const recent = primaryDocs.slice(1, 5);
  const about = context.docs.find((doc) => doc.type === "page");
  const link = (path: string): string => folioEscapeHtml(staticRouteHref(context, path));

  const hero = '<div class="folio-editorial-meta" aria-label="站点首页">' +
    '<span>PERSONAL JOURNAL <span aria-hidden="true">✳</span></span>' +
    '<span>READ · COLLECT · REMEMBER</span></div>' +
    '<section class="folio-editorial-lead" aria-label="小站介绍与精选文章">' +
    '<div class="folio-editorial-intro"><div class="folio-editorial-kicker">' +
    '<span class="folio-editorial-kicker-line" aria-hidden="true"></span>' +
    '写给生活的零碎记录</div><h1>' + folioEscapeHtml(context.config.title) + '</h1>' +
    '<p>' + folioEscapeHtml(context.config.description) + '</p>' +
    (primary ? '<a class="folio-editorial-hero-link" href="' + link(primary.path) +
      '">浏览' + folioEscapeHtml(primary.title) + ' <span aria-hidden="true">↗</span></a>' : '') +
    '</div>' +
    (featured ? '<a class="folio-editorial-feature" href="' + link(featured.path) + '">' +
      '<span class="folio-editorial-feature-label"><span aria-hidden="true">✳</span> FEATURED STORY</span>' +
      '<span class="folio-editorial-feature-body">' +
      '<span class="folio-editorial-feature-no">01 / ' + String(primaryDocs.length).padStart(2, "0") + '</span>' +
      '<h2>' + folioEscapeHtml(featured.title) + '</h2>' +
      (featured.description ? '<p>' + folioEscapeHtml(featured.description) + '</p>' : '') +
      '</span><span class="folio-editorial-feature-bottom">开始阅读 <span aria-hidden="true">↗</span></span></a>' : '') +
    '</section>';

  const recentSection = '<section class="folio-editorial-recent" aria-label="文章选读">' +
    '<div class="folio-editorial-section-heading"><div>' +
    '<span class="folio-editorial-section-label">01 / READING</span>' +
    '<h2>' + folioEscapeHtml(primary?.title ?? "近期内容") + '</h2></div>' +
    (primary ? '<a class="folio-editorial-view-all" href="' + link(primary.path) + '">' +
      '全部' + folioEscapeHtml(primary.title) + ' <span aria-hidden="true">↗</span></a>' : '') +
    '</div>' +
    (recent.length ? renderStaticEntryList(context, recent, "h3")
      : !featured ? '<p class="folio-collection-empty">这里还没有内容。</p>'
      : '<p class="folio-editorial-endnote">更多记录，正在慢慢写下。</p>') +
    '</section>';

  const sideSections = collections.slice(1).map((collection, index) => {
    const entries = selectFolioCollectionDocs(context.docs, collection.path).slice(0, 3);
    return '<section class="folio-editorial-side-section">' +
      '<div class="folio-editorial-section-heading"><div>' +
      '<span class="folio-editorial-section-label">' +
      String(index + 2).padStart(2, "0") + ' / COLLECTION</span>' +
      '<h2>' + folioEscapeHtml(collection.title) + '</h2></div>' +
      '<a class="folio-editorial-view-all" aria-label="全部' + folioEscapeHtml(collection.title) +
      '" href="' + link(collection.path) + '">↗</a></div>' +
      (entries.length ? renderStaticEntryList(context, entries, "h3") :
        '<p class="folio-collection-empty">' + folioEscapeHtml(collection.emptyMessage) + '</p>') +
      '</section>';
  }).join("");
  const aboutSection = about
    ? '<aside class="folio-editorial-about">' +
      '<span class="folio-editorial-section-label">A LITTLE ABOUT</span>' +
      '<h2>' + folioEscapeHtml(about.title) + '</h2>' +
      '<p>' + folioEscapeHtml(about.description || context.config.description) + '</p>' +
      '<a href="' + link(about.path) + '">读读关于小站 <span aria-hidden="true">↗</span></a></aside>'
    : "";

  return '<main class="folio-home folio-journal-home folio-editorial-home">' +
    hero +
    '<div class="folio-editorial-rule"><span>THE NOTEBOOK</span><span>' +
    String(primaryDocs.length).padStart(2, "0") + ' ENTRIES</span></div>' +
    '<div class="folio-editorial-lower">' + recentSection +
    '<div class="folio-editorial-aside">' + sideSections + aboutSection + '</div>' +
    '</div></main>';
}

function renderConfiguredStaticHome(
  context: FolioStaticBuildContext,
  model: FolioHomeModel,
): string {
  const link = (path: string): string => folioEscapeHtml(staticRouteHref(context, path));
  const meta = model.meta
    ? '<div class="folio-editorial-meta" aria-label="站点首页">' +
      '<span>' + folioEscapeHtml(model.meta.left) + '</span>' +
      '<span>' + folioEscapeHtml(model.meta.right) + '</span></div>'
    : "";

  const sections = model.sections.map((section) => {
    switch (section.type) {
      case "intro": {
        const collection = section.collection;
        return '<section class="folio-editorial-lead folio-editorial-lead--single">' +
          '<div class="folio-editorial-intro">' +
          '<div class="folio-editorial-kicker">' +
          '<span class="folio-editorial-kicker-line" aria-hidden="true"></span>' +
          folioEscapeHtml(section.kicker) + '</div>' +
          '<h1>' + folioEscapeHtml(section.title) + '</h1>' +
          '<p>' + folioEscapeHtml(section.description) + '</p>' +
          (collection
            ? '<a class="folio-editorial-hero-link" href="' + link(collection.path) + '">浏览' +
              folioEscapeHtml(collection.title) + ' <span aria-hidden="true">↗</span></a>'
            : "") +
          '</div></section>';
      }
      case "featured":
        return '<section class="folio-editorial-lead folio-editorial-lead--single">' +
          '<a class="folio-editorial-feature" href="' + link(section.doc.path) + '">' +
          '<span class="folio-editorial-feature-label"><span aria-hidden="true">✳</span> ' +
          folioEscapeHtml(section.label) + '</span>' +
          '<span class="folio-editorial-feature-body">' +
          '<span class="folio-editorial-feature-no">' +
          String(section.number).padStart(2, "0") + ' / ' +
          String(section.total).padStart(2, "0") + '</span>' +
          '<h2>' + folioEscapeHtml(section.doc.title) + '</h2>' +
          (section.doc.description
            ? '<p>' + folioEscapeHtml(section.doc.description) + '</p>'
            : "") +
          '</span><span class="folio-editorial-feature-bottom">' +
          folioEscapeHtml(section.readLabel) + ' <span aria-hidden="true">↗</span></span></a></section>';
      case "recent":
        return '<section class="folio-editorial-lower folio-editorial-lower--single">' +
          '<section class="folio-editorial-recent" aria-label="文章选读">' +
          '<div class="folio-editorial-section-heading"><div>' +
          '<span class="folio-editorial-section-label">' + folioEscapeHtml(section.label) + '</span>' +
          '<h2>' + folioEscapeHtml(section.title) + '</h2></div>' +
          (section.collection
            ? '<a class="folio-editorial-view-all" href="' + link(section.collection.path) + '">' +
              '全部' + folioEscapeHtml(section.collection.title) +
              ' <span aria-hidden="true">↗</span></a>'
            : "") +
          '</div>' +
          (section.docs.length
            ? renderStaticEntryList(context, section.docs, "h3")
            : section.hadEntries
              ? '<p class="folio-editorial-endnote">' + folioEscapeHtml(section.endMessage) + '</p>'
              : '<p class="folio-collection-empty">' + folioEscapeHtml(section.emptyMessage) + '</p>') +
          '</section></section>';
      case "collections":
        return '<section class="folio-editorial-lower folio-editorial-lower--single">' +
          '<div class="folio-editorial-aside">' +
          section.collections.map((entry, index) =>
            '<section class="folio-editorial-side-section">' +
            '<div class="folio-editorial-section-heading"><div>' +
            '<span class="folio-editorial-section-label">' +
            String(index + 2).padStart(2, "0") + ' / COLLECTION</span>' +
            '<h2>' + folioEscapeHtml(entry.collection.title) + '</h2></div>' +
            '<a class="folio-editorial-view-all" aria-label="全部' +
            folioEscapeHtml(entry.collection.title) + '" href="' +
            link(entry.collection.path) + '">↗</a></div>' +
            (entry.docs.length
              ? renderStaticEntryList(context, entry.docs, "h3")
              : '<p class="folio-collection-empty">' +
                folioEscapeHtml(entry.emptyMessage) + '</p>') +
            '</section>',
          ).join("") +
          '</div></section>';
      case "about":
        return '<section class="folio-editorial-lower folio-editorial-lower--single">' +
          '<aside class="folio-editorial-about">' +
          '<span class="folio-editorial-section-label">A LITTLE ABOUT</span>' +
          '<h2>' + folioEscapeHtml(section.title) + '</h2>' +
          '<p>' + folioEscapeHtml(section.description) + '</p>' +
          '<a href="' + link(section.doc.path) + '">' +
          folioEscapeHtml(section.linkLabel) +
          ' <span aria-hidden="true">↗</span></a></aside></section>';
    }
  }).join("");

  return '<main class="folio-home folio-journal-home folio-editorial-home">' +
    meta + sections + '</main>';
}

/** Renders the built-in home body, including `FolioConfig.home`. */
export function renderFolioStaticHome(context: FolioStaticBuildContext): string {
  return context.config.home
    ? renderConfiguredStaticHome(context, resolveFolioHome(context.config, context.docs))
    : renderDefaultStaticHome(context);
}

function renderStaticArticle(doc: FolioDoc): string {
  const article = '<main class="folio-doc-page' +
    (doc.headings.length ? ' folio-article-main' : '') + '">' +
    '<div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) + '</div></div>' +
    '<h1>' + folioEscapeHtml(doc.title) + '</h1>' +
    (doc.description ? '<p class="folio-lede">' + folioEscapeHtml(doc.description) + '</p>' : '') +
    renderFolioStaticDocMeta(doc) +
    '<article class="folio-markdown">' +
    renderFolioMarkdown(doc.body, { removeH1: true }) + '</article></main>';
  const toc = renderStaticToc(doc);
  if (!toc) return article;
  return '<div class="folio-article-layout">' +
    '<details class="folio-article-mobile-toc"><summary>本页目录</summary>' +
    toc + '</details>' + article + toc + '</div>';
}

function defaultRoutes(context: FolioStaticBuildContext): FolioStaticRoute[] {
  assertNoFolioCollectionConflicts(context.docs, context.config);
  return [
    {
      path: "/",
      title: context.config.title,
      description: context.config.description,
      body: renderFolioStaticHome(context),
      type: "website",
    },
    ...folioCollectionIndexes(context.config).map((collection) => ({
      path: collection.path,
      title: collection.title,
      description: collection.description,
      type: "website",
      body: renderStaticCollectionIndex(context, collection),
    })),
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        doc.type === "doc"
          ? renderStaticDocShell(context, doc)
          : doc.type === "project"
            ? renderFolioStaticProjectShell(context, doc)
          : doc.type === "article"
            ? renderStaticArticle(doc)
            : `<main class="folio-prerender"><p>${folioEscapeHtml(doc.group)}</p><h1>${folioEscapeHtml(doc.title)}</h1><p>${folioEscapeHtml(doc.description)}</p><article class="folio-markdown">${renderFolioMarkdown(doc.body, { removeH1: true })}</article></main>`,
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  ];
}

function defaultNotFound(context: FolioStaticBuildContext): FolioStaticRoute {
  return {
    path: "/404",
    title: "Page not found",
    description: "The requested page could not be found.",
    body: `<main class="folio-prerender"><h1>Page not found</h1><p>The requested page could not be found.</p></main>`,
    type: "website",
    robots: FOLIO_NOT_FOUND_ROBOTS,
  };
}

function applyStaticHomeOverride(
  routes: FolioStaticRoute[],
  context: FolioStaticBuildContext,
  home: FolioStaticHomeOverride,
): FolioStaticRoute[] {
  const index = routes.findIndex((route) => normalizeStaticRoute(route.path) === "/");
  if (index < 0) {
    throw new Error("folio staticRoutes.home requires a '/' route in the route set");
  }
  const base = routes[index];
  const value = typeof home === "function" ? home(context, base) : home;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("folio staticRoutes.home must return a route object");
  }
  if ("path" in value && value.path !== undefined && normalizeStaticRoute(String(value.path)) !== "/") {
    throw new Error("folio staticRoutes.home may only override the '/' route, got " + JSON.stringify(value.path));
  }
  const merged = { ...base, ...value, path: "/" };
  if (typeof merged.body !== "string") {
    throw new Error("folio staticRoutes.home body must be a string");
  }
  routes[index] = merged;
  return routes;
}

function staticReservedOutputs(
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions,
  routes: readonly FolioStaticRoute[],
): string[] {
  // Feed files are written after the pages, 404, sitemap and robots, so a feed
  // named like any of those targets would silently overwrite it. Derive the
  // exact file targets from the final route set (after the home override) and
  // from the fixed outputs this build actually enables.
  const names = routes.map((route) => {
    const path = normalizeStaticRoute(route.path);
    return path === "/" ? "index.html" : `${path.slice(1)}/index.html`;
  });
  names.push("404.html");
  if (context.config.siteUrl && options.sitemap !== false) names.push("sitemap.xml");
  if (context.config.siteUrl && options.robots !== false) names.push("robots.txt");
  return names;
}

export function writeFolioStaticSite(
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions = {},
): { routes: number } {
  // Validate before touching the output directory: a mistyped preview flag must
  // fail loudly instead of writing a silently indexable site.
  assertFolioSiteIndexing(options.siteIndexing);
  const indexPath = resolve(context.outDir, "index.html");
  if (!existsSync(indexPath)) return { routes: 0 };

  const template = readFileSync(indexPath, "utf8");
  const routes = options.routes?.(context) ?? defaultRoutes(context);
  const overriddenRoutes = options.home
    ? applyStaticHomeOverride([...routes], context, options.home)
    : routes;
  // Sitemap `<lastmod>` values are resolved (and explicit route values are
  // validated) before the first page is written: a consumer typo fails the
  // build instead of leaving a half-written site. Routes without a trusted
  // modification date keep only `<loc>`.
  const sitemapLastmods =
    context.config.siteUrl && options.sitemap !== false
      ? new Map(
          overriddenRoutes.map((route) => [
            normalizeStaticRoute(route.path),
            resolveFolioSitemapLastmod(route),
          ]),
        )
      : undefined;
  // Feed viability (duplicates and feed-vs-static-output collisions) is
  // decided before the first page/feed write; HTML discovery later uses the
  // same plan.
  const feedPlan = buildStaticFeedPlan(
    context,
    options,
    staticReservedOutputs(context, options, overriddenRoutes),
  );
  // All route destinations are validated (including duplicate and real-target
  // collisions) before the first page is written; see static-output.ts.
  const normalizedRoutes = writeFolioStaticOutputs(
    context.outDir,
    overriddenRoutes,
    (route) => renderFolioStaticHtml(template, route, context, options),
  );

  const notFound = options.notFound?.(context) ?? defaultNotFound(context);
  // The 404 page is never indexable, even when a consumer-supplied not-found
  // route omits `robots`: the not-found default beats the site policy. An
  // explicit not-found `robots` still wins over this fallback, and the empty
  // string keeps its historical fallback meaning.
  const notFoundRoute = {
    ...notFound,
    robots: resolveFolioIndexingRobots(notFound.robots, FOLIO_NOT_FOUND_ROBOTS),
  };
  writeFolioStaticRootFile(
    context.outDir,
    "404.html",
    renderFolioStaticHtml(template, notFoundRoute, context, options),
  );

  if (context.config.siteUrl && options.sitemap !== false) {
    const urls = normalizedRoutes
      .map((route) => {
        const loc = folioAbsoluteRouteUrl(
          context.config.siteUrl!,
          context.base,
          route.path,
        );
        const lastmod = sitemapLastmods?.get(normalizeStaticRoute(route.path));
        return `<url><loc>${folioEscapeHtml(loc)}</loc>${
          lastmod ? `<lastmod>${folioEscapeHtml(lastmod)}</lastmod>` : ""
        }</url>`;
      })
      .join("");
    writeFolioStaticRootFile(
      context.outDir,
      "sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    );
  }

  if (context.config.siteUrl && options.robots !== false) {
    writeFolioStaticRootFile(
      context.outDir,
      "robots.txt",
      folioRobotsTxt({
        siteIndexing: options.siteIndexing,
        sitemapUrl: folioAbsoluteAssetUrl(
          context.config.siteUrl,
          context.base,
          "sitemap.xml",
        ),
      }),
    );
  }

  // Feed names pass through the same fixed-name safety layer as 404.html,
  // sitemap.xml and robots.txt.
  for (const file of feedPlan.files) {
    writeFolioStaticRootFile(context.outDir, file.name, file.content);
  }

  return { routes: normalizedRoutes.length };
}
