---
title: 内容协议
description: Markdown、YAML Frontmatter 与 FolioDoc 共同依赖的最小稳定契约。
group: 开始
collection: 指南
order: 2
type: doc
status: published
tags:
  - FolioDoc
  - Frontmatter
  - Markdown
---

每篇内容是一个带 YAML Frontmatter 的 Markdown 文件。Folio 把文件解析成 `FolioDoc`，React runtime、虚拟内容清单和静态构建都消费同一份数据。

```yaml
---
title: Agent Harness 设计
type: article
status: published
tags:
  - Agent
  - Harness
---
```

## 核心字段

`title`、`description`、`type`、`status`、`group`、`order`、`date`、`tags`、`cover`、`path` 和 `id` 是长期核心字段。`collection`、`section`、`publishedAt` 与 `updatedAt` 是当前 `dev` 源码中的候选扩展，尚未包含在已发布的 `0.1.1` 中。完整类型、默认值和日期规则见 [Frontmatter 参考](/reference/frontmatter)。

## 默认行为

- 未写 `type` 时，`blogs/*` 推断为 `article`，`projects/*` 推断为 `project`，其他为 `doc`。
- 未写 `path` 时，由 Markdown 文件路径生成；`index.md` 映射到目录路由。
- `order` 默认 `99`；文章之间按 `date` 倒序优先，再按 `order` 排序。
- `group` 默认按 entry type 生成；官方站用 group 组织 sidebar，用 order 稳定组内顺序。

## 扩展字段

未被核心识别的字段不会丢失，而是保存在 `doc.data`。例如官方站使用 `surface`、`contract` 和 `private_imports` 证明 consumer 可以增加自己的元数据，而无需扩展 Folio 核心类型。

扩展字段属于 consumer 契约。若某个字段影响渲染或构建，应同时在 consumer 代码和内容维护说明中写清用途与默认值。

## 相关文档

- [编写内容](/guide/authoring)
- [内容模型](/guide/content-model)
- [Frontmatter 参考](/reference/frontmatter)
- [导航与内容清单](/guide/navigation)
