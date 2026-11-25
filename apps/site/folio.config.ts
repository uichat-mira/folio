import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description: "Folio 是 Mira 组织的 Git-native 内容与门户发布引擎。以 Markdown 为内容源，在构建时组织并发布产品、文档与文章。",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // Both Guide and Reference open the first document in collection reading order.
  navigation: [
    { label: "指南", collection: "/guide" },
    { label: "参考", collection: "/reference" },
    { label: "博客", href: "/blogs" },
    { label: "关于", href: "/about" },
  ],
  collections: [
    {
      path: "/guide",
      title: "指南",
      description: "从认识 Folio、运行首站、内容创作到配置与静态发布的连续学习路径。",
    },
    {
      path: "/reference",
      title: "参考",
      description: "内容 API、React 组件、PWA、Article 归档、部署及历史资料的查阅入口。",
    },
    {
      path: "/blogs",
      title: "博客",
      description: "以日期、作者、标签和长文结构组织的设计说明与操作记录。",
      // FOL-041 demo: category/tag archives are opt-in per collection. The
      // routes derive from this path: /blogs/category/<id> and /blogs/tag/<id>.
      archive: true,
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
          { label: "首个可运行站点", href: "/guide/first-site" },
          { label: "关于 Folio", href: "/about" },
          { label: "Folio 源码", href: "https://github.com/uichat-mira/folio", newTab: true },
        ],
      },
    ],
    legal: {
      copyright: "© 2026 Mira Organization",
    },
  },
});
