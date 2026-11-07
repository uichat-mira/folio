---
title: 内容类型与路由
description: doc、article、project、page 的区别，以及文件路径如何变成站点路由。
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

Folio 用同一个 `FolioDoc` 模型承载四类内容。类型决定阅读布局、导航归属与排序方式；文件位置决定默认路由。

## 四种类型

| 类型 | 适合写什么 | 阅读布局 | 是否进入侧栏 |
| --- | --- | --- | --- |
| `doc` | 文档、指南、参考 | 左侧导航 + 正文 + 页内目录 | 是 |
| `article` | 博客、专题、按日期阅读的长文 | 文章布局 + 页内目录 | 否 |
| `project` | 项目概览与项目子页 | 项目目录树 + 正文 + 页内目录 | 否，随所属集合出现 |
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
- `projects/*` → `project`
- 其他目录 → `doc`

推断只是默认值。显式 `type` 优先，例如把某个 `projects/` 下的页面写成 `page`。官方站的组件文档虽然放在 `reference/components/` 下，但通过 `type: project` 使用项目树导航。

## 项目层级

项目不需要手工维护父级字段。用目录与 `index.md` 表达层级：

```text
content/projects/folio/
├─ index.md          # /projects/folio，可点击的概览
└─ roadmap/
   └─ index.md       # /projects/folio/roadmap，子页面
```

- 有 `index.md` 的目录成为可点击的概览节点。
- 没有 `index.md` 的目录只作为分组，不生成假的概览链接。
- 排序使用 `order`；相同 `order` 按路由字典序。
- 显式 `path` 会改变路由，也会改变项目树中的位置。

## 文章与独立页面

文章不进入文档侧栏，按 `date` 倒序排列，适合博客与专题。独立页面不参与侧栏与分页，适合案例、附录或自定义阅读页；它仍会出现在搜索和静态构建中。

如果你的内容需要连续阅读、按章节组织，选 `doc`；如果需要按时间发布，选 `article`；如果有稳定的父子结构，选 `project`；如果只是一篇独立阅读材料，选 `page`。

## 相关文档

- [编写内容](/guide/authoring)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容组织与排序](/guide/organizing-content)
- [内容模型](/guide/content-model)
