---
title: 关于 Folio
description: Folio 的定位、内容模型与使用边界。
type: page
group: Folio
status: published
tags:
  - Folio
  - Git-native
  - Publishing
---

Folio 是 Mira Organization 开发的 Git-native 内容与门户发布引擎。它把 Markdown 和 Frontmatter 作为内容来源，在构建过程中生成可导航、可搜索、可静态部署的网站。

这个网站本身就是 Folio 的使用实例：它使用公开的 `@uichat-mira/folio` API，而不是一套仅供官方站调用的特殊实现。

## 内容与页面

Folio 主要使用三种内容语义：

- **Doc**：指南、参考与可以连续阅读的层级文档。
- **Article**：适合按时间发布的文章；博客是文章的内容集合，不是另一种内容类型。
- **Page**：关于、介绍等不需要加入文档分页的独立页面。本页便是一个 `type: page` 的示例。

网站的导航、集合、页脚和首页组合负责安排读者入口，而不替内容制造新的类型。

## 为什么坚持 Git-native

内容以文件形式保存在仓库中。修改可以通过 Git 审查和追溯；部署由构建产物决定。页面路径、文档层级、作者及日期的显示规则都有明确的内容契约，同时允许必要的 Frontmatter 覆写。

Folio 的默认能力包含 React 阅读、静态 HTML 输出、基础导航与搜索。品牌、特殊首页和业务交互则由消费站点自行组合。

## 能力边界

Folio 不是拖拽式 CMS，也不负责后台账户、审批或业务数据服务。AI 驱动的内容编排是探索中的方向，不应被当成已经交付的默认能力。

## 从这里开始

- [快速开始](/guide/getting-started)：从 Markdown 内容到站点构建。
- [内容类型与路由](/guide/content-types)：了解 Doc、Article、Page 如何组织页面。
- [参考索引](/reference/overview)：查阅实际配置与公开接口。
- [博客](/blogs)：阅读设计与工程实践。
- [GitHub 源码](https://github.com/uichat-mira/folio)：查看仓库和开发进展。
