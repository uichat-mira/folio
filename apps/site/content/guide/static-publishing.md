---
title: 静态发布不是只产出一个 SPA 壳
description: Folio 在 Vite build 阶段生成 route HTML、SEO 元数据、404、sitemap、robots 与机器可读 schema，并区分已发布 0.1.1 与 dev 源码。
group: 组合
collection: 指南
order: 31
type: doc
status: published
tags:
  - Static
  - SEO
  - GitHub Pages
---

Folio 的 Vite 插件不只负责把 Markdown 变成浏览器里的运行时数据。

在生产构建阶段，它还会为真实 route 写出静态 HTML，并生成站点级发布产物。`vite dev` 不写这些文件：静态发布只发生在 `vite build` 的 `writeBundle` 阶段。

## 构建链路

```text
content/*.md
→ folio() 内容发现（parseFolioDoc / exclude / route）
→ virtual:folio/content（runtime 数据）
→ staticRoutes（默认路由集或 consumer 自定义）
→ writeBundle 写出 dist/
```

同一份内容 manifest 同时服务 runtime 与静态投影，不存在“另一套静态内容系统”。静态 route 的正文、metadata、sitemap 与 robots 使用同一份 route 数据和同一个 Vite `base`。

## 当前官方站会生成什么

官方站 `apps/site` 使用自定义 `staticRoutes.routes`，代表性产物包括：

```text
apps/site/dist/
├── index.html
├── guide/introduction/index.html
├── reference/site/index.html
├── blogs/why-folio/index.html
├── blogs/category/工程实践/index.html     # FOL-041 归档 route
├── blogs/tag/folio/index.html             # FOL-041 归档 route
├── about/index.html
├── 404.html
├── sitemap.xml
├── robots.txt
└── schemas/
    ├── config.schema.json
    └── content.schema.json
```

上面只列代表路由；`content/` 中的每篇 Markdown 都会生成 route。`schemas/` 由站点脚本从仓库 `schemas/` 复制，不是 Folio 运行时生成的内容。

官方站**没有**启用 `feeds`，因此产物里没有 `rss.xml` / `atom.xml`；它也**没有**调用 `folioPwa()`，因此没有 `sw.js` 或 `folio-version.json`。`public/site.webmanifest` 是站点自己维护的静态 manifest，与可选 PWA 集成不是同一件事。

## Route 级元数据

静态构建契约支持：

- title 与 description；
- canonical URL；
- Open Graph；
- Twitter Card；
- JSON-LD；
- route 级 robots；
- social image；
- 自定义 title rule。

官方首页通过公开的 `FolioStaticBuildOptions.routes` 注入自己的 `SoftwareSourceCode` JSON-LD；`route.jsonLd` 永远原样优先，不与默认 JSON-LD 合并。

canonical、`og:url` 与 sitemap 的 `<loc>` 依赖 `config.siteUrl`；未配置时不会按猜测的域名生成。社交图在没有 `siteUrl` 时会退化为 base 相对路径，而不是编造绝对域名。

更细的 JSON-LD 类型、作者/日期来源、`lastmod`、`siteIndexing` 与 Feed 契约见[静态构建与 SEO](/reference/seo)。

## base path

官方站实际部署在：

```text
https://uichat-mira.github.io/folio/
```

它不是根域站点，因此所有 route 与 asset 都必须正确处理 `/folio/` base path：

```ts
const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
```

静态目录 URL 带尾斜杠（`/folio/guide/introduction/`），React Router 路由不带（`/guide/introduction`）。GitHub Pages 会把无斜杠请求 301 到斜杠形式，所以两种写法都能到达；这是目录索引与 SPA 路由的表示差异，不是链接缺陷。

同一套构建也支持根路径：官方站的 Cloudflare 预览用 `FOLIO_SITE_BASE=/` 构建，因此 route、canonical、sitemap 与内部链接都指向根域。base 取错时，链接和资源会整体错位，而不是“只影响样式”。

## 部署平台

Folio 只产出可部署静态文件；平台选择不反向进入 runtime：

- 官方站生产：GitHub Pages，见[部署到 GitHub Pages](/reference/github-pages)；
- 官方站 `dev` 预览：Cloudflare Pages 独立项目，见[下游案例：Cloudflare Pages](/reference/cloudflare-pages)；
- 其他 consumer：任何能托管目录索引、`404.html` 与正确 MIME 的静态主机。

预览部署只证明构建产物能托管，不证明 npm 已发布，也不替代 `prod` 的生产发布。

## 站点级产物

- `sitemap.xml`：列出本次写出的 route；dev 源码还会为有显式 `lastmod` 或可信修改时间的 route 写 `<lastmod>`，0.1.1 只有 `<loc>`。
- `robots.txt`：0.1.1 输出允许抓取并声明 sitemap；dev 源码的 `siteIndexing: "noindex"` 会保留 `Allow: /`、去掉 `Sitemap:` 行，并让页面级 robots 变成 `noindex,nofollow`。
- `404.html`：在两种索引策略下都默认 `noindex,nofollow`；显式给 `notFound` route 设置 `robots` 才能覆盖。
- Feed：`dev` 源码支持为 route 目录生成 RSS 2.0 / Atom 1.0 与 discovery link；需要 `config.siteUrl`，官方站当前未启用。0.1.1 没有 `feeds` 选项。

## 无 JavaScript 时能做什么

库默认的 `staticRoutes: true` 会为文档页输出侧边栏、页内目录和上一篇/下一篇，链接都指向真实生成的 HTML。

官方站使用自定义 `staticRoutes.routes`：文档页同样输出侧边栏、页内目录和上一篇/下一篇；但站点顶栏导航是 React 特性，静态页面不包含它。自定义 route 的正文标记由站点自己组合，因此“无 JS 可读”是站点责任，不是库自动保证。

## 只覆写首页

如果只想改静态首页而不接管全站路由，`dev` 源码提供 `staticRoutes.home`：它只替换 `/` 的 body 与元数据，其他文章、目录、404、sitemap/robots 保持默认输出。`home` 接收显式 HTML，也可以是 `(context, defaultHome) => route`；需要复用内置选择逻辑时使用 `/vite` 的 `renderFolioStaticHome(context)` 或根入口的 `resolveFolioHome(config, docs)`。

已发布的 `0.1.1` **没有** `home`、`renderFolioStaticHome` 或 `resolveFolioHome`；在 `0.1.1` 上只能通过 `routes` 接管全部路由，或直接使用默认界面。不要把 ReactNode 当作可自动序列化的静态内容。

## 可选扩展

- [Article 分类与标签归档](/reference/article-archives)：`collections[].archive` 推导 `<collection>/category/<slug>` 与 `<collection>/tag/<slug>` 静态页；`dev` 源码能力，0.1.1 不支持。
- [可选 PWA](/reference/pwa)：manifest、Service Worker、内容版本与 HTML 缓存边界；`dev` 源码能力，0.1.1 不支持。

## 相关文档

- [静态构建与 SEO](/reference/seo)：`FolioStaticRoute`、metadata、sitemap、robots、索引策略与 Feed 配置。
- [Vite 构建集成](/reference/build-integration)：内容发现、`staticRoutes` 阶段与公开 helper。
- [部署到 GitHub Pages](/reference/github-pages)：项目子路径的构建与发布。
