---
title: Folio 是什么
path: /api/guide/what-is-folio
description: Folio 的产品定位、运行边界、公共包与生产状态。
group: Folio API · 快速开始
order: 10
type: doc
status: published
tags:
  - Folio
  - API
  - Runtime
---

Folio 是一个面向 Vite 与 React 的 **Git-native 内容、发布与项目门户运行时**。

它把仓库里的 Markdown 与 Frontmatter 解析成统一内容模型，再把同一份内容投影成 React runtime、虚拟内容清单和静态发布产物。

## Canonical identity

```text
repository     uichat-mira/folio
package        @uichat-mira/folio
vite module    virtual:folio/content
runtime        FolioApp
plugin         folio()
```

源码中的 Folio package line 从 `0.1.0` 开始。npm registry 发布由独立 GitHub Release 流程完成；源码准备完成与 registry 已发布是两件不同的事。

## Folio 负责什么

- Markdown + YAML Frontmatter 内容协议；
- `FolioDoc` 统一模型；
- `doc`、`article`、`project`、`page` 等 entry type；
- Vite 内容发现与 `virtual:folio/content`；
- 内容排序、route 映射、heading 提取与 HMR；
- 可直接使用的 `FolioApp` React runtime；
- 可由 consumer 组合的 slots；
- 静态 HTML、canonical、Open Graph、Twitter Card 与 JSON-LD；
- `404.html`、`sitemap.xml`、`robots.txt`；
- GitHub Pages 项目路径与根路径支持。

## Folio 不负责什么

Folio 不是托管 CMS，不重新封装 GitHub API，也不要求所有消费者使用同一套视觉。

运行时拥有内容与构建契约；consumer 拥有品牌、页面组合、业务字段和交互。

这个官方站本身就是 reference implementation：它只消费公开 package entrypoints，不访问 `packages/folio/src/*`。
