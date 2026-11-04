---
title: Frontmatter 参考
path: /api/reference/frontmatter
description: Folio 标准字段、默认值、YAML 解析、日期来源与 consumer 扩展规则。
group: 参考 · API
order: 41
type: doc
status: published
tags:
  - Frontmatter
  - Schema
---

Folio 优先使用标准 YAML 解析 Frontmatter。新文档应始终写合法 YAML；解析失败时会退回到宽松的键值读取，但那只是容错，不是推荐的编写方式。

## 完整示例

```yaml
---
id: folio-static-build
path: /api/static-build
type: doc
title: 静态构建
description: 为每条公开 route 生成静态 HTML。
group: Guide
order: 8
date: 2026-10-03
tags:
  - Folio
  - Vite
status: published
cover: /images/folio.png
author:
  - Mira
---
```

## 核心字段与默认值

| 字段 | 作用 | 默认/规则 |
| --- | --- | --- |
| `id` | 稳定内容标识 | 由 `path` 生成 |
| `path` | 显式 route | 由 Markdown 文件路径生成 |
| `type` | doc / article / project / page / 自定义字符串 | 按目录推断：`blogs/*` → article，`projects/*` → project，其他 → doc |
| `title` | 页面、导航与 SEO 标题 | route path |
| `description` | 摘要与 metadata | 空字符串 |
| `group` | sidebar 分组 | 按 entry type 生成 |
| `order` | 组内排序数字 | `99` |
| `collection` / `section` | consumer 级集合与章节 | 未设置 |
| `date` | 文章日期 | 未设置；文章间按日期倒序 |
| `tags` | 标签数组或 `|` / `,` 分隔字符串 | 空数组 |
| `status` | 内容或项目状态 | 未设置 |
| `cover` | 封面或分享图 | 未设置 |

`collection`、`section` 与下文的日期字段属于当前 `dev` 源码中的候选契约，尚未包含在已发布的 `0.1.1` 中。

## 日期字段

`publishedAt`、`updatedAt` 与 `dateSources` 是 `dev` 源码中的候选契约，尚未包含在已发布的 `0.1.1` 中：

- 显式 `publishedAt` / `updatedAt` 优先；
- 旧 `date` 字段可作为 `publishedAt`；
- 否则可由本地 Git 历史补齐，并记录来源；
- 无法可信推断时保持未定义，不生成伪造日期。

完整优先级与 sitemap `lastmod` 规则见 [静态构建与 SEO](/api/reference/seo)。

## Consumer 扩展

未被核心识别的字段仍保存在 `doc.data`。官方 reference site 自己就使用了 `surface`、`contract`、`private_imports` 等扩展字段。

`author` 也是通过 `doc.data` 交给 consumer 的字段；默认静态 JSON-LD 在 `dev` 源码中读取它，并优先于 `FolioConfig.author`。未发布版本的生成行为仍以已安装包的消费者契约为准。

## 相关文档

- [内容协议](/docs/content-contract)
- [编写内容](/api/guide/authoring)
- [内容模型](/api/guide/content-model)
