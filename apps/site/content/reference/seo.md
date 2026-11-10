---
title: 静态构建与 SEO
description: Folio 的静态 route、metadata、JSON-LD、sitemap、robots 与 Feed 契约，并区分已发布 0.1.1 与 dev 源码。
group: API
collection: 参考
order: 43
type: doc
status: published
tags:
  - SEO
  - Static Build
  - Feed
---

Folio 在 Vite `vite build` 的 `writeBundle` 阶段为公开 route 写出目录式 HTML，并在同一份 route / `base` 数据上生成 metadata、`sitemap.xml`、`robots.txt` 与可选的 Feed。产物是普通静态文件，部署平台不反向进入 runtime 契约。

## 版本状态

公开 npm 版本是 `@uichat-mira/folio@0.1.1`（Release `folio-v0.1.1`，gitHead `e4af1f7`）。仓库 `dev` 源码已经合并了更多静态发布能力，但**尚未发布到 npm**；本页的“dev 源码”指本轮核对的 `origin/dev` 基线 `f49557c`。

| 能力 | npm 0.1.1 | dev 源码 |
| --- | --- | --- |
| 静态 route、`404.html`、`sitemap.xml`、`robots.txt` | 有 | 有 |
| canonical、Open Graph、Twitter Card、JSON-LD、route 级 `robots` | 有 | 有 |
| sitemap `<lastmod>` | 无 | 有 |
| 默认 JSON-LD 的 `CollectionPage`、可信日期、`config.author` | 无 | 有 |
| `FolioStaticBuildOptions.home`（只覆写 `/`） | 无 | 有 |
| `FolioStaticBuildOptions.siteIndexing`（预览 noindex） | 无 | 有 |
| `FolioStaticBuildOptions.feeds`（RSS 2.0 / Atom 1.0） | 无 | 有 |

从 npm 安装 `0.1.1` 时，表格中“无”的字段既不在类型里，也不会产生输出；不要仅凭本页示例就假定它们可用。反过来，`dev` 源码的 `package.json` 版本号仍是 `0.1.1`，不能把源码里的新选项当作 npm 已发布接口。

## FolioStaticRoute

```ts
type FolioStaticRoute = {
  path: string
  title: string
  description: string
  body: string
  type?: string
  image?: string
  robots?: string
  jsonLd?: unknown
  lastmod?: string   // dev 源码；0.1.1 没有
  doc?: FolioDoc
}
```

- `path` 是站点内 route；静态写出为目录式 `<route>/index.html`，`/` 写为 `index.html`。
- `body` 是服务端可见 HTML 字符串，不是 ReactNode。
- `doc` 存在时，Folio 才会生成 Article / TechArticle 类型与文档相关元数据。
- `type` 直接进入 `og:type`；官方站把 `type: article` 的文章映射为 `article`。
- `lastmod` 只用于 sitemap：取值需为 `YYYY-MM-DD` 或带显式时区的日期时间，非法值会让构建失败。0.1.1 没有该字段。

## FolioStaticBuildOptions

0.1.1 已支持的字段：

```ts
type FolioStaticBuildOptions = {
  routes?: (context) => FolioStaticRoute[]
  notFound?: (context) => FolioStaticRoute
  locale?: string
  siteName?: string
  defaultImage?: string
  image?: { type?: string; width?: number; height?: number }
  twitterCard?: "summary" | "summary_large_image"
  title?: (route, config) => string
  transformTemplate?: (template, context) => string
  rootPlaceholder?: string
  sitemap?: boolean
  robots?: boolean
}
```

`dev` 源码新增：

- `home`：只覆盖 `/` 的 body 与 metadata，其余 route 仍由 `routes` 或默认 route 集决定；
- `siteIndexing: "index" | "noindex"`：站点级索引策略；
- `feeds`：为 route 目录声明 RSS 2.0 / Atom 1.0。

这三项与 `FolioStaticRoute.lastmod` 都不属于已发布 `0.1.1`。

## 自动 metadata

每个静态页面都写入：

