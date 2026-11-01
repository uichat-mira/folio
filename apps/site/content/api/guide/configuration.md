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
  collections?: {
    path: string
    title?: string
    description?: string
    emptyMessage?: string
  }[]
  home?: FolioHomeConfig
  footer?: string
  github?: string
}
```

## 内置首页配置

`FolioConfig.home` 只配置内置首页，不需要复制静态路由或默认组件：

```ts
home: {
  meta: { left: "FIELD NOTES", right: "ARCHIVE" },
  sections: [
    { type: "intro", title: "写在前面" },
    { type: "featured", collection: "/notes" },
    { type: "recent", collection: "/notes", limit: 3 },
    { type: "collections", paths: ["/projects"], limit: 2 },
    { type: "about", path: "/info/about", linkLabel: "继续阅读" },
  ],
}
```

`sections` 的数组顺序就是首页区块顺序；省略时保留默认顺序，`[]` 只保留可选的 meta 条。精选与近期内容复用 `config.collections` 的路由集合，不写死 `/blogs` 或 `/projects`。`resolveFolioHome(config, docs)` 会返回 React 与默认静态首页共用的结构化模型。

## 三种首页路径

1. **直接使用默认首页**：不设置 `home`，也不设置 `slots.home`。
2. **通过配置自定义**：设置 `config.home`；React 与默认静态首页使用同一份选择与排序。
3. **高级完整覆写**：`slots.home` 仍然完整替换 React 首页；`staticRoutes.home` 只替换静态 `/`，其他路由、404、sitemap 与 robots 不变。完整自定义静态 `routes` 时，该路由数组仍然是全站真相源；需要时可在其中调用 `renderFolioStaticHome(context)`。

静态 `staticRoutes.home` 接收显式 HTML，不能把任意 ReactNode 自动变成静态 HTML；SSR 与 React 服务端渲染由 consumer 自行负责。以上 `home` 配置与 `staticRoutes.home` 是 `dev` 候选契约，未包含在已发布的 `0.1.1` 中。

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

官方 Folio 首页就是 `slots.home` 的真实 consumer。`slots.home` 的优先级高于 `config.home`：只要提供 React 首页节点，就完全使用该节点。

品牌、复杂 landing page 和额外交互属于 consumer；Folio runtime 不需要为官网增加隐藏接口。完整的首页定制边界见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md#configurable-built-in-home-fol-030-candidate-not-published-in-011)。
