---
title: 编写内容
path: /api/guide/authoring
description: 使用 Folio 创建文档、文章、项目和自定义页面。
group: Folio API · 快速开始
order: 12
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
| `group` | 内容分组 |
| `order` | 排序 |
| `date` | 文章日期 |
| `tags` | 标签 |
| `status` | 状态 |
| `cover` | 封面或分享图 |

未被核心识别的字段会保留在 `data`，例如 `author`。

不同 entry type 共享同一基础模型，展示方式由 consumer 决定。
