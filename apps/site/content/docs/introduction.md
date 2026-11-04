---
title: Folio 是什么
description: 一个由 Git 管理、可被 Skill 操作、能发布为公开站点的内容与静态构建运行时。
group: 开始
collection: 指南
order: 1
type: doc
status: published
tags:
  - Folio
  - Git-native
  - Vite
---

Folio 是一个面向 Vite 与 React 的 **Git-native 内容、发布与项目门户运行时**。

它把仓库中的结构化 Markdown 转换成统一内容模型、导航与路由数据，以及可部署的静态页面产物。内容仍由 Git 管理和审阅，站点仍可以保留自己的视觉与交互，自动化则通过稳定协议工作，而不是直接修改页面实现。

## 当前身份

Folio 的 canonical identity 已经统一为：

```text
repository     uichat-mira/folio
package        @uichat-mira/folio
vite module    virtual:folio/content
runtime        FolioApp
```

当前公开版本是 `0.1.1`，通过 GitHub Release 与 npm Trusted Publishing 发布。`dev` 分支可能已经包含尚未发布的候选契约；官方文档会单独标注这些能力，不把源码状态写成已发布行为。

消费者使用：

```bash
npm install @uichat-mira/folio
```

## 它负责什么

Folio 提供：

- Markdown 与 YAML Frontmatter 内容模型；
- `doc`、`article`、`project`、`page` 等统一条目；
- Vite 内容发现与 `virtual:folio/content`；
- 路由、导航根节点和标题目录提取；
- 可组合的 React runtime；
- 静态 HTML、canonical、Open Graph、Twitter 与 JSON-LD；
- `404.html`、`sitemap.xml` 与 `robots.txt`；
- GitHub Pages 项目路径和根路径部署支持；
- 可复用 Markdown renderer。

## 它不负责什么

Folio 不是托管 CMS，不重新封装 GitHub API，也不强迫消费者使用同一套主题。

它负责 **内容协议与构建契约**；品牌、页面组合、作者模型和产品交互仍然由具体站点决定。

这个官方站就是边界证明：同一个 runtime，本体保持很薄，consumer 仍然可以做出完整产品面。

## 推荐阅读路径

1. [内容协议](/docs/content-contract)：先理解 Markdown、Frontmatter 与 `FolioDoc` 的基本约定。
2. [快速开始](/api/guide/getting-started)：在仓库内运行官方站，或在 consumer 项目中安装 package。
3. [编写内容](/api/guide/authoring) 与 [内容模型](/api/guide/content-model)：创建页面、文章、项目和自定义 entry。
4. [站点配置与扩展](/api/guide/configuration) 与 [导航与内容清单](/api/guide/navigation)：配置导航、分组、排序和首页。
5. [只用公开 API 组合站点](/docs/runtime-composition)：理解 runtime 与 consumer 的表达边界。
6. [静态发布](/docs/static-publishing) 与 [静态构建与 SEO](/api/reference/seo)：生成 route HTML、metadata、sitemap 与 robots。
7. [部署到 GitHub Pages](/api/deployment/github-pages)：处理项目子路径与发布工作流。
8. [API 文档索引](/api/guide/what-is-folio)：按任务查找 API、参考、示例、部署与附录。

API Reference、Examples、Deployment、Appendix、博客和项目状态各有独立入口；它们不再重复入门说明。

## 参与维护

新增或修改官方文档前，先读 [官方站点内容维护约定](/docs/content-maintenance)。其中记录了页面类型、Frontmatter、内部链接、事实核对来源，以及 26 篇既有内容的逐篇审阅结论。
