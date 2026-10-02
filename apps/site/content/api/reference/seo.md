---
title: 静态构建与 SEO
path: /api/reference/seo
description: Folio 的静态 route、metadata、JSON-LD、sitemap 与 robots 契约。
group: Folio API · Reference
order: 52
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
  doc?: FolioDoc
}
```

## FolioStaticBuildOptions

可控制 `routes(context)`、`notFound(context)`、locale / siteName、默认 social image、Twitter Card、title rule、template transform、sitemap 与 robots。

## 自动 metadata

每个静态页面可包含 title、description、robots、canonical、Open Graph、Twitter Card、JSON-LD 和服务端可见正文。

未提供 JSON-LD 时，Folio 会根据 route/doc 生成 `WebSite`、`TechArticle` 或 `Article`。

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
