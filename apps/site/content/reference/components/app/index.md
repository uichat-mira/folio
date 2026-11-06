---
title: FolioApp
description: Folio 的公开 React 应用入口，组合路由、Header、内容阅读器与 Footer。
type: project
order: 10
status: draft
tags: [React, Runtime, API]
---

`FolioApp` 是官方公开的 React 应用外壳，不要求消费者复制内置路由组件。

## 公开入口

~~~tsx
import { FolioApp, type FolioAppProps } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";

<FolioApp config={config} docs={docs} />;
~~~

## 当前提供什么

- 按 `docs` 建立内容路由，首页通过内置配置或 `slots.home` 组合。
- 提供 Header、搜索与主题操作、基础内容页面和 Footer。
- 对 `type: doc` 采用 `FolioDocsShell` + `FolioDocNav`。
- 对 `type: project` 采用同一阅读布局 + 目录推导的 `FolioTreeNav`。
- 提供 `slots.docNav`、`slots.docToc`、`slots.projectNav`、`slots.footer` 等覆写入口。
- `ui.footerOnDocs: false` 可以让技术文档页不渲染 Footer，默认值为 `true` 以兼容既有消费者。

## 能力边界

`FolioApp` 不包含 AI 写作后台、Git 提交审核和发布调度。那些不是当前已交付的 React 组件。静态 HTML 由构建层负责，运行时 slot 不自动改变静态输出。
