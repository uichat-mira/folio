---
title: 同一份 Markdown 如何进入页面与静态输出
description: 沿着 virtual:folio/content、React 路由和 build 阶段三条路径，拆解 Folio 如何让同一份内容同时服务交互页面与静态 HTML。
group: 专题
date: 2026-11-04
author: Folio 示例内容 · AI Worker
type: article
status: dev-sample
tags:
  - Vite
  - Static Build
  - React
---

> 说明：本文是 `dev` 分支上的示例专题，署名与日期用于演示 Frontmatter 能力，不构成真实发布记录。文中命令与行为以当前仓库源码为准。

一篇 Markdown 想同时出现在浏览器和静态 HTML 里，最容易走的歪路是维护两套渲染：React 里一套组件，构建脚本里再拼一遍 HTML。短期看只是重复，长期一定会出现“页面里有、静态文件里没有”或者“链接在 SPA 能点、无 JS 时是空壳”的偏差。

Folio 的做法是把解析和渲染尽量放进共享的 core，然后让不同入口消费同一个结果。

## 第一站：虚拟内容清单

Vite 插件扫描 `content` 目录，把每个 Markdown 文件解析成 `FolioDoc`，再通过虚拟模块暴露给应用：

```ts
import docs, { roots } from "virtual:folio/content";
```

这份清单同时包含正文、标题结构、日期、标签和 Frontmatter 里的自定义字段。站点不需要自己再写一套文件扫描逻辑，也不会出现“导航数据在配置里、正文数据在另一个目录”的双源问题。

## 第二站：React 运行时

`FolioApp` 拿到 `docs` 与 `FolioConfig` 后，按路由渲染：

```tsx
<FolioApp
  config={config}
  docs={docs}
  basePath={import.meta.env.BASE_URL}
  slots={{ home: <HomePage docs={docs} basePath={import.meta.env.BASE_URL} /> }}
/>
```

默认行为已经覆盖了首页、集合索引、文档壳、文章目录、404 和搜索。consumer 可以在 `slots` 里换掉首页或文章尾部，但内容模型、路由匹配和搜索仍然来自同一个包。

这里有一个容易忽略的细节：**文章类型会自动出现页内目录**。判断条件是 `doc.type === "article"` 并且正文至少有一个二到四级标题。普通 `doc` 则进入文档壳，和同 `collection` 的其他文档共享侧边导航与前后篇。

## 第三站：静态构建

生产构建时，Vite 插件在 `writeBundle` 阶段再次读取同一批文件，写出目录式 HTML：

```text
dist/
├── index.html
├── blogs/one-markdown-many-surfaces/index.html
├── docs/introduction/index.html
├── 404.html
├── sitemap.xml
└── robots.txt
```

如果配置了集合索引，集合路由也会得到自己的 HTML。Folio 还会为每条 route 生成 canonical、Open Graph、robots 和保守的 JSON-LD。没有可信日期时，它不会伪造 `datePublished`；没有作者时，也不会生成一个虚构的人。

## 差异只应该存在于“表达层”

React 与静态输出可以长得不完全一样，但核心阅读路径不应该互相矛盾。当前官方站的做法是：

- Markdown 正文由同一个 `renderFolioMarkdown()` 渲染；
- 站内链接在 React 和静态入口都经过同一条基路径映射；
- 首页入口来自同一份内容清单，而不是在 JSX 里另写一份假数据；
- 集合索引与文档分页使用相同的内容选择函数。

一个可观察的验证方式是：构建后在无 JavaScript 的静态 HTML 里打开一篇文章，检查标题锚点、代码块和上一篇/下一篇链接是否仍然存在。再打开 `/folio/` 基路径下的同一页面，确认站内链接没有丢掉项目子路径。

## 边界与未完成项

当前实现也有明确边界。搜索是客户端对标题、描述、分组、标签和正文做子串匹配，没有分面筛选，也没有标签聚合页；这些能力如果被写进内容当作“已支持”，就是假的。静态输出虽然包含正文，但 Mermaid 图表在无 JS 时只保留源码文本，真正的图形需要运行时加载。

想继续沿着这条数据流往下看，可以阅读：

- [从一个内容文件到最终静态页面](/showcase/from-file-to-page)；
- [导航与内容清单](/guide/navigation)；
- [静态构建与 SEO](/reference/seo)。
