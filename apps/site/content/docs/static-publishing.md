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

## 只覆写首页

如果只想改静态首页而不接管全站路由，使用 `staticRoutes.home`。它只替换 `/` 的 body 与元数据，其他文章、目录、404、sitemap/robots 保持默认输出；`staticRoutes.routes` 仍然可以继续作为完整路由数组的真相源。`staticRoutes.home` 接收显式 HTML，也可以是 `(context, defaultHome) => route`。需要复用内置选择逻辑时，调用公开的 `renderFolioStaticHome(context)` 或 `resolveFolioHome(config, docs)`，不要把 ReactNode 当作可自动序列化的静态内容。

`config.home` 可以让 React 与默认静态首页共享轻量配置；完整边界见[站点配置与扩展](/api/guide/configuration)和[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。

## 无 JavaScript 时能做什么

官方站通过 `staticRoutes.routes` 提供自己的静态 body，因此静态文档页在无 JavaScript 时只有正文：能阅读单篇文档，但没有跨文档侧栏、页内目录和上一篇/下一篇。

库默认的 `staticRoutes: true` 不同：默认文档壳会生成侧栏、页内目录与上一篇/下一篇，链接都指向真实生成的文件，所以无 JavaScript 也能导航。

两种模式的完整对比，以及静态目录 URL 与 React 路由尾斜杠的差异，见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。
