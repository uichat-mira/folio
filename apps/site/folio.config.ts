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
    { label: "展厅", href: "/showcase" },
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
  footer: "Folio · Keep content in Git. Keep expression composable.",
});
