---
title: 分组、标签与日期如何影响阅读体验
description: group、collection、section、order、date、category 和 tags 都不是装饰字段；它们分别改变侧边导航、排序、搜索结果、归档入口和详情页呈现。
group: 专题
date: 2026-11-04
author: Folio 示例内容 · AI Worker
type: article
category: 内容模型
status: dev-sample
tags:
  - Content Model
  - Navigation
  - Search
---

> 说明：本文由执行 Worker 生成于 `dev` 分支，目的是让维护者能观察到字段差异，而不是虚构一段真实运营历史。所有行为都可以用当前源码和构建结果复核。

Frontmatter 字段看起来很像一套标签系统，但 Folio 对它们的消费方式并不相同。把 `group`、`collection`、`section`、`order`、`date`、`category` 和 `tags` 混在一起理解，最终会得到“所有内容都长得一样”的站点。

## group：内容头顶的那一行

`group` 是最直接的展示字段。它出现在文档工具条的 eyebrow、首页卡片和搜索结果摘要里。对于没有显式 `collection` 的文档，Folio 还会把 `group` 当作默认的侧边导航 section 标题。

```yaml
group: 专题
```

它适合表达“这页属于哪一类读者语境”，不适合承担排序职责。两篇 `group` 相同的文章仍然可以出现在完全不同的导航位置。

## collection 与 section：文档壳的骨架

只有 `type: doc` 的条目会进入文档结构。`collection` 决定侧边导航最外层显示什么，`section` 决定里面的分组，`order` 决定组内顺序。

```yaml
type: doc
collection: 参考
section: API
order: 10
```

当前官方站将文档组织为两个集合：**指南**与**参考**。打开任意一篇指南，侧边栏只会出现同为「指南」集合的文档，既不会混进参考类页面，也不会把文章塞进来。没写 `collection` 的文档会回落到字面量“文档”，因此全站只有一个扁平侧边栏——这是没做拆分时的默认行为，不是当前官方站的状态。

## order 与 date：两种不同的排序

`order` 是稳定的手工顺序，主要服务文档。`date` 则会让文章按时间倒序排列：最新发布的文章排在最前。两者不是同一种“权重”。

| 字段 | 主要消费方 | 排序行为 |
| --- | --- | --- |
| `order` | 文档、页面 | 数字越小越靠前 |
| `date` | 文章 | 字符串倒序，最新在前 |
| `updatedAt` | 静态 sitemap / JSON-LD | 仅作为可信修改时间 |
| `publishedAt` | JSON-LD / 署名 | 必须有可信来源 |
| `category` | 文章归档页（dev） | 单值归档身份，不参与排序 |
| `tags` | 搜索与文章归档页（dev） | 多值标签，不参与排序 |

Folio 还区分“前台显示的 legacy date”和“可信发布时间”。如果一篇文章只有 Git 首次提交时间，静态输出不会把它当成原始发布日期；这个保守策略是为了避免迁移后伪造历史。

## category 与 tags：从搜索文本到归档页

`category` 是 Article 的可选单分类，`tags` 是零到多个主题标签。两者都只对 `type: article` 生效，都不改变文章 URL、`collection`、`group`、`section`，也不进入文档侧栏。`category` 只是一个归档维度，不是栏目、导航节点或路由树。

```yaml
---
type: article
category: 工程实践
tags:
  - Git
  - Content
---
```

官方站的 `/blogs` 集合显式开启了归档（`archive: true`），所以有两种读者入口：

- 集合索引页顶部的「分类」行 → `/blogs/category/<slug>`；
- 文章卡片与文章元信息区的标签 → `/blogs/tag/<slug>`。

归档身份来自 Frontmatter 值：NFC、去首尾空白、合并空白，并忽略 ASCII 大小写，因此 `Frontend` 与 `frontend` 是同一个归档，中文标签原样保留。slug 复用同一套 `slugify`：中文保留、ASCII 小写、标点剥离；非 ASCII 段在请求 URL 中会被百分号编码。两个不同标签折叠到同一 slug（例如 `C++` / `C#`）会让构建失败，而不是共用一个归档；未知 slug 进入正常的 404。归档 URL 也会写进 sitemap。

`tags` 仍然进入搜索文本，所以 `Ctrl/Cmd + K` 可以按标签搜索；但标签的价值已经不只是提高子串命中率。集合索引页的分类行与文章标签链接来自同一个 `buildFolioArticleArchiveIndex()`，它不是搜索分面，也不需要 consumer 再手写一套标签页。

这些能力在 `dev` 中（FOL-040 / FOL-041），并已在官方站启用，尚未包含在已发布的 `0.1.1` 中。只用 `0.1.1` 的站点没有归档路由；consumer 可以从内容清单自行派生，或升级到包含该能力的版本。

## 标题结构与阅读节奏

文章详情页的页内目录只读取二到四级标题，并跳过代码块里的 `#`。这意味着正文的 H2/H3 不只是排版，它们直接决定读者能不能快速扫读。我们的新文章都刻意使用了稳定的二级标题，再在需要时下沉三级标题。

一个实用的检查顺序是：

1. 先看侧边导航是否只包含同集合文档；
2. 再看文章页是否出现页内目录；
3. 用 `Ctrl/Cmd + K` 搜索 `Frontmatter`、`静态构建` 或某个标签；
4. 最后检查窄屏下目录是否折叠而不是横向溢出。

想观察这些字段的真实差别，可以阅读 [内容组织与排序](/guide/organizing-content)，再对照 [站点配置](/guide/configuration) 中的集合和导航说明。
