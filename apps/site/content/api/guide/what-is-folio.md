---
title: API 文档索引
path: /api/guide/what-is-folio
description: 按任务查找 Folio 公共 API、内容模型、静态构建、部署、示例与附录。
group: 参考 · API
order: 40
type: doc
status: published
tags:
  - Folio
  - API
  - Index
---

这里不再重复产品介绍。Folio 的定位、职责边界和推荐阅读顺序见 [Folio 是什么](/docs/introduction)；本页只负责把 API 与参考内容按任务组织起来。

## Canonical identity

```text
repository     uichat-mira/folio
package        @uichat-mira/folio
vite module    virtual:folio/content
runtime        FolioApp
plugin         folio()
```

当前公开版本是 `0.1.1`。`dev` 源码可能包含尚未发布的候选契约，相关页面会单独标注。

## 按任务查找

| 任务 | 文档 |
| --- | --- |
| 安装、运行仓库或接入 consumer | [快速开始](/api/guide/getting-started) |
| 编写文档、文章、项目和页面 | [编写内容](/api/guide/authoring) |
| 理解 `FolioDoc`、路径和类型推断 | [内容模型](/api/guide/content-model) |
| 配置导航、分组、排序和首页 | [站点配置与扩展](/api/guide/configuration)、[导航与内容清单](/api/guide/navigation) |
| 使用 Markdown、Callout、Mermaid 与标题锚点 | [Markdown Runtime](/api/guide/markdown-runtime) |
| 组合 React runtime 与 official site | [只用公开 API 组合站点](/docs/runtime-composition) |
| 生成静态 HTML、metadata、sitemap 与 robots | [静态发布](/docs/static-publishing)、[静态构建与 SEO](/api/reference/seo) |
| 接入 Vite plugin | [Vite 构建集成](/api/reference/build-integration) |
| 查 Frontmatter 字段和默认值 | [Frontmatter 参考](/api/reference/frontmatter) |
| 发布到 GitHub Pages 或下游平台 | [部署到 GitHub Pages](/api/deployment/github-pages)、[Cloudflare Pages 案例](/api/deployment/cloudflare-pages) |
| 查看 MiraDocs → Folio 迁移事实 | [迁移状态](/api/guide/migration-status) |

## 公开入口

- `@uichat-mira/folio`：内容解析、配置 helper、React runtime、Markdown 渲染、搜索与文档结构。
- `@uichat-mira/folio/vite`：`folio()` Vite plugin、`virtual:folio/content` 与静态构建 helper。
- `@uichat-mira/folio/styles.css`：whole-site 默认样式表，不是隔离的 embed stylesheet。

## 参考、案例与附录

这些材料不是入门路径的替代品：

- [案例：这个站就是 Folio 的测试用例](/reference/site)
- [产品设计系统](/api/examples/product-design-system)
- [Apple 设计研究](/api/examples/apple)
- [Claude 设计研究](/api/examples/claude)
- [Supabase 设计研究](/api/examples/supabase)
- [在 Typora 中自动将图片上传到 Cloudflare R2](/api/appendix/typora-r2)
- [为什么要先让自己使用 Folio](/blogs/why-folio)
- [Folio 项目](/projects/folio)
