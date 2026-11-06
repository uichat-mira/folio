---
title: FolioTreeNav
description: 用可复用 Core 内容树渲染项目父级、子文章和多层目录。
type: project
order: 20
status: draft
tags: [Navigation, Tree, API]
---

`FolioTreeNav` 与 `buildFolioContentTree()` 是当前本地分支新接通的正式公共能力。

## 使用方式

~~~tsx
import { buildFolioContentTree, FolioTreeNav } from "@uichat-mira/folio";

const tree = buildFolioContentTree(
  docs.filter((doc) => doc.type === "project"),
  { rootPath: "/reference" }, // 包含 /reference/components 父概览页
);

<FolioTreeNav tree={tree} currentPath={currentDoc.path} />;
~~~

## 当前已支持

- `index.md` 推导目录父页，子目录文章自动成为后代。
- 父概览存在时可点击；不存在时只显示不可点击目录，不制造 404 链接。
- 从同一 Core 树产生导航和项目内上一篇／下一篇；`order` 控制同级排序。
- 可嵌套多层，当前页高亮；可传 `className`、`ariaLabel`、`onNavigate`。
- `FolioApp` 的 `slots.projectNav` 可覆写 React 项目导航。

## 边界

树形布局默认只自动接在 `type: project`。它根据路由推导层级，显式 `path` 覆写会改变树上的位置。消费者直接使用 `FolioTreeNav` 时，需提供 React Router 和 `currentPath`；自定义静态导航仍要遵守构建层契约。

你现在阅读的就是它的**第三层子页面**。
