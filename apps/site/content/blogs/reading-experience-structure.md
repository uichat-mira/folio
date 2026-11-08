---
title: 分组、标签与日期如何影响阅读体验
description: group、collection、section、order、date 和 tags 都不是装饰字段；它们分别改变侧边导航、排序、搜索结果和详情页呈现。
group: 专题
date: 2026-11-04
author: Folio 示例内容 · AI Worker
type: article
status: dev-sample
tags:
  - Content Model
  - Navigation
  - Search
---

> 说明：本文由执行 Worker 生成于 `dev` 分支，目的是让维护者能观察到字段差异，而不是虚构一段真实运营历史。所有行为都可以用当前源码和构建结果复核。

Frontmatter 字段看起来很像一套标签系统，但 Folio 对它们的消费方式并不相同。把 `group`、`collection`、`section`、`order`、`date` 和 `tags` 混在一起理解，最终会得到“所有内容都长得一样”的站点。

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

当前官方站将文档组织为两个集合：**指南**与**参考**。打开任意一篇指南，侧边栏只会出现同为「指南」集合的文档，既不会混进参考类页面，也不会把项目页或文章塞进来。没写 `collection` 的文档会回落到字面量“文档”，因此全站只有一个扁平侧边栏——这是没做拆分时的默认行为，不是当前官方站的状态。

## order 与 date：两种不同的排序

`order` 是稳定的手工顺序，主要服务文档。`date` 则会让文章按时间倒序排列：最新发布的文章排在最前。两者不是同一种“权重”。

| 字段 | 主要消费方 | 排序行为 |
| --- | --- | --- |
| `order` | 文档、页面 | 数字越小越靠前 |
| `date` | 文章 | 字符串倒序，最新在前 |
| `updatedAt` | 静态 sitemap / JSON-LD | 仅作为可信修改时间 |
| `publishedAt` | JSON-LD | 必须有可信来源 |

Folio 还区分“前台显示的 legacy date”和“可信发布时间”。如果一篇文章只有 Git 首次提交时间，静态输出不会把它当成原始发布日期；这个保守策略是为了避免迁移后伪造历史。

## tags：能搜到，但不是一个聚合页

`tags` 会进入搜索文本，也会出现在首页统计里。但当前运行时**没有**标签聚合路由，也没有搜索分面。标签的价值是提高子串搜索的命中率，而不是自动生成 `/tags/git` 这样的页面。

如果站点需要标签页，consumer 得自己从 manifest 派生路由；Folio 不会凭空提供一个假交互。

## 标题结构与阅读节奏

文章详情页的页内目录只读取二到四级标题，并跳过代码块里的 `#`。这意味着正文的 H2/H3 不只是排版，它们直接决定读者能不能快速扫读。我们的新文章都刻意使用了稳定的二级标题，再在需要时下沉三级标题。

一个实用的检查顺序是：

1. 先看侧边导航是否只包含同集合文档；
2. 再看文章页是否出现页内目录；
3. 用 `Ctrl/Cmd + K` 搜索 `Frontmatter`、`静态构建` 或某个标签；
4. 最后检查窄屏下目录是否折叠而不是横向溢出。

想观察这些字段的真实差别，可以阅读 [内容组织与排序](/guide/organizing-content)，再对照 [站点配置](/guide/configuration) 中的集合和导航说明。
