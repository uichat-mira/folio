import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveGithubPagesBase } from "@uichat-mira/folio";
import {
  folio,
  type FolioStaticBuildOptions,
} from "@uichat-mira/folio/vite";
import config from "./folio.config";
import { buildShowcaseStaticRoutes } from "./src/static-routes";

// Dedicated preview hosting uses the domain root; GitHub Pages retains /folio/.
const base = process.env.FOLIO_SITE_BASE ?? resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
// Optional UA-aware OG endpoint. When set, the static HTML points og:image and
// twitter:image at one stable URL; the worker serves the square mark to WeChat
// and the wide brand card to other crawlers. Leave it unset to keep the local
// wide card with explicit dimensions.
const ogImageUrl = process.env.FOLIO_OG_IMAGE_URL?.trim();

const staticBuild: FolioStaticBuildOptions = {
  locale: "zh_CN",
  siteName: "Folio",
  // Reuse the approved brand kit social card on all routes unless a document
  // provides an explicit cover image. Folio resolves the deployed base path.
  defaultImage: ogImageUrl || "folio-og-1200x630.png",
  ...(ogImageUrl
    ? {}
    : { image: { type: "image/png", width: 1200, height: 630 } }),
  twitterCard: "summary_large_image",
  title: (route) =>
    route.path === "/"
      ? "Folio · 内容与门户发布引擎"
      : route.title + " · Folio",
  routes: buildShowcaseStaticRoutes,
  notFound: () => ({
    path: "/404",
    title: "Page not found",
    description: "Folio could not find this route.",
    body:
      '<main class="folio-prerender folio-prerender--showcase">' +
      '<p class="folio-prerender__eyebrow">404 / Folio</p>' +
      "<h1>这页不在内容图里。</h1>" +
      "<p>返回首页，或者继续从 Git 管理的真实内容路由里浏览。</p>" +
      '<p><a href="' +
      base +
      '">回到 Folio →</a></p>' +
      "</main>",
    robots: "noindex,nofollow",
  }),
  sitemap: true,
  robots: true,
};

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config,
      staticRoutes: staticBuild,
    }),
  ],
});
