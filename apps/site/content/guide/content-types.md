---
title: 内容类型与路由
description: doc、article、page 的用途与阅读路径，以及文件位置如何变成站点路由。
group: 写作
collection: 指南
order: 12
type: doc
status: published
tags:
  - Content
  - Routing
  - Authoring
---

Folio 用同一个 `FolioDoc` 模型承载文档、文章和独立页面。类型决定阅读布局、导航归属与排序方式；文件位置决定默认路由。

这一页回答“这类内容适合写成什么、会出现在哪里”。字段写法见 [Frontmatter 与元数据](/guide/frontmatter-fields)，解析事实见 [内容模型](/guide/content-model)。

## 三种类型

| 类型 | 适合写什么 | 阅读布局 | 是否进入侧栏 |
| --- | --- | --- | --- |
| `doc` | 文档、指南、参考 | 左侧导航 + 正文 + 页内目录 | 是 |
| `article` | 博客、专题、按日期阅读的长文 | 文章布局 + 页内目录 | 否 |
| `page` | 独立案例、附录、自定义页面 | 普通页面 | 否 |

独立页面必须从至少一篇文档链入，避免成为只有搜索才能到达的死路。

## 文件路径即路由

默认路由由文件位置生成，`index.md` 映射到目录本身：

```text
content/introduction.md        → /introduction
content/guide/start.md         → /guide/start
content/guide/index.md         → /guide
```

需要固定 URL 时，用 Frontmatter 显式覆写：

```yaml
---
title: 快速开始
description: 最短安装路径。
path: /guide/quick-start
---
```

显式 `path` 同时决定导航归属，因此移动文件不会自动带走旧链接。

## 类型推断

未写 `type` 时，按内容根目录推断：

- `blogs/*` → `article`
- 其他目录 → `doc`

推断只是默认值。显式 `type` 优先，例如把一篇独立阅读页写成 `page`。官方站的组件文档使用 `type: doc`，由文档集合、章节和目录路由共同形成层级导航。

旧版 `type: project` 只作为历史数据兼容值被解析，不再获得专用阅读布局或专用侧栏；新内容应写 `doc`、`article` 或 `page`。

## 文档层级

层级文档不需要手工维护父级字段。使用 `type: doc`，以 `collection` 和 `section` 归类，再用目录与 `index.md` 表达父子关系：

```text
content/reference/components/
├─ index.md          # /reference/components，可点击的概览
└─ app/
   └─ index.md       # /reference/components/app，子页面
```

- 有 `index.md` 的目录成为可点击的概览节点。
- 没有 `index.md` 的目录只作为分组，不生成假的概览链接。
- 排序使用 `order`；相同 `order` 按路由字典序。
- 显式 `path` 会改变路由，也会改变文档树中的位置。

## 文章与独立页面

文章不进入文档侧栏，按 `date` 倒序排列，适合博客与专题。它的阅读入口来自集合索引页、首页或站内链接。

独立页面不参与侧栏与分页，适合案例、附录或自定义阅读页；它仍会出现在搜索和静态构建中。

如果内容需要连续阅读或父子层级，选 `doc`；如果需要按时间发布，选 `article`；如果只是一篇独立阅读材料，选 `page`。

## 文章的归档入口（dev）

文章除了按日期阅读，还可以有分类与标签两种归档入口。这是 Article 专属的阅读面：

- `category` 是可选单值，`tags` 是零到多个主题标签；两者都不改变文章 URL、`collection`、`group`、`section`，也不进入侧栏。
- 只有集合在站点配置里显式写了 `archive: true`，才会生成归档路由：

```text
<collection>/category/<slug>
<collection>/tag/<slug>
```

- 官方站的 `/blogs` 集合已开启归档，因此可以打开 `/blogs/category/工程实践` 与 `/blogs/tag/git` 阅读。
- 集合索引页会出现一行「分类」入口；文章卡片与文章元信息区的标签变成链接。归档入口**不会**注入全局顶部导航。
- 未知归档 slug 进入正常的 404 页面；两个不同标签折叠到同一个 slug（例如 `C++` 与 `C#`）会让构建失败，而不是共用一个归档。
- 归档身份来自 Frontmatter 值，中文 slug 在请求 URL 中会被百分号编码。

分类与标签的区别、归一化规则和配置写法见 [内容组织与排序](/guide/organizing-content)。归档能力属于当前 `dev` 源码（FOL-040 / FOL-041），尚未包含在已发布的 `0.1.1` 中；只用 `0.1.1` 的站点没有这些归档路由。

## 相关文档

- [编写内容](/guide/authoring)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容组织与排序](/guide/organizing-content)
- [内容模型](/guide/content-model)
- [Markdown 写作](/guide/markdown-runtime)
