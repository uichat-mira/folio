import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "Git-native content and static publishing runtime for Vite and React.",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // Top-level navigation expresses content categories; the one dropdown
  // expresses reading tasks. Everything deeper lives in the docs sidebar.
  //
  // This split is deliberate. The previous revision turned eight top-level
  // entries into five dropdowns so the component would have something to show,
  // and the categories had to be invented to fill them: "API" held the
  // introduction, "开始" held content maintenance, and 部署 became a top-level
  // category purely to justify a fifth menu. A demo that bends the content into
  // the component is not a demo of the component.
  //
  // 文档 is the only dropdown because it is the only entry with enough real
  // structure to need one. It maps onto reading tasks, and each task names the
  // group the content already uses in its own frontmatter.
  navigation: [
    {
      label: "文档",
      href: "/docs/",
      children: [
        {
          label: "快速开始",
          href: "/api/guide/getting-started",
          group: "快速开始",
          icon: "terminal",
          description: "装依赖、接插件、跑通第一篇文档。",
        },
        {
          label: "Folio 是什么",
          href: "/docs/introduction",
          group: "快速开始",
          icon: "compass",
          description: "它解决什么问题，整体形态是什么。",
        },
        {
          label: "编写内容",
          href: "/api/guide/authoring",
          group: "编写与配置",
          icon: "file",
          description: "文档、文章、项目与页面的写法。",
        },
        {
          label: "内容模型",
          href: "/api/guide/content-model",
          group: "编写与配置",
          icon: "layers",
          description: "Markdown 与 Frontmatter 如何变成 FolioDoc。",
        },
        {
          label: "导航与内容清单",
          href: "/api/guide/navigation",
          group: "编写与配置",
          icon: "book",
          description: "group、order 与 virtual manifest 的关系。",
        },
        {
          label: "站点配置",
          href: "/api/guide/configuration",
          group: "参考资料",
          icon: "info",
          description: "defineFolioConfig 与 runtime slots。",
        },
        {
          label: "Frontmatter 参考",
          href: "/api/reference/frontmatter",
          group: "参考资料",
          icon: "code",
          description: "标准字段、默认值与扩展规则。",
        },
        {
          label: "构建集成",
          href: "/api/reference/build-integration",
          group: "参考资料",
          icon: "layers",
          description: "Vite 插件与虚拟模块的接口。",
        },
        {
          label: "静态构建与 SEO",
          href: "/api/reference/seo",
          group: "参考资料",
          icon: "search",
          description: "route HTML、metadata 与 sitemap 契约。",
        },
        {
          label: "部署到 GitHub Pages",
          href: "/api/deployment/github-pages",
          group: "部署发布",
          icon: "terminal",
          description: "项目路径站点与 Actions 发布。",
        },
        {
          label: "下游案例：Cloudflare Pages",
          href: "/api/deployment/cloudflare-pages",
          group: "部署发布",
          icon: "archive",
          description: "另一条已验证的托管路径。",
        },
      ],
      panel: {
        eyebrow: "HANDBOOK",
        title: "按要做的任务读",
        description: "四类阅读任务。更细的知识层级在文档侧边栏里。",
        overviewLabel: "文档目录",
      },
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
