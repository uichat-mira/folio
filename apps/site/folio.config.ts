import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description: "Folio 是 Mira 组织的 Git-native 内容与门户发布引擎。以 Markdown 为内容源，在构建时组织并发布产品、文档与文章。",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // Guide uses the first document in its collection. Reference explicitly
  // lands on its reviewed overview page: converting nested component guides to
  // type: doc must not silently change the entry into the reference handbook.
  // `collection` still marks every route under each section root as active.
  // The route root and content folder stay aligned with the collection prefix:
  // Guide -> /guide/* (content/guide); Reference -> /reference/* (content/reference).
  //
  // 展厅 has children and still needs an explicit `href`; 文章 / 项目 point at
  // their collection index pages.
  navigation: [
    { label: "指南", collection: "/guide" },
    { label: "参考", href: "/reference/overview", collection: "/reference" },
    {
      label: "展厅",
      href: "/showcase",
      activeMatch: ["/showcase"],
      panel: {
        eyebrow: "SHOWCASE",
        title: "能力展厅",
        description: "查看真实的内容组织、渲染链路与操作示例。",
        overviewLabel: "浏览全部展厅",
      },
      // The two groups mirror existing content: standalone reference pages
      // (type: page) and hands-on docs (section: 操作示例).
      children: [
        {
          label: "内容组织图谱",
          href: "/showcase/content-map",
          icon: "layers",
          group: "独立参考页",
          description: "四种内容类型、集合路由与交叉阅读入口。",
        },
        {
          label: "从文件到页面",
          href: "/showcase/from-file-to-page",
          icon: "file",
          group: "独立参考页",
          description: "Markdown 解析、运行时路由和静态发布链路。",
        },
        {
          label: "内容组织实践",
          href: "/showcase/guides/organize-content",
          icon: "compass",
          group: "操作示例",
          description: "用现有字段组织读者路径与内容层级。",
        },
        {
          label: "集合与导航",
          href: "/showcase/guides/collections-and-navigation",
          icon: "book",
          group: "操作示例",
          description: "配置集合索引、递归收录与导航入口。",
        },
      ],
    },
    { label: "文章", href: "/blogs" },
    { label: "项目", href: "/projects" },
  ],
  collections: [
    {
      path: "/guide",
      title: "指南",
      description: "从定位、内容协议到运行时组合与静态发布的连续阅读路径。",
    },
    {
      path: "/reference",
      title: "参考",
      description: "Frontmatter 字段、构建阶段、部署条件、案例与附录的查阅入口。",
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
  footer: {
    brand: {
      name: "Folio",
      logo: {
        src: "/folio-logo.svg",
        darkSrc: "/folio-logo-inverse.svg",
        alt: "Folio",
      },
      description: "Git-native 内容与门户发布引擎。让仓库中的内容，成为可以持续维护的网站。",
    },
    groups: [
      {
        title: "组织站点",
        links: [
          { label: "UIChat Mira 官网", href: "https://mira.tomz.io/", newTab: true },
          { label: "Tomz.io · 见π", href: "https://tomz.io/", newTab: true },
          { label: "Folio 官网", href: "/" },
        ],
      },
      {
        title: "开源产品",
        links: [
          { label: "Mira Desktop", href: "https://github.com/uichat-mira/mira-desktop", newTab: true },
          { label: "Mira Mobile", href: "https://github.com/uichat-mira/mira-mobile", newTab: true },
          { label: "Mira GitHub 组织", href: "https://github.com/uichat-mira", newTab: true },
        ],
      },
      {
        title: "Folio 资料",
        links: [
          { label: "快速开始", href: "/guide/getting-started" },
          { label: "能力展厅", href: "/showcase" },
          { label: "Folio 源码", href: "https://github.com/uichat-mira/folio", newTab: true },
        ],
      },
    ],
    legal: {
      copyright: "© 2026 Mira Organization",
    },
  },
});
