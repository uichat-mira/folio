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

现在可从 npm Registry 安装 `0.1.0`：

```bash
npm install @uichat-mira/folio
```

`0.1.0` 已由维护者从生产提交手动发布，并通过真实 Registry 的独立消费者测试。接口与内容信任边界见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。

FOL-014 原始的虚拟模块 `TS2307` 已修复；正式发布的 npm Registry 包通过 NodeNext/Bundler 严格类型及 Vite/静态构建验收。

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
