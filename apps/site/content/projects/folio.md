---
title: Folio 项目
path: /projects/folio
description: 当前产品边界、发布状态与下一阶段工作。
group: 项目
order: 1
type: project
status: active
tags:
  - GitHub Pages
  - Runtime
  - Static Publishing
---

Folio 已经从原 MiraDocs 身份完成仓库级品牌迁移，并进入 Mira Organization 的标准发布链。

## 已经完成

- repository：`uichat-mira/folio`；
- package identity：`@uichat-mira/folio`；
- package directory：`packages/folio`；
- public API：`Folio* / folio()`；
- Vite module：`virtual:folio/content`；
- branch flow：`feat/* → dev → test → prod`；
- `0.1.0` 手动 bootstrap、`0.1.1` GitHub Release + npm OIDC 发布；
- GitHub Pages production deployment；
- schema 随 Pages artifact 一起发布；
- 官方站只消费公开 API。

## 当前 reference implementation

这个仓库自己的 `apps/site` 不再只是默认 runtime 的素页面。

它承担两件事：

1. 对外展示 Folio 能力；
2. 对内持续证明公开 API 足以支持真实产品站。

因此它不是独立于本体的宣传项目，而是一份长期 dogfood fixture。

## 下一阶段

接下来的主线不是继续往 runtime 塞“官网特权”，而是：

- 迁移 UIChat Mira 官网这个下游 consumer；
- 在真实 consumer 迁移后，再决定旧 `@uichat-mira/docs` 的 deprecation 时点；
- 继续用 reference site 暴露 runtime 公共边界不足；
- 保持官方文档与当前 `dev` 源码、公开 API 和发布包状态一致。
