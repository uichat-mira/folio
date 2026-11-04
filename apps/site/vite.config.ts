import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveGithubPagesBase } from "@uichat-mira/folio";
import {
  folio,
  type FolioStaticBuildOptions,
} from "@uichat-mira/folio/vite";
import config from "./folio.config";
import { buildShowcaseStaticRoutes } from "./src/static-routes";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);

const staticBuild: FolioStaticBuildOptions = {
  locale: "zh_CN",
  siteName: "Folio",
  twitterCard: "summary",
  title: (route) =>
    route.path === "/"
      ? "Folio · Git-native content runtime"
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
