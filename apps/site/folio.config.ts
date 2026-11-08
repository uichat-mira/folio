import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Folio",
  description: "Folio 是 Mira 组织的 Git-native 内容与门户发布引擎。以 Markdown 为内容源，在构建时组织并发布产品、文档与文章。",
  siteUrl: "https://uichat-mira.github.io",
  github: "https://github.com/uichat-mira/folio",
  // Guide opens at its default collection landing; Reference deliberately
  // opens the reviewed overview rather than the nested component catalogue.
  navigation: [
    { label: "指南", collection: "/guide" },
    { label: "参考", href: "/reference/overview", collection: "/reference" },
    { label: "博客", href: "/blogs" },
    { label: "关于", href: "/about" },
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
      title: "博客",
      description: "以日期、作者、标签和长文结构组织的设计说明与操作记录。",
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
