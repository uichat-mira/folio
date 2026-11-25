---
title: FolioEntryList 与 FolioListPage
description: 公开的条目列表与栏目页，支持站内文章、站外出版物、封面、元信息和主题响应。
type: doc
collection: 参考
section: API
group: API
order: 15
status: published
tags: [API, React, Components]
---

Folio 的列表不应该要求消费站把外部出版物伪装成一个本地 `FolioDoc`。框架提供独立于内容来源的**条目展示能力**，同时继续复用既有的集合页面。

## 公开 API

```tsx
import {
  FolioEntryList,
  FolioListPage,
  type FolioListEntry,
} from "@uichat-mira/folio";

const books: FolioListEntry[] = [{
  id: "agent",
  href: "https://tomz.io/books/agent/",
  title: "一起学智能体",
  description: "从真实产品与工程问题出发，持续理解 Agent、Tool Calling 与 MCP。",
  category: "AI / Agent",
  cover: "https://tomz.io/books/covers/agent.webp",
  meta: "13 篇 · 最近更新",
}];

<FolioListPage
  title="书架"
  eyebrow="BOOKS / 书架"
  description="仍然在生长的一些书。"
  variant="shelf"
  entries={books}
/>;
```

- `FolioEntryList`：只渲染条目，适合放入任意页面区块。
- `FolioListPage`：包含 `main`、H1、说明、条目列表，供**栏目**使用，不再以一整篇 Markdown 冒充目录。
- `variant="editorial"`：原先的文章列表（默认），沿用集合索引页既有样式。
- `variant="shelf"`：参考 [tomz.io 书架](https://tomz.io/books/) 的封面、分类、标题、摘要和元信息层级，是**纵向条目**而不是套卡片的网格；没有封面时自然变成项目/文章列表。
- `showNumbers={false}` 可省略编号；`emptyMessage` 提供空列表提示。
- `FolioDoc[]` 直接作为 `entries`，保留原来站内 React Router 导航、标签归档入口和日期排序。
- 外站资源使用 `FolioListEntry.href`（绝对 HTTP(S) URL），默认新标签页并带 `noopener noreferrer`；`target="_self"` 可选择原标签页。不创建伪造详情页。
- `cover` 是图像 URL，`coverAlt` 可明确替代文字；`meta` 是出版者提供的小字，不在组件里虚构发布日期/更新进度。
- CSS 已包含在唯一的 `@uichat-mira/folio/styles.css`。它使用 `--folio-*` 设计 Token，切换 Pearl、Editorial、暗色主题时自动适配，不要求消费者复制 CSS。

## 作为 FolioApp 内的栏目

```tsx
<FolioApp
  config={config}
  docs={docs}
  slots={{
    pages: [
      { path: "/books", element: <FolioListPage title="书架" entries={books} variant="shelf" /> },
    ],
  }}
/>
```

`slots.pages` 由 FolioApp 注册 React Router 页面并继承原生 Header/Footer、搜索与主题。与首页、文档和 Collection 的路由冲突会抛错。消费者仍拥有条目源头，可以将它连接至 Folio 订阅 Hook。

**静态发布边界**：`slots.pages` 是 React 运行时插槽。若启用静态站生成，消费者必须通过现有 `staticRoutes.routes` 为自定义栏目补充相同的静态正文与 canonical；Folio 目前尚不自动序列化任意 React 插槽。不要因此伪称无 JS 静态页已经自动支持自定义栏目。正常的 `config.collections` 列表仍由 Folio 自动生成静态索引。

该 API 目前仅存在于开发源码，**没有发布到 npm 0.1.1**。
