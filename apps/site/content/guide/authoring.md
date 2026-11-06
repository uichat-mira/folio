---
title: 编写内容
description: 使用 Folio 创建文档、文章、项目和自定义页面。
group: 入门
collection: 指南
order: 11
type: doc
status: published
tags:
  - Markdown
  - Frontmatter
---

Folio 的基本写作单位是带 YAML Frontmatter 的 Markdown 文件。

## 最小文档

```yaml
---
title: 编写内容
description: 使用 Folio 创建和维护内容。
group: Guide
order: 4
---

正文从这里开始。
```

## 常用字段

| 字段 | 作用 |
| --- | --- |
| `id` | 稳定内容标识 |
| `path` | 显式 route |
| `type` | doc / article / project / page / 自定义 |
| `title` | 页面、导航与 SEO 标题 |
| `description` | 摘要与 metadata |
| `group` | sidebar 与内容分组 |
| `order` | 组内排序，默认 99 |
| `collection` / `section` | consumer 级内容集合与章节 |
| `date` | 文章日期，用于文章倒序 |
| `tags` | 主题标签 |
| `status` | 内容状态 |
| `cover` | 封面或分享图 |

未被核心识别的字段会保留在 `data`，例如官方站自己的 `surface`。

不同 entry type 共享同一基础模型，展示方式由 consumer 决定。字段默认值、类型推断和日期来源见 [Frontmatter 参考](/reference/frontmatter)。
