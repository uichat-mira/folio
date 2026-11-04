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
    { label: "展厅", href: "/showcase" },
    { label: "文章", href: "/blogs" },
    { label: "项目", href: "/projects" },
    { label: "部署", href: "/api/deployment/github-pages" },
  ],
  collections: [
    {
      path: "/docs",
      title: "手册",
      description: "从入门、内容协议到运行时组合与静态发布的连续手册。",
    },
    {
      path: "/api",
      title: "API 参考",
      description: "递归收录 /api 下的指南、Reference、部署与迁移记录。",
    },
    {
      path: "/blogs",
      title: "文章与专题",
      description: "以日期、作者、标签和长文结构组织的设计说明与操作记录。",
    },
    {
      path: "/showcase",
      title: "能力展厅",
      description: "内容图谱、独立参考页与操作型示例文档的汇总入口。",
    },
    {
      path: "/projects",
      title: "项目档案",
      description: "记录目标、范围、现状与技术边界的项目页面。",
    },
  ],
  footer: "Folio · Keep content in Git. Keep expression composable.",
});
