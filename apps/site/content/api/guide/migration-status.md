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

这份页面记录 **Folio 当前迁移状态**，不继续复述旧 MiraDocs 迁移分支的历史快照。

## 已完成

- repository 已统一为 `uichat-mira/folio`；
- package identity 已统一为 `@uichat-mira/folio`；
- reusable package 位于 `packages/folio`；
- public API 已迁移为 `Folio* / folio()`；
- virtual module 已迁移为 `virtual:folio/content`；
- 官方 reference site 已在 GitHub Pages 从 `prod` 部署；
- schema 已随 Pages artifact 一起发布；
- 官方站只使用公开 package entrypoints。

## 仍是独立后续步骤

- npm registry 首次发布；
- npm Trusted Publisher 配置；
- UIChat Mira 官网从旧 `@uichat-mira/docs` 迁移为 Folio consumer；
- Organization canonical Skill 的 Folio 化；
- 下游完成迁移后，再决定 predecessor package 的 deprecation 时点。

## 迁移原则

旧内容和旧 consumer 的历史兼容由迁移层消化。

Folio 核心不为了兼容旧站的私有 `merge`、主题或 URL 结构而重新引入 MiraDocs-era API。
