---
title: 快速开始
path: /api/guide/getting-started
description: 从 Folio 仓库开发到 package consumer 接入的最短路径。
group: Folio API · 快速开始
order: 11
type: doc
status: published
tags:
  - Folio
  - Vite
  - React
---

## 在 Folio 仓库中开发

当前仓库要求 Node.js 22。

```bash
npm ci --no-audit --no-fund
npm run release:check
```

启动官方 reference site：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

## 在 consumer 项目中接入

package 发布后，consumer 使用：

```bash
npm install @uichat-mira/folio
```

`npm install` 只适用于首次 Registry 发布之后；当前 Registry 仍返回 404，完整状态见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。该契约同时说明可信 Markdown 边界与默认样式用法。

React 入口：

```tsx
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";

<FolioApp config={config} docs={docs as FolioDoc[]} />
```

Vite 入口：

```ts
import { folio } from "@uichat-mira/folio/vite";

folio({
  contentDir: "content",
  config,
  staticRoutes: true,
});
```

## 最小目录

```text
content/
└── docs/
    └── introduction.md
```

新增、删除或修改 Markdown 后，Folio 会让 virtual manifest 失效并触发开发服务器刷新。
