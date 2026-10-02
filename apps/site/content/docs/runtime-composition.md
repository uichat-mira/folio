---
title: 只用公开 API，也能把站做成自己的样子
description: Folio 负责稳定契约，consumer 负责品牌、布局与交互；官方站本身就是这条边界的参考实现。
group: 能力
order: 3
type: doc
status: published
tags:
  - React
  - Slots
  - Consumer
---

Folio 的目标不是让所有站点长得一样，而是让不同站点共享同一套稳定内容与构建契约。

这个官网没有从 `packages/folio/src/*` 偷 import 任何内部实现。它只使用公开 package entrypoints：

```tsx
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import docs from "virtual:folio/content";
import "@uichat-mira/folio/styles.css";
```

## Runtime 负责什么

`FolioApp` 提供默认路由、导航、sidebar、文档页与基础样式。对于一个普通文档站，这已经可以直接工作。

同时它保留几个组合点：

```tsx
<FolioApp
  config={config}
  docs={docs}
  slots={{
    home: <CustomHome />,
    headerActions: <GitHubLink />,
    articleFooter: <BuildEvidence />,
  }}
/>
```

官方站首页就是通过 `slots.home` 注入的，而不是 fork runtime。

## Consumer 负责什么

Consumer 可以自由拥有：

- 品牌字体、颜色和排版；
- 首页的产品叙事与信息架构；
- header action；
- 页面之外的互动组件；
- 对默认 runtime CSS 的覆盖；
- 自己的静态 route body 与 JSON-LD。

这也是为什么首页可以像产品站，而进入 docs、article、project、page 后仍然回到同一个 Folio 内容壳。

## 为什么这条边界重要

如果每做一个漂亮站点都要去改 Folio 内部组件，那 Folio 就不是 runtime，只是另一个难以升级的主题仓库。

真正可复用的边界应该是：

> Runtime 拥有契约，consumer 拥有表达。

这个官网存在的意义，就是持续证明这句话不是 README 里的愿望。
