---
title: 参考索引
description: 按任务查找 Folio 公共 API、Frontmatter 字段、静态构建、部署、案例与附录。
group: API
collection: 参考
order: 40
type: doc
status: published
tags:
  - Folio
  - API
  - Index
---

这一侧是**查到具体事实**的阅读模式：字段、边界、构建阶段、部署条件。如果你要的是按顺序读懂的路径，去 [指南](/guide/introduction)；本页只负责把参考材料按任务组织起来，不重复产品介绍。

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
| 查 Frontmatter 字段和默认值 | [Frontmatter 参考](/reference/frontmatter) |
| 查看内置 React 组件、公开 API 与能力边界 | [组件](/reference/components) |
| 接入 Vite plugin、理解构建阶段 | [Vite 构建集成](/reference/build-integration) |
| 生成静态 HTML、metadata、sitemap 与 robots | [静态构建与 SEO](/reference/seo) |
| 发布到 GitHub Pages 或下游平台 | [部署到 GitHub Pages](/reference/github-pages)、[Cloudflare Pages 案例](/reference/cloudflare-pages) |
| 查看 MiraDocs → Folio 迁移事实 | [迁移状态](/reference/migration-status) |
| 维护官方站文档 | [官方站点内容维护约定](/reference/content-maintenance) |

## 要按顺序读懂，去指南

下面这些页面讲的是“怎么用”，因此归在 [指南](/guide/introduction)，不在这里重复：

| 任务 | 文档 |
| --- | --- |
| 安装、运行仓库或接入 consumer | [快速开始](/guide/getting-started) |
| 编写文档、文章、项目和页面 | [编写内容](/guide/authoring) |
| 选择内容类型、理解文件到路由的映射 | [内容类型与路由](/guide/content-types) |
| 写 Frontmatter、日期、作者与扩展字段 | [Frontmatter 与元数据](/guide/frontmatter-fields) |
| 组织侧栏分组与阅读顺序 | [内容组织与排序](/guide/organizing-content) |
| 理解 `FolioDoc`、路径和类型推断 | [内容模型](/guide/content-model) |
| 配置导航、分组、排序和首页 | [站点配置与扩展](/guide/configuration)、[导航与内容清单](/guide/navigation) |
| 使用 Markdown、Callout、Mermaid 与标题锚点 | [Markdown 写作](/guide/markdown-runtime) |
| 组合 React runtime 与 official site | [只用公开 API 组合站点](/guide/runtime-composition) |
| 生成静态 HTML 的完整流程 | [静态发布](/guide/static-publishing) |


## 公开入口

- `@uichat-mira/folio`：内容解析、配置 helper、React runtime、Markdown 渲染、搜索与文档结构。
- `@uichat-mira/folio/vite`：`folio()` Vite plugin、`virtual:folio/content` 与静态构建 helper。
- `@uichat-mira/folio/styles.css`：whole-site 默认样式表，不是隔离的 embed stylesheet。

## 参考、案例与附录

这些材料不是入门路径的替代品：

- [案例：这个站就是 Folio 的测试用例](/reference/site)
- [产品设计系统](/reference/examples/product-design-system)
- [Apple 设计研究](/reference/examples/apple)
- [Claude 设计研究](/reference/examples/claude)
- [Supabase 设计研究](/reference/examples/supabase)
- [在 Typora 中自动将图片上传到 Cloudflare R2](/reference/typora-r2)
- [为什么要先让自己使用 Folio](/blogs/why-folio)
- [Folio 项目](/projects/folio)