- `<title>`：`title(route, config)` 优先；否则当路由标题等于 `config.title` 时直接用站点标题，其他路由使用 `<route.title> · <config.title>`；
- `description`；
- `robots`（页面级，见下文优先级）；
- `canonical`：仅在配置 `config.siteUrl` 时生成，并拼接同一 Vite `base`；
- Open Graph 与 Twitter Card：`og:locale`、`og:title`、`og:description`、`og:type`、`og:url`、`og:site_name`、`og:image`（及 `secure_url` / 类型 / 尺寸）、`twitter:card`、`twitter:title`、`twitter:description`、`twitter:image`；
- JSON-LD：`route.jsonLd` 原样优先，否则生成默认对象；
- dev 源码的 feed discovery：只对真实写出的 feed 文件输出 `<link rel="alternate">`。

社交图按 `route.image` → `defaultImage` → `config.logo` 的顺序解析；相对路径会先拼部署 base，配置了 `siteUrl` 时再变成绝对 URL。

## 默认 JSON-LD

未提供 `route.jsonLd` 时：

- `/` 生成 `WebSite`（`name`、`description`、绝对 `url`；0.1.1 只写 `name` / `url`）；
- 匹配 `config.collections[].path` 的集合索引生成 `CollectionPage`（dev 源码；0.1.1 没有集合概念，此类路由按自定义 route 处理）；
- 带 `doc` 的 route 生成 `Article`（`type: article`）或 `TechArticle`，包含 `headline`、`description`、绝对 `url`、可解析时的 `image`、`publisher` 组织名；
- 其他没有 `doc` 的自定义 route 保持保守的 `WebSite` 形状。

`route.jsonLd` 一旦提供就完全不合并，也不会被默认对象覆盖。官方首页就是这样注入自己的 `SoftwareSourceCode`。

### 作者与日期

dev 源码的解析规则：

- `author`：Frontmatter `author`（数组，或按 `|` / `,` / `，` 拆分的一个字符串；数组项也可以是 `{ name, url }`）→ `config.author` → 省略该属性。Folio 不输出空作者列表，也不编造人物或组织。
- `datePublished`：只使用可信来源 `frontmatter` 或 `legacy-date`（旧的 `date` 字段）。
- `dateModified`：只使用可信来源 `frontmatter` 或 `git-last-commit`；不可信时省略该属性，而不是写入构建时间或文件 mtime。
- `git-first-commit` 永远不作为“原始发布日期”：迁移后的仓库首个提交可能晚于真实发布时间。

0.1.1 的差异：`datePublished` 直接使用 Frontmatter 的旧 `date` 字段；`author` 只读 Frontmatter，缺省时仍会输出空数组；没有 `config.author` 兜底，也没有 `CollectionPage` / 可信日期规则。

## sitemap

`sitemap.xml` 在配置 `config.siteUrl` 且 `sitemap !== false` 时写出，列出本次静态写出的所有 route（`404.html` 不在其中），`<loc>` 使用带 base 的绝对 URL。

dev 源码会为每个 `<url>` 计算 `<lastmod>`，顺序为：

1. 显式 `FolioStaticRoute.lastmod`；
2. 文档可信的 `updatedAt`（`frontmatter` 或 `git-last-commit`）；
3. 都没有时省略 `<lastmod>`。

因此首页、集合索引等没有显式 `lastmod` 的路由通常只有 `<loc>`。0.1.1 的 sitemap 只有 `<loc>`，不读取 `lastmod`。

## robots

页面级 `robots` 优先级（dev 源码）：

1. `FolioStaticRoute.robots` 的非空值；
2. `siteIndexing` 策略；
3. 内置 `index,follow`。

`404.html` 在两种索引策略下都默认 `noindex,nofollow`；只有显式给 `notFound` route 设置 `robots` 才能覆盖。

`robots: false` 与索引策略彼此独立：它只决定是否写 `robots.txt`，不改变页面能否被索引。`robots.txt` 与 `sitemap.xml` 都依赖 `config.siteUrl`。

### 预览构建的 noindex（dev 源码）

```ts
const staticBuild: FolioStaticBuildOptions = {
  siteIndexing: "noindex",
};
```

