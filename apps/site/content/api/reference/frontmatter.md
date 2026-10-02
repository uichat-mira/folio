---
title: Frontmatter 参考
path: /api/reference/frontmatter
description: Folio 标准字段、YAML 解析与 consumer 扩展规则。
group: Folio API · Reference
order: 50
type: doc
status: published
tags:
  - Frontmatter
  - Schema
---

Folio 优先使用标准 YAML 解析 Frontmatter。新文档应始终写合法 YAML。

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
status: stable
cover: /images/folio.png
author:
  - Mira
---
```

## 核心字段

- `id`：稳定内容标识；
- `path`：页面路径；
- `type`：doc / article / project / page，也允许自定义字符串；
- `title`：页面与 metadata 标题；
- `description`：摘要；
- `group`：内容分组；
- `order`：排序数字，默认 99；
- `date`：文章日期；
- `tags`：标签；
- `status`：内容或项目状态；
- `cover`：封面或分享图。

## Consumer 扩展

未被核心识别的字段仍保存在 `doc.data`。

官方 reference site 自己就使用了 `surface`、`contract`、`private_imports` 等扩展字段。
