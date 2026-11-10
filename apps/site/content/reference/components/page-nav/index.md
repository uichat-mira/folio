---
title: FolioPageNav
description: 独立可组合的上一篇／下一篇导航：公开 Props、排序来源、Router 条件与静态输出。
type: doc
collection: 参考
section: API
order: 45
status: published
tags: [React, Pagination, API]
---

`FolioPageNav` 是一个**展示型组件**，统一呈现「上一篇」与「下一篇」。它们是同一个组件的左右两个入口，而不是分别维护的按钮组件。

## 版本与发布状态

本页描述当前 `dev` 源码。npm 最新发布版 `0.1.1`（Git tag `folio-v0.1.1`）**未导出** `FolioPageNav`；安装 `0.1.1` 时不能按本页示例导入该组件；本页适用于当前 `dev` 或包含该导出的后续版本。 `status: published` 仅表示文档内容已审校，不表示此组件已包含在 npm 0.1.1 中。

## 导入与最小用法

~~~tsx
import { FolioPageNav } from "@uichat-mira/folio";

<FolioPageNav
  previous={{ path: "/guide/getting-started", title: "快速开始" }}
  next={{ path: "/guide/configuration", title: "站点配置与扩展" }}
  ariaLabel="相邻章节"
  className="consumer-page-nav"
/>;
~~~

独立使用时必须位于 React Router 内，因为两个入口都渲染为 `react-router-dom` 的 `Link`；`basename` 由外层 Router 决定，不是组件 Prop。

## 公开 Props

~~~ts
type FolioPageNavTarget = Pick<FolioDoc, "path" | "title">;

type FolioPageNavNeighbors = {
  previous?: FolioPageNavTarget;
  next?: FolioPageNavTarget;
};

type FolioPageNavProps = FolioPageNavNeighbors & {
  className?: string;
  ariaLabel?: string; // 默认：文档分页
};
~~~

- `previous`、`next` 都只要求 `path` 与 `title`，不必为了展示链接构造完整的 `FolioDoc`。
- `className` 追加到根 `<nav class="folio-page-nav">`。
- `ariaLabel` 覆盖导航的可访问名称，默认“文档分页”。

组件不会补全、推导或校验目标路径；传入的 `path` 必须由调用方保证是应用内的有效路由。

## 默认渲染与交互

- `previous` 和 `next` 都存在时，按“上一篇 → 下一篇”顺序输出两个链接。
- 只有一侧存在时，另一侧保留空 `<span>`，以维持左右两列对齐；不会伪造不存在的链接。
- 两者都不存在时返回 `null`，不渲染空导航。
- 每个链接内部先输出固定方向文字（“上一篇”“下一篇”），再输出目标标题；没有激活态、当前页标记、焦点管理或滚动监听。
- 标题由 React 文本节点输出，因此按文本安全转义；样式来自统一的 `@uichat-mira/folio/styles.css`。
- 组件不接收 `onNavigate`，也不会在跳转时执行回调；移动端抽屉关闭由外层导航负责，分页位于正文底部，不是抽屉内容。

## 无障碍与移动端

- 根元素是带 `aria-label` 的 `<nav>`；两个入口都是原生链接，目标标题作为链接文本的一部分，没有额外的 ARIA 角色或键盘手势。
- 组件没有“当前页”概念，因此不使用 `aria-current`；上一页/下一页只表示阅读顺序。
- 它没有响应式分支或移动端专用布局，在窄屏由站点 CSS 自行折行；不要把它放进需要 `onNavigate` 才能关闭的移动抽屉，因为它没有该回调。

## 翻页顺序由谁决定？

`FolioPageNav` **不推导相邻页面**，也不读取侧边栏状态。由调用者决定上一页和下一页：

~~~tsx
import {
  FolioPageNav,
  buildFolioNavigationTree,
  getFolioNavigationNeighbors,
} from "@uichat-mira/folio";

// 使用与左侧栏相同的 Core 导航树作为阅读顺序。
const tree = buildFolioNavigationTree(docs, currentDoc);
const neighbors = getFolioNavigationNeighbors(tree, currentDoc.path);
<FolioPageNav {...neighbors} />;
~~~

`FolioDocsShell` 与 `FolioApp` 默认使用**左侧栏同一棵导航树**计算上一页和下一页；例如在组件目录最后一篇 `FolioShareButton` 后，下一篇就是同一 API 分节中的「参考索引」，从参考索引返回也会回到 `FolioShareButton`。消费者也可向 `FolioDocsShell` 传入 `pageNeighbors` 覆写默认顺序，该覆写是权威值。

需要特别区分“默认树顺序”和“目录边界”：

- `getFolioNavigationNeighbors()` 会按整棵导航树先序遍历，依次走完每个分节和根节点，因此同一文档集合内可以跨分节、跨父子路由连续翻页。
- 对没有 `collection` 的普通 `doc`，Core 会把它们归入默认集合“文档”。如果这些文档分布在 `/handbook/atlas` 与 `/handbook/other` 之类的兄弟根目录下，默认分页会沿树从前者继续走到后者；**当前实现不会自动限制在单个顶级目录**。
- 需要限定在单个顶级根目录时，先用 `buildFolioContentTree()` 构造纯内容树，再调用 `getFolioTreeNeighbors(contentTree, doc.path)`，或由 `FolioDocsShell` 的 `pageNeighbors` 显式覆盖。`getFolioDocNeighbors(docs, current)` 仍作为旧版集合内平铺顺序的工具保留；它按集合的 `section` 顺序排列，不处理路由父子层级。两者都不再控制默认阅读布局。
- 如果目标属于另一个集合或自定义路由，应该显式传入 `pageNeighbors`，不要依赖默认树。

## React 与无 JS 静态边界

无 JavaScript 静态页面使用相同的分页结构，由构建层生成路由链接：

~~~ts
import { renderFolioStaticPageNav } from "@uichat-mira/folio/vite";

const pagerHtml = renderFolioStaticPageNav(context, currentDoc);
~~~

- 静态函数同样通过 `buildFolioNavigationTree()` + `getFolioNavigationNeighbors()` 计算默认顺序，并输出与 React 相同的 `folio-page-nav__previous` / `folio-page-nav__next` 结构。
- 链接由 `context.base` 与路由拼成静态站路径（通常带尾斜杠），而不是 React Router 的 `basename`。
- 静态函数不接受 `pageNeighbors` 覆写，也没有“激活态”或交互脚本；需要自定义顺序时，消费站必须自己生成静态分页 HTML。
- 静态标题使用构建层转义，不暴露原始 Markup。

本组件不处理目录分类、权限、章节排序、滚动定位或站点路由声明；这些职责分别属于 Core、[FolioTreeNav](/reference/components/tree-nav) 和应用路由层。阅读布局的完整接线见 [FolioDocsShell](/reference/components/docs-shell)。
