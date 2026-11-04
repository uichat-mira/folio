import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "Git-native content and static publishing runtime for Vite and React.",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // 指南 / 参考 are ordinary links, not dropdowns.
  //
  // Each is a reading mode with its own sidebar, so each one lands the reader in
  // a document view directly: the docs shell supplies the left navigation and
  // the in-page TOC. A dropdown would only add a click in front of a destination
  // that already exists.
  //
  // Which page belongs to which side is decided by `collection:` in the page's
  // own frontmatter, not by this config. That keeps the boundary in the content
  // where the doc author can see it, and it is also what splits the sidebar.
  //
  // The pages for one side live under several route directories (指南 spans
  // /docs and /api/guide), which is why these entries carry `activeMatch`: with
  // prefix matching alone, 指南 would lose its current-page highlight on the
  // /api/guide pages.
  navigation: [
    {
      label: "指南",
      href: "/docs/introduction",
      activeMatch: [
        "/docs/introduction",
        "/docs/content-contract",
        "/docs/runtime-composition",
        "/docs/static-publishing",
        "/api/guide/getting-started",
        "/api/guide/authoring",
        "/api/guide/markdown-runtime",
        "/api/guide/content-model",
        "/api/guide/navigation",
        "/api/guide/configuration",
        "/api/guide/architecture",
      ],
    },
    {
      label: "参考",
      href: "/api/guide/what-is-folio",
      activeMatch: [
        "/api/reference",
        "/api/deployment",
        "/api/guide/migration-status",
        "/api/guide/what-is-folio",
        "/docs/content-maintenance",
      ],
    },
    { label: "展厅", href: "/showcase" },
    { label: "文章", href: "/blogs" },
    { label: "项目", href: "/projects" },
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
