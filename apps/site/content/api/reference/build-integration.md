---
title: Vite 构建集成
path: /api/reference/build-integration
description: 使用 @uichat-mira/folio/vite 接管内容发现、热更新与静态输出。
group: Folio API · Reference
order: 51
type: doc
status: published
tags:
  - Vite
  - Build
---

Folio 的 Vite 入口：

```ts
import { folio } from "@uichat-mira/folio/vite";
```

## 基本接入

```ts
folio({
  contentDir: "content",
  config,
  exclude: (sourcePath) => /(^|\/)README\.md$/i.test(sourcePath),
  route: (_sourcePath, doc) => doc.path,
  staticRoutes: true,
});
```

## 内容发现链

```text
读取 Markdown
→ parseFolioDoc
→ exclude
→ route
→ normalize path
→ compareFolioDocs
```

随后生成：

```ts
import docs, { roots } from "virtual:folio/content";
```

正式发布的 `@uichat-mira/folio@0.1.0` 已包含虚拟模块的 TypeScript 声明（`FolioDoc[]`、`string[]`），并通过真实 Registry 独立消费者验收。只在 TS 工程中导入虚拟模块时，须在 `compilerOptions.types` 注册已安装的 `@uichat-mira/folio`；不需要自己写 `declare module`。

## staticRoutes

```ts
false                    // 不生成静态 route
true                     // 使用默认静态构建
FolioStaticBuildOptions  // consumer 自定义
```

plugin 在 Vite `writeBundle` 阶段读取最终 manifest，并写入 `build.outDir`。
