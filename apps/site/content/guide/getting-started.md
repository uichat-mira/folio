---
title: 快速开始
description: 从 Folio 仓库开发到 package consumer 接入的最短路径。
group: 入门
collection: 指南
order: 10
type: doc
status: published
tags:
  - Folio
  - Vite
  - React
---

## 在 Folio 仓库中开发

Folio 仓库与 npm 包的 `engines.node` 声明为 `>=20`，但项目依赖的 Vite 7 要求 Node.js `20.19+` 或 `22.12+`。普通 CI 工作流使用 Node.js 22，npm 发布工作流使用 Node.js 24；本地开发选择满足 Vite 要求的版本即可。

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

当前公开版本是 `0.1.1`，可从 npm Registry 安装：

```bash
npm install @uichat-mira/folio
```

`0.1.1` 通过 GitHub Release 与 npm Trusted Publishing 发布，并通过真实 Registry 的独立消费者测试。`dev` 源码可能包含尚未发布的候选契约；接口与内容信任边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。

正式发布的 npm Registry 包包含 `virtual:folio/content` 类型声明，并通过 NodeNext/Bundler 严格类型及 Vite/静态构建验收。

React 入口（普通 consumer 不需要自行声明虚拟模块）：

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

如果某个 TypeScript 项目只导入 `virtual:folio/content`、完全不导入任一 Folio package entry，则需在 `compilerOptions.types` 中注册已安装的 `@uichat-mira/folio`。普通应用已经导入 `@uichat-mira/folio` 时不需要额外配置。

## 下一步

- [编写内容](/guide/authoring)：创建文档、文章、项目和自定义页面。
- [内容模型](/guide/content-model)：理解 `FolioDoc`、路径和类型推断。
- [站点配置与扩展](/guide/configuration)：配置导航、首页与 Vite plugin。
- [只用公开 API 组合站点](/guide/runtime-composition)：组合 React runtime。
- [静态发布](/guide/static-publishing)：生成静态 HTML、SEO 与部署产物。
