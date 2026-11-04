import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description:
    "Git-native content and static publishing runtime for Vite and React.",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // All eight original top-level entries, in their original order, each still
  // pointing at its original route. Four of them now also carry a dropdown so
  // the demo exercises the structured-menu path with routes that really exist.
  // A plain entry stays a plain entry (展厅 / 文章 / 项目) — the feature has to
  // work for both shapes, not just for menus.
  navigation: [
    {
      label: "开始",
      href: "/docs/introduction",
      children: [
        {
          label: "介绍",
          href: "/docs/introduction",
          icon: "compass",
          description: "Folio 要解决的问题与整体形态。",
        },
        {
          label: "撰写与维护",
          href: "/docs/content-maintenance",
          icon: "file",
          description: "日常更新、日期来源与内容维护流程。",
        },
        {
          label: "内容协议",
          href: "/docs/content-contract",
          icon: "file",
          description: "Frontmatter 字段与目录即路由的约定。",
        },
        {
          label: "运行时组合",
          href: "/docs/runtime-composition",
          icon: "layers",
          description: "把内容、路由和界面装配成一个站点。",
        },
      ],
      panel: {
        eyebrow: "FOLIO HANDBOOK",
        title: "从零到第一篇文档",
        description: "四篇连续的手册，按顺序读完后可以独立发布一个 Folio 站点。",
        overviewLabel: "全部手册",
      },
    },
    {
      label: "安装",
      href: "/api/guide/getting-started",
      children: [
        {
          label: "快速开始",
          href: "/api/guide/getting-started",
          icon: "terminal",
          description: "装依赖、接入 Vite 插件、写出第一篇文档。",
        },
        {
          label: "配置项参考",
          href: "/api/guide/configuration",
          icon: "info",
          description: "defineFolioConfig 的完整字段。",
        },
        {
          label: "构建集成",
          href: "/api/reference/build-integration",
          icon: "layers",
          description: "Vite 插件、虚拟模块与产物结构。",
        },
        {
          label: "迁移状态",
          href: "/api/guide/migration-status",
          icon: "archive",
          description: "当前实现与已发布版本的差异。",
        },
      ],
      panel: {
        eyebrow: "GETTING STARTED",
        title: "把 Folio 跑起来",
        description: "从安装到第一次成功构建，只需要几步。",
        overviewLabel: "全部安装说明",
      },
    },
    {
      label: "编写",
      href: "/api/guide/authoring",
      children: [
        {
          label: "写作指南",
          href: "/api/guide/authoring",
          icon: "file",
          description: "Markdown 结构、标题层级与自定义块。",
        },
        {
          label: "内容模型",
          href: "/api/guide/content-model",
          icon: "layers",
          description: "文档、集合与首页信息如何被解析。",
        },
        {
          label: "导航配置",
          href: "/api/guide/navigation",
          icon: "compass",
          description: "顶层导航、侧边栏分组与集合目录。",
        },
        {
          label: "Markdown 运行时",
          href: "/api/guide/markdown-runtime",
          icon: "code",
          description: "渲染管线、代码高亮与图表增强。",
        },
      ],
      panel: {
        eyebrow: "AUTHORING",
        title: "把内容写成结构",
        description: "Folio 只约定结构，排版与表达由你自己的样式决定。",
        overviewLabel: "全部编写指南",
      },
    },
    {
      label: "API",
      href: "/api/guide/what-is-folio",
      children: [
        {
          label: "Folio 是什么",
          href: "/api/guide/what-is-folio",
          icon: "info",
          description: "定位、边界与整体架构。",
        },
        {
          label: "Frontmatter",
          href: "/api/reference/frontmatter",
          icon: "file",
          description: "每篇文档可用的元数据字段。",
        },
        {
          label: "SEO",
          href: "/api/reference/seo",
          icon: "search",
          description: "标题、站点地图与 robots 的生成方式。",
        },
      ],
      panel: {
        eyebrow: "REFERENCE",
        title: "API 与配置参考",
        description: "按主题查证，而不是按顺序阅读。",
        overviewLabel: "全部 API 参考",
      },
    },
    { label: "展厅", href: "/showcase" },
    { label: "文章", href: "/blogs" },
    { label: "项目", href: "/projects" },
    {
      label: "部署",
      href: "/api/deployment/github-pages",
      children: [
        {
          label: "GitHub Pages",
          href: "/api/deployment/github-pages",
          icon: "link",
          description: "base 路径解析与分支发布流程。",
        },
        {
          label: "Cloudflare Pages",
          href: "/api/deployment/cloudflare-pages",
          icon: "sparkles",
          description: "另一种静态托管方式与差异说明。",
        },
        {
          label: "静态发布原理",
          href: "/docs/static-publishing",
          icon: "archive",
          description: "预渲染产物如何生成与校验。",
        },
      ],
      panel: {
        eyebrow: "SHIPPING",
        title: "把站点发出去",
        description: "两条已验证的托管路径，以及它们背后的静态产物。",
        overviewLabel: "全部部署说明",
      },
    },
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
