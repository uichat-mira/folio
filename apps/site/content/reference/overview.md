---
title: 参考索引
description: 按任务查找 Folio 内容与配置 API、React 组件、静态构建、PWA、部署和历史资料。
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
本页按**开发者要解决的问题**组织参考资料：字段、公共 API、构建产物、版本边界和部署条件。第一次接触 Folio 时，请先沿 [指南](/guide/introduction) 阅读。

## 从任务开始

| 我想做什么 | 阅读入口 |
| --- | --- |
| 了解产品和适用范围 | [Folio 是什么](/guide/introduction) |
| 在空项目中使用已发布 npm 0.1.1 | [快速开始](/guide/getting-started) → [首个可运行站点](/guide/first-site) |
| 编写和组织 Markdown | [编写内容](/guide/authoring) → [内容组织与排序](/guide/organizing-content) |
| 配置站点和组合 React | [站点配置](/guide/configuration) → [导航](/guide/navigation) → [React 组合](/guide/runtime-composition) |
| 构建、部署静态站点 | [静态发布](/guide/static-publishing) → [GitHub Pages](/reference/github-pages) |

## 版本与公共契约

已发布的包版本是 `@uichat-mira/folio@0.1.1`；当前 `dev` 源码包含部分尚未发布的功能，例如 PWA、Article 归档及扩展的 React 组件与 slots。按 dev 示例使用 npm 0.1.1 可能无法编译。

**版本能力的单一权威来源**：[`docs/consumer-contract.md`](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。参考页只保留与当前 API 直接相关的局部差异；`status: published` 表示文档内容已审校，**不等于 API 已进入 npm**。

## 内容与配置 API

| 主题 | 参考 |
| --- | --- |
| `FolioDoc`、Frontmatter、字段默认值与日期 | [Frontmatter 参考](/reference/frontmatter) |
| 站点配置、导航集合、运行时组合 | [配置指南](/guide/configuration) · [导航指南](/guide/navigation) |
| Article 单分类、多标签及 `collections[].archive`（dev） | [Article 分类与标签归档](/reference/article-archives) |
| React 组件、Props、slots 与阅读壳 | [React 组件 API](/reference/components) |

## 构建与发布 API

| 主题 | 参考 |
| --- | --- |
| `folio()`、`virtual:folio/content`、`staticRoutes` | [Vite 构建集成](/reference/build-integration) |
| 静态 HTML、canonical、JSON-LD、sitemap、robots、RSS/Atom | [静态构建与 SEO](/reference/seo) |
| `folioPwa()`、更新提示、Service Worker 缓存边界（dev） | [可选 PWA](/reference/pwa) |
| GitHub Pages 子路径及发布工作流 | [部署到 GitHub Pages](/reference/github-pages) |
| 下游平台参考 | [Cloudflare Pages 案例](/reference/cloudflare-pages) |

## 实例、维护与历史资料

下列内容**不是 Folio 公共 API**，应当作为实例或辅助资料阅读。

- [官方站作为公开 API 消费者的实例](/reference/site)
- [官方站内容维护约定](/reference/content-maintenance)
- [MiraDocs → Folio 历史迁移快照](/reference/migration-status)
- 旧站保留的第三方**非官方**设计研究：[Apple](/reference/examples/apple)、[Claude](/reference/examples/claude)、[Supabase](/reference/examples/supabase)、[产品设计系统](/reference/examples/product-design-system)
- 辅助工具：[Typora 图片上传 R2](/reference/typora-r2)
- [博客](/blogs) · [关于 Folio](/about)

这是一份**导航索引**，不是第二套 API 类型定义、版本矩阵或新增内容分类系统。
