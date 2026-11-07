---
title: 导航与内容清单
description: Folio 如何通过 virtual manifest、group 与 consumer 配置生成导航。
group: 概念
collection: 指南
order: 22
type: doc
status: published
tags:
  - Navigation
  - Virtual Module
---

Folio 不要求 React 组件自己扫描文件。内容发现统一由 Vite plugin 完成。

## virtual manifest

```ts
import docs, { roots } from "virtual:folio/content";
```

它导出：

- `docs`：排序后的 `FolioDoc[]`；
- `roots`：内容源中的顶层目录。

Markdown 变化时，virtual module 会失效并触发完整刷新。

## 两层导航

`FolioApp` 的顶部导航来自 `FolioConfig.navigation`。

默认 sidebar 根据 `docs[].group` 分组，再显示具体条目。因此 consumer 可以同时拥有稳定的产品级顶部入口，以及自动跟随内容变化的文档目录。

## 文档集合入口

指南、参考这类导航项本质上就是一个路由集合。只写 `collection`，Folio 会同时解析入口与高亮范围：

```ts
navigation: [
  { label: "指南", collection: "/guide" },
  { label: "参考", collection: "/reference" },
]
```

- 入口 = 该集合读序第一篇 **`type: doc`** 文档（与集合页、侧栏使用同一排序）；集合里没有文档条目时取第一条内容（例如文章按日期），集合为空时回退到集合索引页 `/guide`。
- `activeMatch` 自动包含集合根，因此 `/guide/*` 的任意页面都会点亮该条目。
- `href` 仍然可用，并且在同时存在时优先；它适合外部链接、集合索引页或固定落地页。
- `href` + `collection` 组合时，`collection` 只补充高亮根，入口仍由 `href` 决定。
- `resolveFolioNavigation(items, docs)` 需要内容才能找到第一篇；`FolioApp` 已经把 `docs` 传给 `FolioHeader`，单独使用 `FolioHeader` 的消费者需要自行传入 `docs`，否则回退到集合索引页。

## 结构化下拉菜单

顶层条目除了 `label` / `href`，还可以带 `children` 与 `panel`。两者都可选：只写 `label` / `href` 的条目行为与之前完全一致。

```ts
navigation: [
  { label: "文章", href: "/blogs" },
  {
    label: "文档",
    href: "/guide/introduction",
    children: [
      { label: "快速开始", href: "/guide/getting-started", group: "入门", icon: "terminal", description: "装依赖、接插件、跑通第一篇文档。" },
      { label: "内容协议", href: "/guide/content-contract", group: "开始", icon: "file", description: "Frontmatter 与目录即路由。" },
      { label: "Frontmatter 参考", href: "/reference/frontmatter", group: "参考", icon: "code", description: "字段、默认值与扩展规则。" },
    ],
    panel: { eyebrow: "HANDBOOK", title: "按要做的任务读", overviewLabel: "文档目录" },
  },
]
```

- `group` 标记阅读任务：回答同一个问题的条目渲染在同一标题下。分组按首次出现顺序排列，未分组的条目汇总为一段无标题内容排在最前。完全不写 `group` 时面板与旧版逐像素一致，这是向后兼容的关键。
- 面板内部只有两级：阅读任务标题，以及该任务下的链接。更深的层级属于文档侧边栏，不应塞进 header 下拉。

- 触发器的普通点击用于展开面板，因此 header 会自动补一条指向该条目自身 `href` 的入口（`panel.overviewLabel`，默认 `全部{label}`）；如果 `children` 里已经有同一路由，就不重复添加。
- `icon` 是普通字符串而非 React 组件：`types.ts` 属于 Core 层，不能引入 React。内置键为 `book`、`compass`、`layers`、`sparkles`、`code`、`file`、`archive`、`link`、`terminal`、`info`、`search`，其他值渲染为中性链接图标。
- 菜单结构完全由配置驱动，没有按路由硬编码的分支：任何路由都可以成为菜单。
- 桌面端支持悬停、点击与键盘展开；`Escape` 与点击面板外关闭，路由变化也会关闭。移动端使用独立的可展开手风琴，而不是把桌面面板压缩后塞进窄屏。
- 需要自己实现 header 的 consumer 可以复用导出的 `resolveFolioNavigation()` 与 `isFolioNavItemActive()`，保持同一套归一化与激活判断。

## 让一个条目覆盖多个路由目录

条目在自身 `href` 相同或位于其下方时才算当前页。如果一个顶层条目其实横跨多个路由目录，仅靠前缀匹配就会在目录之外丢失高亮。

```ts
navigation: [
  {
    label: "指南",
    href: "/handbook/introduction",
    activeMatch: ["/recipes/authoring", "/recipes/content-model"],
  },
]
```

- `activeMatch` 是额外的路由前缀，命中即视为当前页。它可选，省略等价于空列表，已有条目不受影响。
- 它只影响高亮，不影响渲染形态：带 `activeMatch` 的条目仍然是普通链接。
- 前缀会经 `folioNavHref()` 归一化，空白与重复值被丢弃，与 `href` 相同的前缀只是冗余而非错误。
- 这里刻意用显式清单而不是整个目录前缀：更宽的前缀会让同一页同时点亮两个一级条目。若一个目录确实混装两类内容，就逐个列出页面。

`activeMatch` 修好的是高亮，不是结构：页面仍然散在多个目录里时，路由、内容目录和侧边栏 `collection` 会彼此对不上。**能决定内容布局时，更好的做法是给每种阅读模式一个路由根**——让目录、路由前缀、`config.collections` 和 `collection` 用同一个名字，四处就不会各自漂移。

本站就是这么做的：`/guide/*` 与 `/reference/*` 各自一个根，并且直接用集合简写，不再需要手写落地页与高亮前缀：

```ts
navigation: [
  { label: "指南", collection: "/guide" },
  { label: "参考", collection: "/reference" },
]
```

如果落地页不是集合第一篇，仍然可以写 `{ href: "/guide/start-here", collection: "/guide" }`：`href` 决定入口，`collection` 负责高亮根。

**声明一次根，而不是逐页清单**：第三轮需要 11 条页面路径，是因为整个 `/docs` 与 `/api` 目录被两个入口共用；现在目录就是分区，两个根互不交叠，所以一个前缀既够用、也不会让同一页点亮两个条目。

`activeMatch` / `collection` 的另一个用途是 URL 空间无法重排时：已经发布且被外部引用的路由，或由别的团队维护的内容。

## 拆分文档侧边栏

文档侧边栏按 frontmatter 的 `collection` 字段分组，而不是按 `config.collections`。没写的页面回落到字面量「文档」，因此一个站点可以只有一个侧边栏，也可以有多个，且不需要移动任何 Markdown 文件。

```yaml
---
title: 内容模型
group: 概念
collection: 指南
---
```

`collection` 决定侧边栏标题，也决定哪些页面出现在其中。`config.collections` 与此无关：它声明的是「要生成集合索引页的 URL 目录」。所以，「哪些文档该放在一起读」用 `collection`，「哪条路由该有索引页」用 `config.collections`。

把边界放在内容里，改导航时就不必改动内容结构；反过来，重命名一个栏目只是导航改动，不是一次内容迁移。

## 兼容旧 URL

需要保留历史 URL 时，用 Vite plugin 的 `route`：

```ts
folio({
  contentDir: "content",
  config,
  route: (_sourcePath, doc) =>
    doc.path.replace(/^\/legacy(?=\/|$)/, "") || "/",
});
```

URL 兼容属于 consumer 的迁移策略，不要求 Folio 核心知道某个旧站的目录结构。
