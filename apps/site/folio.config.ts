import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "Git-native content and static publishing runtime for Vite and React.",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  navigation: [
    { label: "开始", href: "/docs/introduction" },
    { label: "安装", href: "/api/guide/getting-started" },
    { label: "编写", href: "/api/guide/authoring" },
    { label: "API", href: "/api/guide/what-is-folio" },
    { label: "部署", href: "/api/deployment/github-pages" },
    { label: "案例", href: "/reference/site" },
  ],
  footer: "Folio · Keep content in Git. Keep expression composable.",
});
