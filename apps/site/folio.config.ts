import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "Git-native content and static publishing runtime for Vite and React.",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  navigation: [
    { label: "开始", href: "/docs/introduction" },
    { label: "组合", href: "/docs/runtime-composition" },
    { label: "静态发布", href: "/docs/static-publishing" },
    { label: "案例", href: "/reference/site" },
  ],
  footer: "Folio · Keep content in Git. Keep expression composable.",
});
