---
title: 站点配置与扩展
path: /api/guide/configuration
description: FolioConfig、Vite plugin options 与 React slots 的公共契约。
group: Folio API · 核心概念
order: 22
type: doc
status: published
tags:
  - Config
  - Slots
---

## FolioConfig

```ts
type FolioConfig = {
  title: string
  description: string
  logo?: string
  siteUrl?: string
  base?: string
  navigation?: { label: string; href: string }[]
  footer?: string
  github?: string
}
```

## Vite plugin

```ts
type FolioPluginOptions = {
  contentDir?: string
  config: FolioConfig
  staticRoutes?: boolean | FolioStaticBuildOptions
  exclude?: (sourcePath: string) => boolean
  route?: (sourcePath: string, doc: FolioDoc) => string
}
```

## React slots

```ts
type FolioSlots = {
  home?: ReactNode
  headerActions?: ReactNode
  articleFooter?: ReactNode
}
```

官方 Folio 首页就是 `slots.home` 的真实 consumer。

品牌、复杂 landing page 和额外交互属于 consumer；Folio runtime 不需要为官网增加隐藏接口。
