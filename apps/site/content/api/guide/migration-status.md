---
title: MiraDocs → Folio 迁移状态
path: /api/guide/migration-status
description: MiraDocs 品牌、包名、API 与生产链迁移到 Folio 的当前事实。
group: Folio API · 迁移
order: 30
type: doc
status: published
tags:
  - Migration
  - MiraDocs
  - Folio
---

这份页面记录 **Folio 当前迁移状态**，不继续复述旧 MiraDocs 迁移分支的历史快照。下列事实核对时间为 2026-11-01。

## 已完成

- repository 已统一为 `uichat-mira/folio`；
- package identity 已统一为 `@uichat-mira/folio`；
- reusable package 位于 `packages/folio`；
- public API 已迁移为 `Folio* / folio()`；
- virtual module 已迁移为 `virtual:folio/content`；
- 官方 reference site 已在 GitHub Pages 从 `prod` 部署；
- schema 已随 Pages artifact 一起发布；
- 官方站只使用公开 package entrypoints，并通过 npm workspace 链接解析，当前不经过 Registry 安装；
- 发布工作流已具备基础配置（`.github/workflows/publish.yml` 的 OIDC、版本和 `prod` 祖先校验）；但这不代表首次 Folio Release 已经可安全执行；
- 独立 tarball 消费者验证已并入 `npm run release:check`，覆盖公开 JavaScript 入口及其类型、Vite 构建与静态产物；
- FOL-014 [独立消费者验收](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) 已进入 `dev`：默认 UI 在 Chrome 156 下有真实截图与交互证据；原始证据还定位了虚拟模块 TypeScript 缺口，后来在源码候选中补声明与回归门禁，历史测试结果保持原状。
- FOL-013 修复 Markdown 链接、`&`、HTML 实体标题的 TOC/正文 ID 不一致；保留既有正文锚点，加入跨层回归测试。

## 待完成

下列事项尚无完成证据，因此不写成已完成。

- npm registry 首次发布：Registry 目前对 `@uichat-mira/folio` 返回 404，即该包尚未发布；
- GitHub Release：尚未创建任何 Folio Release，因此 `publish.yml` 从未被触发，也还没有 Trusted Publishing 的成功运行记录；
- 首发 tag：历史 `v0.1.0` 仍保留为 MiraDocs 记录；FOL-015 候选约定 Folio 使用 `folio-v0.1.0` 并在发布工作流检验该前缀及 `prod` 祖先。尚未创建新 tag、Release 或 npm 发布；
- TypeScript：FOL-014 原始 tarball 复现了 `virtual:folio/content` 的 `TS2307`；当前源码候选随包提供声明，并补充无 workaround 的严格 `tsc` 门禁，仍待最终候选与 Registry 复验；
- 最终 0.1.0 候选仍须在 FOL-013 锚点修复合入后重跑 FOL-014 导航/TOC 浏览器验收；
- UIChat Mira 官网迁移：`uichat-mira/uichat-mira-docs@prod` 仍依赖 `@uichat-mira/docs@^0.1.1`，尚未成为 Folio consumer；
- Organization canonical Skill 的 Folio 化；
- 下游完成迁移后，再决定 predecessor package 的 deprecation 时点。

## 尚未确认

- npmjs.com 上 `@uichat-mira/folio` 的 Trusted Publisher 条目是否已配置：该设置需要 npm 账户权限才能查看，当前没有可核实的公开证据。

## 迁移原则

旧内容和旧 consumer 的历史兼容由迁移层消化。

Folio 核心不为了兼容旧站的私有 `merge`、主题或 URL 结构而重新引入 MiraDocs-era API。
