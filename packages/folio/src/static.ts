import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findFolioDocCollection, getFolioDocNeighbors } from "./core/docs-structure";
import {
  folioCollectionIndexes,
  selectFolioCollectionDocs,
  assertNoFolioCollectionConflicts,
  type FolioCollectionIndex,
} from "./core/collection-index";
import { renderFolioMarkdown } from "./core/markdown";
import {
  normalizeStaticRoute,
  writeFolioStaticOutputs,
  writeFolioStaticRootFile,
} from "./static-output";
import type { FolioDoc, FolioConfig } from "./types";

export type FolioStaticRoute = {
  path: string;
  title: string;
  description: string;
  body: string;
  type?: string;
  image?: string;
  robots?: string;
  jsonLd?: unknown;
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

export type FolioStaticBuildOptions = {
  routes?: (context: FolioStaticBuildContext) => FolioStaticRoute[];
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

function dataList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[|,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultJsonLd(
  route: FolioStaticRoute,
  context: FolioStaticBuildContext,
  canonical: string,
  image: string | undefined,
): unknown {
  if (!route.doc) {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: context.config.title,
      url: canonical,
    };
  }

  const authors = dataList(route.doc.data.author);
  return {
    "@context": "https://schema.org",
    "@type": route.doc.type === "article" ? "Article" : "TechArticle",
    headline: route.title,
    description: route.description,
    url: canonical,
    image,
    datePublished: route.doc.date,
    author: authors.map((name) => ({ "@type": "Person", name })),
    publisher: { "@type": "Organization", name: context.config.title },
  };
}

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
  const pageTitle =
    options.title?.(route, context.config) ??
    (route.title === context.config.title
      ? route.title
      : `${route.title} · ${context.config.title}`);
  const canonical = context.config.siteUrl
    ? folioAbsoluteRouteUrl(context.config.siteUrl, context.base, route.path)
    : "";
  const image = resolveImage(route, context, options);
  const robots = route.robots || "index,follow";
  const jsonLd =
    route.jsonLd ?? defaultJsonLd(route, context, canonical, image);
  const imageMetadata = options.image ?? {};

  const head = [
    `<meta name="description" content="${folioEscapeHtml(route.description)}">`,
    `<meta name="robots" content="${folioEscapeHtml(robots)}">`,
    canonical
      ? `<link rel="canonical" href="${folioEscapeHtml(canonical)}">`
      : "",
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

  return transformed
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${folioEscapeHtml(pageTitle)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/gi, "")
    .replace(/<meta name="robots"[^>]*>\s*/gi, "")
    .replace(/<link rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "")
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

function renderStaticDocNav(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const collection = findFolioDocCollection(context.docs, doc);
  if (!collection) return "";

  const sections = collection.sections
    .map(
      (section) =>
        `<section><h2>${folioEscapeHtml(section.title)}</h2><ul>${section.docs
          .map(
            (item) =>
              `<li><a${item.path === doc.path ? ' class="active" aria-current="page"' : ""} href="${folioEscapeHtml(staticRouteHref(context, item.path))}">${folioEscapeHtml(item.title)}</a></li>`,
          )
          .join("")}</ul></section>`,
    )
    .join("");

  return `<nav class="folio-docnav" aria-label="文档目录"><div class="folio-docnav__collection">${folioEscapeHtml(collection.title)}</div>${sections}</nav>`;
}

function renderStaticToc(doc: FolioDoc): string {
  if (!doc.headings.length) return "";

  return `<aside class="folio-toc" aria-label="本页目录"><h2>本页目录</h2><ul>${doc.headings
    .map(
      (heading) =>
        `<li class="folio-toc-depth-${heading.depth}"><a href="#${folioEscapeHtml(heading.id)}">${folioEscapeHtml(heading.text)}</a></li>`,
    )
    .join("")}</ul></aside>`;
}

function renderStaticMobileDocs(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const nav = renderStaticDocNav(context, doc);
  const toc = renderStaticToc(doc);

  return `<div class="folio-docs-mobile-bar folio-docs-mobile-bar--static"><details class="folio-static-doc-menu"><summary>菜单</summary><div class="folio-static-doc-menu__panel">${nav}</div></details>${toc ? `<details class="folio-static-doc-menu folio-static-doc-menu--toc"><summary>页面导航</summary><div class="folio-static-doc-menu__panel">${toc}</div></details>` : ""}</div>`;
}

function renderStaticPager(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  const { previous, next } = getFolioDocNeighbors(context.docs, doc);
  if (!previous && !next) return "";

  const previousHtml = previous
    ? `<a class="folio-page-nav__previous" href="${folioEscapeHtml(staticRouteHref(context, previous.path))}"><span>上一篇</span><strong>${folioEscapeHtml(previous.title)}</strong></a>`
    : "<span></span>";
  const nextHtml = next
    ? `<a class="folio-page-nav__next" href="${folioEscapeHtml(staticRouteHref(context, next.path))}"><span>下一篇</span><strong>${folioEscapeHtml(next.title)}</strong></a>`
    : "<span></span>";

  return `<nav class="folio-page-nav" aria-label="文档分页">${previousHtml}${nextHtml}</nav>`;
}

function renderStaticDocShell(
  context: FolioStaticBuildContext,
  doc: FolioDoc,
): string {
  return `<div class="folio-docs-runtime folio-docs-runtime--static">${renderStaticMobileDocs(context, doc)}<div class="folio-docs-shell">${renderStaticDocNav(context, doc)}<main class="folio-doc-main"><div class="folio-doc-toolbar"><div class="folio-eyebrow">${folioEscapeHtml(doc.group)}</div></div><h1>${folioEscapeHtml(doc.title)}</h1>${doc.description ? `<p class="folio-lede">${folioEscapeHtml(doc.description)}</p>` : ""}<article class="folio-markdown">${renderFolioMarkdown(doc.body, { removeH1: true })}</article>${renderStaticPager(context, doc)}</main>${renderStaticToc(doc)}</div></div>`;
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

function renderStaticHome(context: FolioStaticBuildContext): string {
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

function renderStaticArticle(doc: FolioDoc): string {
  const article = '<main class="folio-doc-page' +
    (doc.headings.length ? ' folio-article-main' : '') + '">' +
    '<div class="folio-doc-toolbar"><div class="folio-eyebrow">' +
    folioEscapeHtml(doc.group) + '</div></div>' +
    '<h1>' + folioEscapeHtml(doc.title) + '</h1>' +
    (doc.description ? '<p class="folio-lede">' + folioEscapeHtml(doc.description) + '</p>' : '') +
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
      body: renderStaticHome(context),
      type: "website",
    },
    ...folioCollectionIndexes(context.config).map((collection) => {
      const title = collection.title;
      return {
        path: collection.path,
        title,
        description: collection.description,
        type: "website",
        body: renderStaticCollectionIndex(context, collection),
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description: collection.description,
          url: context.config.siteUrl
            ? folioAbsoluteRouteUrl(context.config.siteUrl, context.base, collection.path)
            : undefined,
        },
      };
    }),
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        doc.type === "doc"
          ? renderStaticDocShell(context, doc)
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
    robots: "noindex,nofollow",
  };
}

export function writeFolioStaticSite(
  context: FolioStaticBuildContext,
  options: FolioStaticBuildOptions = {},
): { routes: number } {
  const indexPath = resolve(context.outDir, "index.html");
  if (!existsSync(indexPath)) return { routes: 0 };

  const template = readFileSync(indexPath, "utf8");
  const routes = options.routes?.(context) ?? defaultRoutes(context);
  // All route destinations are validated (including duplicate and real-target
  // collisions) before the first page is written; see static-output.ts.
  const normalizedRoutes = writeFolioStaticOutputs(
    context.outDir,
    routes,
    (route) => renderFolioStaticHtml(template, route, context, options),
  );

  const notFound = options.notFound?.(context) ?? defaultNotFound(context);
  writeFolioStaticRootFile(
    context.outDir,
    "404.html",
    renderFolioStaticHtml(template, notFound, context, options),
  );

  if (context.config.siteUrl && options.sitemap !== false) {
    const urls = normalizedRoutes
      .map((route) =>
        `<url><loc>${folioEscapeHtml(
          folioAbsoluteRouteUrl(
            context.config.siteUrl!,
            context.base,
            route.path,
          ),
        )}</loc></url>`,
      )
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
      `User-agent: *\nAllow: /\nSitemap: ${folioAbsoluteAssetUrl(
        context.config.siteUrl,
        context.base,
        "sitemap.xml",
      )}\n`,
    );
  }

  return { routes: normalizedRoutes.length };
}
