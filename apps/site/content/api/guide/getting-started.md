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

Folio 仓库与 npm 包的 `engines.node` 声明为 `>=20`，但项目依赖的 Vite 7 要求 Node.js `20.19+` 或 `22.12+`。CI 使用 Node.js 24，建议开发与首发验收也使用 Node.js 24。

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

FOL-014 原始独立 tarball 曾因虚拟模块缺少类型声明出现 `TS2307`。当前源码候选已将声明随包提供，并在独立 tarball 消费者中要求无本地 workaround 的严格类型检查。最终 Registry 版本还需验收，详见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。

React 入口（不再需要消费者自行声明虚拟模块）：

```tsx
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";

<FolioApp config={config} docs={docs} />
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