- 默认 route 与自定义 route 都输出 `noindex,nofollow`；
- `robots.txt` 保留 `Allow: /`，不写 `Sitemap:` 行，并带一行说明注释；
- 该策略只接受 `"index" | "noindex"`，拼错（例如 `"no-index"`）会在写任何文件前失败；
- Folio **不会**根据主机名、`github.io`、`localhost`、子路径或环境变量猜测“这是预览”；
- 为什么不是 `Disallow: /`：禁用抓取会让爬虫读不到页面级 noindex，反而削弱移除信号；而 robots 的 `Disallow` 本身也不是把已收录 URL 从搜索结果移除的机制，已收录地址仍需搜索引擎的移除工具。

0.1.1 没有 `siteIndexing`；它的 `robots.txt` 固定为允许抓取并声明 sitemap。

## Feed（dev 源码）

`feeds` 为**route 目录**声明订阅源：该目录下任意深度、任意 `type` 的文档都会进入 feed。它不是按“博客类型”或固定目录写死的。

```ts
const staticBuild: FolioStaticBuildOptions = {
  feeds: [
    { path: "/blogs" },
    {
      path: "/docs",
      title: "Documentation",
      rss: "docs/rss.xml",
      atom: "docs/atom.xml",
    },
    { path: "/projects", rss: "projects.xml", atom: false },
  ],
};
```

字段：

- `path`：必填的绝对 route 目录，例如 `/blogs`；根 `/` 不能作为 feed path；子树会被递归选中。
- `title`：默认为匹配集合的标题，再退回 `config.title`。
- `description`：默认为匹配集合的描述，再退回 `config.description`；为空时 Atom 不写 `<subtitle>`。
- `rss` / `atom`：站点根相对输出文件名，默认 `rss.xml` / `atom.xml`；`false` 关闭对应格式。

约束与回退：

- 必须配置 `config.siteUrl`；否则不写 feed，也不输出 discovery link（相对 URL 的 feed 在阅读器里不可用）。
- 输出名会先规范化；与生成页面（`<route>/index.html`、`404.html`、`sitemap.xml`、`robots.txt`）相同、互为祖先/后代，或两个 feed 输出路径重叠，都会在写第一个文件前失败。
- 每个实际写出的页面（首页、集合索引、文档/文章、自定义 route、`404.html`）都会得到对应的 `<link rel="alternate" type="application/rss+xml|application/atom+xml">`；模板里已有的重复 alternate 会先被移除。
- feed 内 URL 使用 `config.siteUrl` + `base` 的绝对形式；子路径部署时，`/blogs/hello` 的地址是 `https://example.com/<base>/blogs/hello/`。
- 日期同样只使用可信来源：RSS `<pubDate>` 与 Atom `<published>` 只来自可信 `publishedAt`；没有可信发布日期的文档仍会进入 RSS，只是没有 `<pubDate>`；Atom 要求 `<updated>`，既无可信 `updatedAt` 也无可信发布日期时该条目不进入 Atom；所有条目都没有日期时不写 Atom 文件，也不输出 Atom link。
- 空目录是确定的：RSS 仍写出但 `<item>` 为零，Atom 因无法得到 `<updated>` 而不写。
- feed 文件的 MIME 是 `application/rss+xml` / `application/atom+xml`。静态主机需要按 `.xml` 返回 XML，而不是 `text/html`。

0.1.1 没有 `feeds`。官方站当前也没有在 `apps/site/vite.config.ts` 声明 feed，因此构建产物里不会出现 `rss.xml` / `atom.xml`；这是“未启用”，不是“默认生成”。

## 输出

```text
dist/
├── index.html
├── <route>/index.html
├── 404.html
├── sitemap.xml          # 需要 siteUrl 且 sitemap !== false
├── robots.txt           # 需要 siteUrl 且 robots !== false
├── rss.xml              # dev 源码 + feeds 配置
└── atom.xml             # dev 源码 + feeds 配置
```

`base` 来自 Vite，所有写盘、canonical、sitemap、robots 与 feed URL 共用它；根域和 GitHub Pages 项目子路径使用同一套逻辑。

## 相关文档

- [Vite 构建集成](/reference/build-integration)：`folio()` 的接入、内容发现与 `staticRoutes` 阶段。
- [静态发布](/guide/static-publishing)：从构建产物到部署平台的完整视图。
- [Article 分类与标签归档](/reference/article-archives)：集合级归档 route 的数据契约与静态输出。
- [可选 PWA](/reference/pwa)：manifest / Service Worker 与静态 HTML 的缓存边界。
