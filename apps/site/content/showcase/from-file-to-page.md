---
title: 从一个内容文件到最终静态页面
description: 追踪一个 Markdown 文件经过解析、虚拟清单、React 路由、静态写入和基路径映射的完整路径。
group: 展厅
order: 2
type: page
status: dev-sample
tags:
  - Pipeline
  - Vite
  - Static Build
---

> 这是 `dev` 分支上的独立参考页。它用一个具体文件说明 Folio 的数据流，而不是把“支持 Markdown”当成结论。

假设仓库里有一个文件 `apps/site/content/blogs/content-stays-in-git.md`。从它被保存到读者打开页面，中间经过五步。

## 第一步：解析 Frontmatter

Vite 插件扫描内容目录，读取文件文本，交给 `parseFolioDoc()`。YAML Frontmatter 被解析成结构化字段，正文保留为 Markdown 字符串。

```ts
const doc = parseFolioDoc(sourcePath, raw);
// doc.title, doc.type, doc.tags, doc.body, doc.headings ...
```

如果文件没有显式 `path`，路由由源文件路径推导；如果有显式 `path`，以 Frontmatter 为准。标题会在这一步被提取成 `headings`，供文章目录和静态 HTML 使用。

## 第二步：形成虚拟清单

解析结果按统一规则排序，然后通过 `virtual:folio/content` 暴露给应用：

```ts
import docs from "virtual:folio/content";
```

这一步是“单一内容源”的关键。首页、集合索引、搜索和文档导航都消费同一份 `FolioDoc[]`，不存在第二套手写列表。

## 第三步：进入 React 路由

`FolioApp` 根据配置为首页、集合索引和每条内容 route 匹配页面：

- `type: doc` → 文档壳，包含同 `collection` 的侧边导航、页内 TOC 和前后篇；
- `type: article` → 文章页，包含页内 TOC；
- `type: project` / `page` → 普通内容页。

导航和搜索都使用 `doc.path`，而不是从标题临时拼 URL。这样标题改名不会悄悄打断内链。

## 第四步：静态构建写出 HTML

`vite build` 期间，插件在 `writeBundle` 阶段再次读取同一批文件，为公开 route 写出目录式 HTML：

```text
/blogs/content-stays-in-git/index.html
/showcase/content-map/index.html
/projects/official-site/index.html
```

同时生成 `404.html`、`sitemap.xml` 和 `robots.txt`。首页和文档页的静态 body 直接包含正文与标题锚点，不是只有一个空的 `<div id="root">`。

## 第五步：基路径映射

GitHub Pages 项目站运行在 `/folio/`。React 运行时通过 `basePath` 处理路由；Markdown 里的根相对链接在进入渲染器前会被映射到当前 base。

一个真实检查方式是分别构建根路径与项目子路径：

```bash
GITHUB_REPOSITORY= npm run build
GITHUB_REPOSITORY=uichat-mira/folio npm run build
```

然后检查生成的 HTML 中站内链接是否分别指向 `/` 与 `/folio/`，而不是写死其中一种。

## 这条路径的边界

静态构建不会替你生成标签页、在线评论或图片处理。Git 历史只在能提供可信日期时参与元数据；缺失时不伪造发布时间。Mermaid 的图形化依赖客户端运行时，静态 HTML 只保留可读源码。

想继续追踪，可以阅读 [同一份 Markdown 如何进入页面与静态输出](/blogs/one-markdown-many-surfaces) 和 [静态构建与 SEO](/reference/seo)。
