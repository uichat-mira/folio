---
title: Folio 是什么
description: Git-native 内容与门户发布引擎：用 Markdown 组织内容，用 Vite 与 React 发布文档、文章和项目站点。
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

Folio 是面向 Vite 与 React 的 **Git-native 内容与门户发布引擎**。它把仓库里的 Markdown 变成可长期维护的产品内容：统一的内容模型、稳定的导航与路由、完整的阅读体验，以及可以直接部署的静态站点。

内容继续留在 Git 里，品牌与交互继续由站点自己决定。Folio 负责的是「内容到页面」之间那段最容易重复建设、也最容易随站点增长失控的工程链路。

## 为什么用 Folio

- **内容只有一个事实源**：Markdown 与 YAML Frontmatter 留在 Git 中，审阅、版本和回滚沿用现有研发流程，不需要再把内容搬进另一个后台。
- **组织方式只定义一次**：`doc`、`article`、`project`、`page` 四类条目共享同一模型；路由、侧栏、标题目录、搜索与静态输出读取同一份 `FolioDoc`，不会各自漂移。
- **站点仍然属于自己**：Folio 提供薄 runtime 与可组合组件，品牌、页面结构和产品交互由 consumer 决定，不用接受一套固定主题。
- **发布能力开箱可用**：一次构建同时产出页面 HTML、canonical、Open Graph、JSON-LD、`404.html`、`sitemap.xml` 与 `robots.txt`。

## 适合谁

- 文档与帮助中心需要长期迭代，且希望内容走代码评审流程的产品团队。
- 官方站、项目门户和对外叙事放在同一个仓库，需要统一入口与导航的组织。
- 已经在使用 Vite 与 React，想增加内容区但不想引入托管 CMS 的站点。
- 希望内容能被自动化、构建脚本或 Agent 稳定消费，而不是依赖页面 DOM 的团队。

如果你需要的是在线协作编辑、非技术人员自助搭建任意页面，Folio 不是这类产品。

## 核心能力

| 能力 | 交付结果 |
| --- | --- |
| [内容建模](/guide/content-model) | Markdown + YAML Frontmatter 解析为统一 `FolioDoc`；类型、路径、排序、标签、日期与扩展字段有明确默认值。 |
| [导航与阅读](/guide/navigation) | 文档侧栏树、文章页内目录、上一篇／下一篇、署名与阅读时长；静态输出保留同一套导航与层级。 |
| [发布与分发](/guide/static-publishing) | 每条 route 生成静态 HTML 与 metadata；支持 sitemap、robots、404 与 GitHub Pages 子路径部署。 |
| [扩展与集成](/guide/configuration) | `FolioConfig`、`FolioSlots`、公开 Core 函数与 `virtual:folio/content` 提供稳定扩展点。 |

## 一条内容如何变成页面

```text
content/*.md
  → 构建层解析为 FolioDoc，补全路由与日期
  → virtual:folio/content 提供排序后的内容清单
  → React runtime 渲染文档、文章、项目或页面
  → 静态构建为每条 route 写出可部署 HTML
```

开发期修改 Markdown 会触发内容清单失效与页面刷新；构建期用同一份数据直接生成静态产物。runtime 与静态输出的导航、标题锚点和分页结果保持一致。

## 边界

Folio 不是托管 CMS，不重新封装 GitHub API，也不强迫 consumer 使用同一套主题。它负责**内容协议与构建契约**；品牌、页面组合、作者模型和产品交互仍由具体站点决定。

这个官方站就是边界证明：同一个 runtime，本体保持很薄，consumer 仍然可以做出完整产品面。

## 开始使用

```bash
npm install @uichat-mira/folio
```

```tsx
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";

<FolioApp config={config} docs={docs} />;
```

当前公开版本是 `0.1.1`，通过 GitHub Release 与 npm Trusted Publishing 发布。`dev` 分支可能包含尚未发布的候选契约；官方文档会单独标注，不把源码状态写成已发布行为。

## 下一步

- [快速开始](/guide/getting-started)：在仓库内运行官方站，或把 Folio 接入现有 consumer。
- [内容协议](/guide/content-contract)：理解 Markdown、Frontmatter 与 `FolioDoc` 的最小约定。
- [导航与内容清单](/guide/navigation)：组织侧栏、分组、排序与顶部入口。
- [参考索引](/reference/overview)：按任务查找字段、构建、部署与案例。

新增或修改官方文档前，先读 [官方站点内容维护约定](/reference/content-maintenance)。
