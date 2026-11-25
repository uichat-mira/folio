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

## 适用场景

这一页面向第一次评估 Folio 的开发者，只解释产品定位与边界，不安装、不写代码。动手前需要 Node.js `20.19+` 或 `22.12+`（Vite 7 的运行要求），以及 Vite 7 与 React 19；具体路径从[快速开始](/guide/getting-started)进入。

Folio 通常适合这些情况：

- 文档与帮助中心需要长期迭代，且希望内容走代码评审流程的产品团队。
- 官方站、项目门户和对外叙事放在同一个仓库，需要统一入口与导航的组织。
- 已经在使用 Vite 与 React，想增加内容区但不想引入托管 CMS 的站点。
- 希望内容能被自动化、构建脚本或 Agent 稳定消费，而不是依赖页面 DOM 的团队。

如果你需要的是在线协作编辑、非技术人员自助搭建任意页面，Folio 不是这类产品。

## 为什么用 Folio

- **内容只有一个事实源**：Markdown 与 YAML Frontmatter 留在 Git 中，审阅、版本和回滚沿用现有研发流程，不需要再把内容搬进另一个后台。
- **组织方式只定义一次**：`doc`、`article`、`page` 三类常用条目共享同一模型；路由、侧栏、标题目录、搜索与静态输出读取同一份 `FolioDoc`，不会各自漂移。
- **站点仍然属于自己**：Folio 提供薄 runtime 与可组合组件，品牌、页面结构和产品交互由 consumer 决定，不用接受一套固定主题。
- **发布能力开箱可用**：一次构建同时产出页面 HTML、Open Graph、JSON-LD 与 `404.html`；配置 `siteUrl` 后补齐 canonical、`sitemap.xml` 与 `robots.txt`。

## 核心能力

| 能力 | 交付结果 |
| --- | --- |
| [内容建模](/guide/content-model) | Markdown + YAML Frontmatter 解析为统一 `FolioDoc`；类型、路径、排序、标签、日期与扩展字段有明确默认值。 |
| [导航与阅读](/guide/navigation) | 文档侧栏树、文章页内目录与上一篇／下一篇；静态输出保留同一套导航与层级。 |
| [发布与分发](/guide/static-publishing) | 每条 route 生成静态 HTML 与 metadata；支持 sitemap、robots、404 与 GitHub Pages 子路径部署。 |
| [扩展与集成](/guide/configuration) | `FolioConfig`、`FolioSlots`、公开 Core 函数与 `virtual:folio/content` 提供稳定扩展点。 |

## 一条内容如何变成页面

```text
content/*.md
  → 构建层解析为 FolioDoc，补全路由与默认值
  → virtual:folio/content 提供排序后的内容清单
  → React runtime 渲染文档、文章或页面
  → 静态构建为每条 route 写出可部署 HTML
```

开发期修改 Markdown 会触发内容清单失效与页面刷新；构建期用同一份数据直接生成静态产物。runtime 与静态输出的导航、标题锚点和分页结果保持一致。

## 两条使用路径

Folio 有两条入口，依赖版本与可用 API 不同，开始前先选定一条：

- **消费已发布的 npm 包**：在现有或新建的 Vite + React 项目里安装 `@uichat-mira/folio@0.1.1`。这是公开、可复现的 consumer 路径，能力边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。
- **开发 Folio 源码**：克隆仓库、检出 `dev`，用 npm workspaces 运行官方站与 package。`dev` 包含尚未发布的候选契约，不能当作 `0.1.1` 的已发布行为。

两条路径的具体命令见[快速开始](/guide/getting-started)；只消费 `0.1.1` 的完整建站步骤见[首个可运行站点](/guide/first-site)。不要把 `dev` 文档中的候选字段或配置直接复制到 `0.1.1` 项目里。

## 边界

Folio 不是托管 CMS，不重新封装 GitHub API，也不强迫 consumer 使用同一套主题。它负责**内容协议与构建契约**；品牌、页面组合、作者模型和产品交互仍由具体站点决定。

Markdown 渲染只面向站点所有者审核过的受信任内容，不提供 HTML 消毒；这条边界由[内容协议](/guide/content-contract)与消费者契约共同定义。

这个官方站就是边界证明：同一个 runtime，本体保持很薄，consumer 仍然可以做出完整产品面。

## 下一步

- [快速开始](/guide/getting-started)：选择消费已发布包或在仓库内开发源码。
- [首个可运行站点](/guide/first-site)：用 `0.1.1` 从空项目走到可访问页面与静态 HTML。
- [内容协议](/guide/content-contract)：理解 Markdown、Frontmatter 与 `FolioDoc` 的最小约定。
- [编写内容](/guide/authoring)：创建文档、文章与自定义页面。
- [站点配置与扩展](/guide/configuration)：配置导航、首页与 Vite plugin。
- [静态发布](/guide/static-publishing)：生成静态 HTML、SEO 与部署产物。
- [参考索引](/reference/overview)：按任务查找字段、构建、部署与案例。
