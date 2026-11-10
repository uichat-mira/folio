---
title: 内容模型
description: Folio 如何把 Markdown、Frontmatter 和路径解析成统一的 FolioDoc，以及 Article 归档索引的数据来源。
group: 概念
collection: 指南
order: 20
type: doc
status: published
tags:
  - FolioDoc
  - Content
---

Folio 把每个 Markdown 文件解析成一个 `FolioDoc`。React runtime、虚拟内容清单与静态构建消费同一份数据，不维护第二套内容索引。

```ts
type FolioDoc = {
  id: string
  path: string
  sourcePath: string
  type: "doc" | "article" | "page" | string
  title: string
  description: string
  group: string
  collection?: string
  section?: string
  order: number
  date?: string
  publishedAt?: string        // dev
  createdAt?: string          // dev
  updatedAt?: string          // dev
  createdBy?: string          // dev
  updatedBy?: string          // dev
  dateSources?: FolioDateSources // dev
  gitHistory?: FolioGitHistory   // dev
  category?: string           // dev
  tags: string[]
  status?: string
  cover?: string
  body: string
  headings: FolioHeading[]
  data: Record<string, unknown>
}
```

当前形态以 `packages/folio/src/types.ts` 为准。已发布的 `0.1.1` 包含 `id` 到 `date`、`tags`、`status`、`cover`、`body`、`headings` 与 `data`；`publishedAt`、`createdAt`、`updatedAt`、`createdBy`、`updatedBy`、`dateSources`、`gitHistory` 和 `category` 是 `dev` 源码中的候选字段，尚未发布。发布历史见[迁移状态](/reference/migration-status)。

## 解析流程

1. 按 YAML 解析 Frontmatter；YAML 解析失败时退回宽松的键值读取，那只是容错，不是推荐写法。
2. 逐字段取默认值，再生成路由与标题。

核心的解析规则：

- `path`：显式 `path` 优先，否则由文件路径生成；`index.md` 映射到目录本身。`id` 由 `path` 派生。
- `type`：显式值优先，否则按内容根目录推断（见下）。
- `title`：缺省为 `path`；`description`：缺省为空字符串。
- `group`：缺省时文章为「博客」，其余为「文档」。
- `order`：`Number(order ?? 99)`。
- `category`：只接受非空字符串；数组、对象、数字、布尔值等都按「未设置」处理，不会被字符串化成一个猜测的分类。
- `tags`：数组会逐项转字符串并去掉空项；单个字符串按 `|`、`,` 或 `，` 分割，便于兼容旧写法。
- 其他字段：保留在 `data`，不丢失。

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
其他        → doc
```

显式 `type` 优先。`project` 只是旧数据的兼容值，不再映射到专用阅读布局。

## 日期与来源

`date` 是原样保留的 legacy 字段，参与文章倒序排序。`publishedAt` / `updatedAt` 是更明确的时间契约，只在 `dev` 中可用：

- `publishedAt`：显式 `publishedAt` > 旧 `date` 字段 > 完整 Git 历史中的首次提交 > 未知。
- `updatedAt`：显式 `updatedAt` > 最近一次 Git 提交 > 未知。
- `createdAt`：显式 `createdAt` > Git 首次提交；`createdBy` / `updatedBy` 同理，显式值优先，否则取对应提交的作者。
- `dateSources` 记录实际采用的来源：`frontmatter`、`legacy-date`、`git-first-commit`、`git-last-commit` 或 `unknown`。
- 显式日期只接受 `YYYY-MM-DD` 或带 `Z`/时区偏移的 ISO 8601；没有时区的时间会被忽略，避免依赖构建机时区。
- 浅克隆或历史不可读时，首次提交不可信：`publishedAt` 保持未定义，`dateSources.historyComplete` 为 `false`；未追踪文件也不伪造构建时间。

文章排序不读取 `publishedAt`；排序字段仍是 `date`。

## headings

Folio 同时提取 Markdown 与原始 HTML 中的 h2–h4，并生成稳定、去重的锚点。代码块里的 `#` 不参与；显式 `id` 的 HTML 标题保留原值。

## Article 归档索引

分类与标签归档的数据来自同一个 `FolioDoc[]`：

- `buildFolioArticleArchiveIndex(docs, config)` 只筛选 `type: "article"` 的条目，文档、页面与其他类型不参与。
- `category` 是单值，按归一化后的身份分组；重复写法的 `tags` 在单篇文章内去重。
- 输出 `categories`、`tags`、`uncategorized` 与 `untagged`；空分类/空标签不会生成空分组。
- 组内文章沿用现有文章顺序（`date` 倒序、缺失日期在后、再按 `order`），并以 `path` 做稳定兜底。
- 返回的是原始 `FolioDoc` 对象，不重新解析、不写入磁盘，也不维护第二份索引。
- 不同身份折叠到同一 URL slug，或身份没有可用的 slug 时直接报错，而不是静默共用归档。

这套索引是当前 `dev` 源码（FOL-040）的数据契约；归档路由的渲染由 React/静态输出层决定。已发布的 `0.1.1` 不包含该导出。

## 相关文档

- [编写内容](/guide/authoring)
- [内容类型与路由](/guide/content-types)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容组织与排序](/guide/organizing-content)
- [Frontmatter 参考](/reference/frontmatter)
