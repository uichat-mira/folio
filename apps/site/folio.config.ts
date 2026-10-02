import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "把 Markdown、GitHub 和公开站点接成一条可由技能操作的内容链路。",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  navigation: [
    { label: "文档", href: "/docs/introduction" },
    { label: "博客", href: "/blogs/why-folio" },
    { label: "项目", href: "/projects/folio" },
  ],
  footer: "Folio · Git-native, skill-ready, self-hostable.",
});
