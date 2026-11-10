---
title: 组件
description: Folio 当前公开 React 组件与相关 Core API 的使用手册。
type: doc
collection: 参考
section: API
group: API
order: 1
status: published
tags: [API, React, Components]
---

这里按**消费者实际会使用的组件**组织文档。本页内容已审校，`status: published` 表示文档成熟，而非所有列出的 API 已发布到 npm；具体版本边界参见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。每个公开组件只有一个一级页面，子功能、Props、核心数据契约和注意事项都写在组件页内，不另设多层文章来演示侧边栏。

所有公开组件从 `@uichat-mira/folio` 导入，样式统一来自 `@uichat-mira/folio/styles.css`。以下描述以当前开发源码已实现的能力为准。

## 组件索引

| 组件 | 功能与详细说明 |
| --- | --- |
| [FolioApp](/reference/components/app) | 应用入口、路由、UI 配置、`FolioSlots` 及导航插槽 |
| [FolioHeader](/reference/components/header) | 全局导航、菜单、搜索与主题按钮 |
| [FolioFooter](/reference/components/footer) | 结构化页脚、品牌、深浅色 Logo、链接分组和法律字段 |
| [FolioDocsShell](/reference/components/docs-shell) | 文档阅读布局、移动抽屉与组合式分页 |
| [FolioDocMeta](/reference/components/doc-meta) | 作者、日期和阅读时长的轻量署名栏；Git 更新信息不全量展开 |
| [FolioPageNav](/reference/components/page-nav) | 独立的上一篇／下一篇展示组件，排序由调用者提供 |
| [FolioTreeNav](/reference/components/tree-nav) | 统一左侧导航、Core 内容树、父级推导和排序 |
| [FolioToc](/reference/components/toc) | 当前文章的标题锚点与滚动高亮 |
| [FolioMarkdown](/reference/components/markdown) | Markdown 阅读与 Mermaid 浏览器增强 |
| [FolioUtilityPopover](/reference/components/utility-popover) | 可关闭的轻量信息浮层 |
| [FolioShareButton](/reference/components/share-button) | 浏览器分享与复制链接 |

## 公共组件与 Core 能力的关系

`FolioTreeNav` 负责渲染侧栏；`buildFolioNavigationTree()`、`buildFolioContentTree()` 和 `getFolioTreeNeighbors()` 则属于可独立使用的 Core 函数。这些契约集中写在 [FolioTreeNav](/reference/components/tree-nav) 中，不会伪装成另外几个 React 组件。

同样，`FolioFooterBrand`、`FolioFooterGroup`、`FolioFooterLegal` 是 Footer 的结构化配置类型，不需要各自独立占一个文档页面；`FolioSlots` 是 `FolioApp` 的扩展点。

## 使用边界

- 分类 `collection / section` 与内容父子路由由 Core 推导；组件目录保持平铺，并不影响 Folio 支持多级导航的能力。
- 左侧 `FolioTreeNav` 是站点内容导航，右侧 `FolioToc` 是页内标题目录；它们不是同一个组件。
- 层级文档共用文档阅读布局，`ui.footerOnDocs: false` 可隐藏这类阅读页面的站点 Footer 与正文 `articleFooter`；不影响首页和普通文章。
- 组件级样式文件不是独立的公开 CSS 入口。消费站需要的品牌物料、具体链接与法律信息仍由消费站提供。
- 此处索引当前 dev 公开导出；部分组件及 Props 尚未进入 npm 0.1.1。各组件页标出精确的可用版本，页面状态不能取代版本说明。

需要站点整体配置，请从 [Folio 配置指南](/guide/configuration) 开始。
