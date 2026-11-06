import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description: "Folio 是 Mira 组织的 Git-native 内容与门户发布引擎。以 Markdown 为内容源，在构建时组织并发布产品、文档与文章。",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // 指南 / 参考 are ordinary links, not dropdowns.
  //
  // Each is a reading mode with its own sidebar, so each one lands the reader in
  // a document view directly: the docs shell supplies the left navigation and
  // the in-page TOC. A dropdown would only add a click in front of a destination
  // that already exists.
  //
  // The rule this site follows:
  //
  //     navigation entry == route root == collection prefix == content folder
  //
  // 指南 -> /guide/* (content/guide), 参考 -> /reference/* (content/reference).
  // Which page belongs to which side is still decided by `collection:` in the
  // page's own frontmatter, not by this config. Keeping the folder, the route
  // root and the collection name aligned is what makes that field and the route
  // agree instead of contradicting each other.
  //
  // `href` points at a landing page *inside* the root, so the entry still has to
  // claim the root explicitly: prefix matching only covers the landing page's own
  // subtree, which would leave /guide/content-model with nothing lit. `activeMatch`
  // names the root once, and because the roots are disjoint no page can match
  // both entries. (Round 3 needed a per-page list precisely because the directory
  // itself was shared; here the directory is the section, so one prefix is enough.)
  navigation: [
    { label: "指南", href: "/guide/introduction", activeMatch: ["/guide"] },
    { label: "参考", href: "/reference/overview", activeMatch: ["/reference"] },
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
