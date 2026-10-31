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
- 包发布链已就绪：`prod` 上 `packages/folio/package.json` 为 `0.1.0`，tag `v0.1.0` 是 `prod` 的祖先，`.github/workflows/publish.yml` 已按 Trusted Publishing 写好；
- 独立 tarball 消费者验证已并入 `npm run release:check`，覆盖入口解析、类型声明、Vite 构建与静态产物。

## 待完成

下列事项尚无完成证据，因此不写成已完成。

- npm registry 首次发布：Registry 目前对 `@uichat-mira/folio` 返回 404，即该包尚未发布；
- GitHub Release：尚未创建任何 Folio Release，因此 `publish.yml` 从未被触发，也还没有 Trusted Publishing 的成功运行记录；
- UIChat Mira 官网迁移：`uichat-mira/uichat-mira-docs@prod` 仍依赖 `@uichat-mira/docs@^0.1.1`，尚未成为 Folio consumer；
- Organization canonical Skill 的 Folio 化；
- 下游完成迁移后，再决定 predecessor package 的 deprecation 时点。

## 尚未确认

- npmjs.com 上 `@uichat-mira/folio` 的 Trusted Publisher 条目是否已配置：该设置需要 npm 账户权限才能查看，当前没有可核实的公开证据。

## 迁移原则

旧内容和旧 consumer 的历史兼容由迁移层消化。

Folio 核心不为了兼容旧站的私有 `merge`、主题或 URL 结构而重新引入 MiraDocs-era API。
