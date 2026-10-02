---
title: 仓库、Consumer 与 Skill 边界
path: /api/guide/architecture
description: Folio runtime、下游站点与 UIChat Mira Organization Skill 如何协作。
group: Folio API · 核心概念
order: 23
type: doc
status: published
tags:
  - Architecture
  - Skill
---

Folio 不把 GitHub、Agent 或 CMS 工作流塞进 runtime。

## Folio 仓库

```text
uichat-mira/folio
├── packages/folio   @uichat-mira/folio
├── apps/site        官方 reference implementation
├── schemas          内容与配置 schema
└── workflows        validate / Pages / publish
```

## Consumer

Consumer 拥有自己的内容仓库、品牌与交互、URL 兼容策略、PWA / 搜索 / 作者模型、部署平台和 consumer-specific Frontmatter 字段。

Folio 只提供公共内容、runtime 与 build contract。

## Organization Skill

Canonical Skill 属于 UIChat Mira Organization 的 Skills 体系，不在 Folio 仓库维护第二份副本。

Skill 可以编排 GitHub 能力去修改内容、建立分支、创建 PR、观察 Actions 和发布；它不因此获得绕过仓库权限与审批的特权。
