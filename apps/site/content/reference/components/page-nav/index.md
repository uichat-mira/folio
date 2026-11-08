---
title: FolioPageNav
description: 独立可组合的上一篇／下一篇导航组件，支持文档集合与项目目录的翻页。
type: doc
collection: 参考
section: API
order: 45
status: draft
tags: [React, Pagination, API]
---

`FolioPageNav` 是一个**展示型组件**，统一呈现截图中的「上一篇」与「下一篇」。它们是同一个组件的左右两个入口，而不是分别维护的按钮组件。

## 单独使用

~~~tsx
import { FolioPageNav } from "@uichat-mira/folio";

<FolioPageNav
  previous={{ path: "/guide/setup", title: "安装与配置" }}
  next={{ path: "/guide/publish", title: "发布站点" }}
  ariaLabel="相邻章节"
  className="consumer-page-nav"
/>;
~~~

`FolioPageNavProps` 的主要字段是：

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

因此，调用者只需提供目标路径和标题，不必为了展示链接构造完整的 `FolioDoc`。

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

`FolioDocsShell` 与 `FolioApp` 默认使用**左侧栏同一棵导航树**计算上一页和下一页，包括文档分类与其下的项目子文章。例如在组件目录最后一篇 `FolioShareButton` 后，下一篇就是同一 API 分类中的「参考索引」；从参考索引返回也会回到 `FolioShareButton`。

没有文档分类的独立项目仍然只在当前一级项目内翻页，不会擅自跨到下一个项目。消费者也可向 `FolioDocsShell` 显式传入 `pageNeighbors` 覆写默认顺序。旧的 `getFolioDocNeighbors()` 和 `getFolioTreeNeighbors()` 继续作为范围更窄的独立工具函数保留；它们不再分别控制默认阅读布局。

## 交互与边界

- 只有一侧存在时，另一列保留空位，以维持左／右对齐。
- `previous` 和 `next` 都没有时，不渲染导航。
- 链接通过 React Router 处理，因此遵守应用的 `basename`。
- 标题按文本安全转义，样式来自统一的 `@uichat-mira/folio/styles.css`。
- 无 JavaScript 静态页面使用相同的分页结构，由构建层生成可用的路由链接；不需要交互脚本。消费站自定义静态文档布局时，可从 `@uichat-mira/folio/vite` 调用 `renderFolioStaticPageNav(context, currentDoc)`：它与运行时共用同一导航树和上一篇／下一篇计算，不要再手写一套静态分页。
- `className` 用于消费站添加外观样式，`ariaLabel` 可覆盖默认的「文档分页」导航名称。

本组件不处理目录分类、权限、章节排序、滚动定位或站点路由声明；这些职责分别属于 Core、`FolioTreeNav` 和应用路由层。
