---
title: 导航与内容清单
path: /api/guide/navigation
description: Folio 如何通过 virtual manifest、group 与 consumer 配置生成导航。
group: Folio API · 核心概念
order: 21
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
