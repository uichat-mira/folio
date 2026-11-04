---
title: 导航与内容清单
path: /api/guide/navigation
description: Folio 如何通过 virtual manifest、group 与 consumer 配置生成导航。
group: 指南 · 概念
order: 22
type: doc
status: published
tags:
  - Navigation
  - Virtual Module
---

Folio 不要求 React 组件自己扫描文件。内容发现统一由 Vite plugin 完成。

## virtual manifest

```ts
import docs, { roots } from "virtual:folio/content";
```

它导出：

- `docs`：排序后的 `FolioDoc[]`；
- `roots`：内容源中的顶层目录。

Markdown 变化时，virtual module 会失效并触发完整刷新。

## 两层导航

`FolioApp` 的顶部导航来自 `FolioConfig.navigation`。

默认 sidebar 根据 `docs[].group` 分组，再显示具体条目。因此 consumer 可以同时拥有稳定的产品级顶部入口，以及自动跟随内容变化的文档目录。

## 结构化下拉菜单

顶层条目除了 `label` / `href`，还可以带 `children` 与 `panel`。两者都可选：只写 `label` / `href` 的条目行为与之前完全一致。

```ts
navigation: [
  { label: "文章", href: "/blogs" },
  {
    label: "文档",
    href: "/docs/introduction",
    children: [
      { label: "内容协议", href: "/docs/content-contract", icon: "file", description: "Frontmatter 与目录即路由。" },
    ],
    panel: { eyebrow: "HANDBOOK", title: "从零到第一篇文档" },
  },
]
```

- 触发器的普通点击用于展开面板，因此 header 会自动补一条指向该条目自身 `href` 的入口（`panel.overviewLabel`，默认 `全部{label}`）；如果 `children` 里已经有同一路由，就不重复添加。
- `icon` 是普通字符串而非 React 组件：`types.ts` 属于 Core 层，不能引入 React。内置键为 `book`、`compass`、`layers`、`sparkles`、`code`、`file`、`archive`、`link`、`terminal`、`info`、`search`，其他值渲染为中性链接图标。
- 菜单结构完全由配置驱动，没有按路由硬编码的分支：任何路由都可以成为菜单。
- 桌面端支持悬停、点击与键盘展开；`Escape` 与点击面板外关闭，路由变化也会关闭。移动端使用独立的可展开手风琴，而不是把桌面面板压缩后塞进窄屏。
- 需要自己实现 header 的 consumer 可以复用导出的 `resolveFolioNavigation()` 与 `isFolioNavItemActive()`，保持同一套归一化与激活判断。

## 兼容旧 URL

需要保留历史 URL 时，用 Vite plugin 的 `route`：

```ts
folio({
  contentDir: "content",
  config,
  route: (_sourcePath, doc) =>
    doc.path.replace(/^\/legacy(?=\/|$)/, "") || "/",
});
```

URL 兼容属于 consumer 的迁移策略，不要求 Folio 核心知道某个旧站的目录结构。
