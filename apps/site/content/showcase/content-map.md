---
title: 内容组织图谱
description: 用一张可点击的地图说明 Folio 的四类内容、五条集合路径、文档层级和交叉阅读入口。
group: 展厅
order: 1
type: page
status: dev-sample
tags:
  - Information Architecture
  - Collections
  - Content Model
---

> 这是 `dev` 分支上的独立参考页，不进入手册分页，也不代表 `prod` 已经发布。它的作用是把站点里的内容关系画出来，方便维护者按路径点击验证。

Folio 站点不是把文章堆在一个列表里。当前官方站同时使用四种内容类型和五条集合路径，彼此通过正文链接、文档导航和集合索引连接。

## 四类内容

| 类型 | 当前数量级 | 在这个站里的职责 | 代表入口 |
| --- | --- | --- | --- |
| `doc` | 手册与操作示例 | 连续阅读、侧边导航、前后篇 | [Folio 是什么](/guide/introduction) |
| `article` | 设计与操作专题 | 日期排序、作者、标签、文章 TOC | [为什么内容要留在 Git](/blogs/content-stays-in-git) |
| `project` | 项目档案 | 目标、范围、现状、技术约束 | [官方站项目档案](/projects/official-site) |
| `page` | 独立参考页 | 不进入手册分页的专题入口 | 当前页面 |

类型不是装饰。`doc` 会进入文档壳，`article` 会按日期排序并出现页内目录，`project` 和 `page` 走普通内容页。把它们混成一种“文章卡”，维护者就观察不到差异。

## 五条集合路径

`folio.config.ts` 当前配置了五个集合索引。集合按**路由前缀递归收录**，不是按内容类型收录：

```text
/guide       指南（递归包含 /guide/*）
/reference   参考（递归包含 /reference/examples/* 等更深路径）
/blogs       文章与专题
/showcase    能力展厅（本页、操作示例文档）
/projects    项目档案
```

集合前缀、内容目录和 header 一级入口现在是一一对应的：`guide/` 目录下的文档落在 `/guide/*`，`reference/` 目录下的落在 `/reference/*`。因此 `/reference` 集合会包含 `/reference/examples/*` 等深层路径，而 `/guide` 只包含 `/guide/*`。集合入口由 Folio 生成，首页的集合卡片也来自同一份配置。

## 文档层级

文档壳内部还有另一套层级：`collection` → `section` → `order`。当前站点有三类文档集合：

```text
指南
├── 开始
├── 入门
├── 概念
└── 组合
参考
├── API
├── 部署
└── 迁移
能力展厅
└── 操作示例
    ├── 为示例站设计内容组织
    └── 启用集合索引与导航
```

打开任意一篇 `能力展厅` 文档，侧边栏只显示同一 `collection` 的文档，不会混入 `指南` 或 `参考`。这就是 `collection` 与路由集合索引的区别：前者管文档壳的侧边栏，后者管页面入口。两者落在同一个路由前缀上时，读者看到的才是一个自洽的分区，而不是“路由在一处、侧边栏在另一处”。

## 三条读者路径

1. **观察内容组织**：本页 → [为示例站设计内容组织](/showcase/guides/organize-content) → [启用集合索引与导航](/showcase/guides/collections-and-navigation) → `/showcase` 集合索引。
2. **阅读设计专题**：文章集合 → [为什么内容要留在 Git](/blogs/content-stays-in-git) → [同一份 Markdown 如何进入页面与静态输出](/blogs/one-markdown-many-surfaces) → 项目档案。
3. **理解运行时**：入门文档 → API 参考 → Frontmatter 参考 → 静态构建与 SEO。

## 不在这张图里的东西

当前没有标签聚合页，也没有搜索分面。标签会进入搜索文本，但不会自动生成 `/tags/*` 路由。Mermaid 图表在 React 中由客户端渲染，无 JavaScript 的静态 HTML 只保留源码文本。把这些未实现能力画进地图，会让地图看起来更完整，却不再可信。

继续阅读：[从一个内容文件到最终静态页面](/showcase/from-file-to-page)。
