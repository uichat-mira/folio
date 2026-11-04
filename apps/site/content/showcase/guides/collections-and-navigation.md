---
title: 启用集合索引与导航
description: 操作型示例：配置 collections、验证递归收录、处理路由冲突，并让集合入口同时出现在 React 与静态输出中。
group: 能力展厅 · 操作示例
collection: 能力展厅
section: 操作示例
order: 11
type: doc
status: dev-sample
tags:
  - Collections
  - Navigation
  - Static Build
---

> 这篇操作示例描述官方站当前 `dev` 分支的配置方式。集合索引是已实现的真实能力，但标签聚合与搜索分面仍未实现，下面会明确标出边界。

Folio 的集合索引是一个“按路由目录递归收录”的页面，不是按 `type` 过滤的列表。配置入口在 `FolioConfig.collections`：

```ts
export default defineFolioConfig({
  collections: [
    { path: "/guide", title: "指南" },
    { path: "/reference", title: "参考" },
    { path: "/showcase", title: "能力展厅" },
  ],
});
```

每个集合的 `path` 必须是非根绝对路由，不能包含查询串、锚点或 `..`。重复路由会在启动或构建时直接报错，而不是悄悄合并。

## 递归收录意味着什么

集合选择的是“路径前缀匹配”的内容。配置 `/reference` 后，`/reference/examples/*` 和更深层路径都会被收录；配置 `/guide` 则不会自动包含 `/reference`。这与文档壳里的 `collection` 字段是两套不同机制：

- 集合索引按 **route 前缀** 选择页面；
- 文档导航按 **Frontmatter collection** 分组。

因此一篇 `type: doc` 的页面既可能出现在某个集合索引里，也可能同时出现在文档壳的某个集合中。二者不冲突，但需要分别验证。把内容目录、集合前缀和一级导航对齐到同一个根，可以让这两套机制通常指向同一批页面，减少“路由在一处、侧边栏在另一处”的解释成本。

## 避免路由冲突

集合路由本身不能和一条内容 route 完全相同。例如配置了 `/showcase` 集合后，就不能再创建一个 `path: /showcase` 的 Markdown 文件。Folio 提供了 `assertNoFolioCollectionConflicts()`，会在渲染或构建时检查这种冲突。

本次示例把内容放在 `/showcase/content-map`、`/showcase/from-file-to-page` 和 `/showcase/guides/*`，集合入口保留为 `/showcase`，因此没有冲突。

## 同时覆盖 React 与静态输出

官方站的静态构建使用自定义 route 生成器，因此集合索引也必须显式加入静态路由。否则会出现一种“假成功”：React 里 `/showcase` 能打开，但构建产物里没有对应 HTML。

验证时应直接检查文件：

```bash
ls dist/showcase/index.html
ls dist/showcase/guides/organize-content/index.html
```

再在无 JavaScript 的静态 HTML 中确认集合页包含真实条目链接，而不是空列表。

## 导航入口从哪里来

集合导航有三类入口，全部由同一份配置或清单驱动：

1. header 的 `navigation` 手工入口；
2. 首页的集合卡片，从 `folioCollectionIndexes(config)` 派生；
3. 各内容页正文中的交叉链接。

手工导航可以只列最重要的几条，但首页集合卡片不应该再写死第二份列表。当前示例站的首页就是从配置读取集合路径和标题。

## 当前不支持的集合能力

- 没有按标签自动生成集合；
- 没有集合内的分页、筛选或排序控件；
- 没有为集合页自动生成 RSS/Atom（需要显式配置 feeds）；
- 不会因为 `/showcase` 存在就自动把深层文档提升为首页精选。

如果维护者希望这些能力进入下一阶段，应该作为新的工作项评估，而不是在内容里写成“已经支持”。

回到 [内容组织图谱](/showcase/content-map) 或继续阅读 [静态构建与 SEO](/reference/seo)。
