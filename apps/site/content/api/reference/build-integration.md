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

当前源码候选的 tarball 已包含 TypeScript 虚拟模块声明，类型分别为 `FolioDoc[]` 与 `string[]`，不需要消费者自行写 `declare module`。但仅使用虚拟模块、没有在同一 TS 工程中导入 Folio 公开入口时，须在 `compilerOptions.types` 中显式注册 `@uichat-mira/folio`；最终 Registry 发布仍待复验，详见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。

## staticRoutes

```ts
false                    // 不生成静态 route
true                     // 使用默认静态构建
FolioStaticBuildOptions  // consumer 自定义
```

plugin 在 Vite `writeBundle` 阶段读取最终 manifest，并写入 `build.outDir`。
