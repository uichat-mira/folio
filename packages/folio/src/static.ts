import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { findFolioDocCollection, getFolioDocNeighbors } from "./docs-structure";
import { renderFolioMarkdown } from "./markdown";
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

function normalizeRoute(path: string): string {
  const normalized = `/${path}`.replace(/\/{2,}/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
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
  const route = normalizeRoute(path);
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

function routeOutputPath(outDir: string, path: string): string {
  const route = normalizeRoute(path);
  if (route === "/") return resolve(outDir, "index.html");
  return resolve(outDir, route.replace(/^\//, ""), "index.html");
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
  const route = normalizeRoute(path);
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

function defaultRoutes(context: FolioStaticBuildContext): FolioStaticRoute[] {
  return [
    {
      path: "/",
      title: context.config.title,
      description: context.config.description,
      body: `<main class="folio-prerender"><h1>${folioEscapeHtml(context.config.title)}</h1><p>${folioEscapeHtml(context.config.description)}</p></main>`,
      type: "website",
    },
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        doc.type === "doc"
          ? renderStaticDocShell(context, doc)
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
  const routeMap = new Map(
    routes.map((route) => [normalizeRoute(route.path), { ...route, path: normalizeRoute(route.path) }]),
  );

  for (const route of routeMap.values()) {
    const target = routeOutputPath(context.outDir, route.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      renderFolioStaticHtml(template, route, context, options),
      "utf8",
    );
  }

  const notFound = options.notFound?.(context) ?? defaultNotFound(context);
  writeFileSync(
    resolve(context.outDir, "404.html"),
    renderFolioStaticHtml(template, notFound, context, options),
    "utf8",
  );

  if (context.config.siteUrl && options.sitemap !== false) {
    const urls = [...routeMap.values()]
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
    writeFileSync(
      resolve(context.outDir, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
      "utf8",
    );
  }

  if (context.config.siteUrl && options.robots !== false) {
    writeFileSync(
      resolve(context.outDir, "robots.txt"),
      `User-agent: *\nAllow: /\nSitemap: ${folioAbsoluteAssetUrl(
        context.config.siteUrl,
        context.base,
        "sitemap.xml",
      )}\n`,
      "utf8",
    );
  }

  return { routes: routeMap.size };
}
