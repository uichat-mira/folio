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

当前该虚拟模块在 Vite 运行时可以解析，但 npm tarball 尚未附带可自动发现的 TypeScript 模块声明；独立 TS 消费者需暂时声明该模块（包括 `default` 和 `roots`），见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。首发前需在包侧修复并复验。

## staticRoutes

```ts
false                    // 不生成静态 route
true                     // 使用默认静态构建
FolioStaticBuildOptions  // consumer 自定义
```

plugin 在 Vite `writeBundle` 阶段读取最终 manifest，并写入 `build.outDir`。
