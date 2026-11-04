---
title: 静态构建与 SEO
description: Folio 的静态 route、metadata、JSON-LD、sitemap 与 robots 契约。
group: API
collection: 参考
order: 43
type: doc
status: published
tags:
  - SEO
  - Static Build
---

Folio 在 Vite build 后为公开 route 写出目录式 HTML。

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
  lastmod?: string
  doc?: FolioDoc
}
```

`lastmod` 是当前 `dev` 源码中的候选字段，用于显式指定 sitemap `<lastmod>`；已发布 `0.1.1` 不包含它。

## FolioStaticBuildOptions

可控制 `routes(context)`、`notFound(context)`、locale / siteName、默认 social image、Twitter Card、title rule、template transform、sitemap 与 robots。

`dev` 源码还包含以下候选契约，尚未包含在已发布的 `0.1.1` 中：

- `FolioStaticBuildOptions.home`：只覆盖 `/` 的 body 与 metadata；
- `FolioStaticRoute.lastmod`：为单条 route 指定 sitemap `<lastmod>`；
- `FolioStaticBuildOptions.siteIndexing: "noindex"`：为预览构建统一输出 robots 策略；
- `FolioStaticBuildOptions.feeds`：为 route 目录生成 RSS 2.0 / Atom 1.0 与 discovery link。

这些选项的行为以当前 `dev` 源码和仓库的 `docs/static-build.md` 为准；使用已发布包时不要假定它们可用。

## 自动 metadata

每个静态页面可包含 title、description、robots、canonical、Open Graph、Twitter Card、JSON-LD 和服务端可见正文。

未提供 JSON-LD 时，Folio 会根据 route/doc 生成 `WebSite`、`CollectionPage`、`TechArticle` 或 `Article`。Article 的作者按“Frontmatter `author` → `config.author` → 省略”解析；日期只使用可信来源，无法证明时省略而不是编造。

## 索引与 feed（dev 候选）

`siteIndexing: "noindex"` 会为默认 route 与自定义 route 输出 `noindex,nofollow`，同时保持 `robots.txt` 允许抓取，以便爬虫读到页面级 noindex。`feeds` 需要 `config.siteUrl`，会为配置的 route 目录生成 RSS/Atom 文件与 `<link rel="alternate">`。两者都不由主机名或部署路径自动推断。

## 输出

```text
dist/
├── index.html
├── <route>/index.html
├── 404.html
├── sitemap.xml
└── robots.txt
```

`base` 来自 Vite，因此根域和 GitHub Pages 项目路径使用同一套写盘逻辑。
