---
title: 内容模型
path: /api/guide/content-model
description: Folio 如何把 Markdown、Frontmatter 和路径转换成统一的 FolioDoc。
group: Folio API · 核心概念
order: 20
type: doc
status: published
tags:
  - FolioDoc
  - Content
---

Folio 把每个 Markdown 文件解析成一个 `FolioDoc`。

```ts
type FolioDoc = {
  id: string
  path: string
  sourcePath: string
  type: "doc" | "article" | "project" | "page" | string
  title: string
  description: string
  group: string
  order: number
  date?: string
  tags: string[]
  status?: string
  cover?: string
  body: string
  headings: FolioHeading[]
  data: Record<string, unknown>
}
```

## data 是扩展边界

核心认识的稳定字段会进入顶层属性。

核心不认识的 Frontmatter 字段不会丢失，而是保留在 `data` 中。因此 consumer 可以增加作者、业务状态、外部 ID、展示模式等字段，不需要扩展 Folio 核心类型。

## 文件到 route

```text
guide/content-model.md → /guide/content-model
guide/index.md         → /guide
```

Frontmatter 的 `path` 可以覆盖 URL；Vite plugin 的 `route(sourcePath, doc)` 还能做 consumer 级兼容映射。

## 类型推断

未声明 `type` 时：

```text
blogs/*    → article
projects/* → project
其他        → doc
```

## headings

Folio 同时提取 Markdown 与原始 HTML 中的 h2–h4，并生成稳定、去重的锚点。
