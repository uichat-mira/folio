---
title: 静态发布不是只产出一个 SPA 壳
description: Folio 在 Vite build 阶段生成 route HTML、SEO 元数据、404、sitemap、robots 与机器可读 schema。
group: 能力
order: 4
type: doc
status: published
tags:
  - Static
  - SEO
  - GitHub Pages
---

Folio 的 Vite 插件不只负责把 Markdown 变成浏览器里的运行时数据。

在生产构建阶段，它还能为真实 route 写出静态 HTML，并生成站点级发布产物。

## 当前官方站会生成什么

每次生产构建至少包含：

```text
dist/
├── index.html
├── docs/introduction/index.html
├── docs/runtime-composition/index.html
├── projects/folio/index.html
├── reference/site/index.html
├── 404.html
├── sitemap.xml
├── robots.txt
└── schemas/
    ├── config.schema.json
    └── content.schema.json
```

这些不是额外的部署脚本拼出来的另一套内容系统，而是同一个 Folio manifest 的静态投影。

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

官方首页还通过公开 `FolioStaticBuildOptions` 注入自己的 `SoftwareSourceCode` JSON-LD。

## GitHub Pages 子路径

这个站实际部署在：

```text
https://uichat-mira.github.io/folio/
```

它不是根域站点，因此所有 route 与 asset 都必须正确处理 `/folio/` base path。

官方站使用公开 helper：

```ts
const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
```

这也是 reference implementation 必须真实部署，而不能只在 localhost 截图的原因。
