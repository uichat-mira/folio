import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  renderFolioMarkdown,
  resolveGithubPagesBase,
} from "@uichat-mira/folio";
import {
  folio,
  folioEscapeHtml,
  type FolioStaticBuildOptions,
} from "@uichat-mira/folio/vite";
import config from "./folio.config";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);

function routeHref(basePath: string, path: string): string {
  const prefix = basePath === "/" ? "/" : basePath;
  const route = path.startsWith("/") ? path.slice(1) : path;
  return prefix + route;
}

const staticBuild: FolioStaticBuildOptions = {
  locale: "zh_CN",
  siteName: "Folio",
  twitterCard: "summary",
  title: (route) =>
    route.path === "/"
      ? "Folio · Git-native content runtime"
      : route.title + " · Folio",
  routes: (context) => [
    {
      path: "/",
      title: "Folio",
      description:
        "Git-native content and static publishing runtime for Vite and React.",
      type: "website",
      body:
        '<main class="folio-prerender folio-prerender--showcase">' +
        '<p class="folio-prerender__eyebrow">Official reference implementation</p>' +
        "<h1>把内容留在 Git，把表达交给组合。</h1>" +
        "<p>这个网站只消费 Folio 的公开 package entrypoints，同时展示 content graph、React runtime、static build 与 GitHub Pages 发布契约。</p>" +
        '<p><a href="' +
        routeHref(context.base, "/docs/introduction") +
        '">从 Folio 是什么开始 →</a></p>' +
        "</main>",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "Folio",
        description:
          "Git-native content and static publishing runtime for Vite and React.",
        codeRepository: "https://github.com/uichat-mira/folio",
        programmingLanguage: ["TypeScript", "React"],
        runtimePlatform: "Vite",
      },
    },
    ...context.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      description: doc.description || context.config.description,
      body:
        '<main class="folio-prerender folio-prerender--document">' +
        '<p class="folio-prerender__eyebrow">' +
        folioEscapeHtml(doc.group) +
        "</p>" +
        "<h1>" +
        folioEscapeHtml(doc.title) +
        "</h1>" +
        "<p>" +
        folioEscapeHtml(doc.description) +
        "</p>" +
        "<article>" +
        renderFolioMarkdown(doc.body, { removeH1: true }) +
        "</article>" +
        "</main>",
      type: doc.type === "article" ? "article" : "website",
      image: doc.cover,
      doc,
    })),
  ],
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
