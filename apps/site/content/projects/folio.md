---
title: Folio 项目
path: /projects/folio
description: 当前产品边界、阶段目标与迁移路线。
group: 项目
order: 1
type: project
status: active
tags:
  - GitHub Pages
  - CMS
  - Project Portal
---

## 当前阶段

- 将原 MiraDocs 运行时完整迁移为 Folio 品牌与公共 API；
- 新 npm 包线使用 `@uichat-mira/folio`；
- 官方站使用 Folio 自身运行时构建；
- 生产发布遵循 `feat/* → dev → test → prod`。

## 下一阶段

将现有 UIChat Mira 官网消费者从旧 `@uichat-mira/docs` 迁移到 Folio，并同步 Organization 内的 canonical Skill。完成消费者迁移后，旧 npm 包只保留 deprecation 指引。
