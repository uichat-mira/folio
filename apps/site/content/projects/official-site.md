---
title: 官方站项目档案
description: 记录 apps/site 作为 Folio reference implementation 的目标、范围、当前实现、技术约束和未完成边界。
group: 项目
order: 2
type: project
status: active
tags:
  - Reference Site
  - GitHub Pages
  - Public API
---

这个项目档案描述的是仓库里的 `apps/site`，也就是你现在浏览的官方站。它不是一份营销页，而是对当前工程事实的存档：哪些能力已经在 `dev` 上实现，哪些还需要维护者观察后再决定。

## 目标

官方站承担两个职责：

1. 让维护者和读者能实际体验 Folio 的内容组织、导航、搜索和静态发布；
2. 持续证明公开 API 足以支撑一个真实站点，而不是只够跑一个 hello world。

因此它不追求“功能数量最多”，也不替下游站点决定品牌。它更像一份长期运行的可视化 fixture：一旦某种页面组合必须修改 `packages/folio` 才能完成，这里就应该成为暴露问题的第一批证据。

## 范围

本阶段明确包含：

- 使用真实 `FolioDoc` 驱动的首页入口与四类内容展示；
- `doc`、`article`、`project`、`page` 各自的阅读页面；
- 配置 `collections` 后的集合索引与递归收录；
- 带锚点的标题 TOC、代码块、表格、引用和站内交叉链接；
- React 运行时与无 JavaScript 静态 HTML 的核心导航一致性；
- GitHub Pages 项目子路径 `/folio/` 下的链接与资源检查。

本阶段不包含：

- 修改 Folio package 的公开 API 或静态引擎；
- 新增独立 Demo 仓库或第二个托管站；
- 标签聚合页、搜索分面、在线编辑器；
- 真实截图式的视觉验收结论；
- 合并、部署、发布或环境晋级。

## 当前实现

官方站只消费两个公开入口：运行时从 `@uichat-mira/folio` 导入，构建能力从 `@uichat-mira/folio/vite` 导入。内容通过 `virtual:folio/content` 进入。首页不再维护第二份文章列表，而是从 manifest 计算类型分组、集合样本和读者路径。

静态发布方面，`vite.config.ts` 负责生成 route body；同一份内容在 React 页面和静态 HTML 中都会经过基路径映射。集合索引通过 `folio.config.ts` 的 `collections` 配置启用，并同时出现在 React 路由和静态输出里。

## 技术约束

- 内容路径必须与配置的集合路由不冲突；
- 文档的 `collection` / `section` / `order` 决定侧边导航，不会自动把项目页纳入；
- 文章按 `date` 倒序，文档按 `order` 正序；
- 静态输出依赖真实文件写入，不能用“SPA 能看到”替代“HTML 已存在”；
- 站内链接必须尊重部署 base，不能写死生产前缀；
- 本页描述的首页、集合索引与静态输出来自当前 `dev` 源码；npm Registry 上公开的 `0.1.1` 是更早的发布版本，二者差异应以 Release 与提交历史为准。

## 关键决策

**保持站点层自定义，而不是把首页写进 runtime。** 官方站通过 `slots.home` 与自定义静态首页表达自己的产品叙事；Folio 继续只负责内容、路由和构建契约。

**优先新增独立示例内容，不覆盖既有 26 篇文档。** 与 FOL-036 / PR #145 并行的文档治理留给维护者集成，本卡只新增示例并在必要时做最小配置改动。

**把不支持的能力写出来。** 标签聚合、分面搜索和 Mermaid 无 JS 图形都不被描述为原生支持，而是明确记录边界。

## 已实现与未实现边界

已实现并可观察的：四类内容页面、集合索引、文档侧边导航、文章 TOC、搜索、静态 HTML、404、sitemap、robots、`/folio/` 基路径下的站内链接。

仍需维护者观察后决定的：首页信息密度是否合适、示例内容是否足够、窄屏阅读节奏是否舒服、哪些能力值得进入下一阶段。

## 相关阅读

- [内容组织图谱](/showcase/content-map)
- [从一个内容文件到最终静态页面](/showcase/from-file-to-page)
- [为什么内容要留在 Git](/blogs/content-stays-in-git)
- [发布到 GitHub Pages](/reference/github-pages)
