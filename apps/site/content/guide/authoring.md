---
title: 编写内容
description: 从第一个 Markdown 文件到可阅读页面：写作流程、内容类型、Frontmatter 与发布前检查。
group: 写作
collection: 指南
order: 11
type: doc
status: published
tags:
  - Markdown
  - Frontmatter
  - Authoring
---

Folio 的写作单位是一个带 YAML Frontmatter 的 Markdown 文件。文件放进内容目录后，会被解析成 `FolioDoc`，同时获得路由、导航位置与静态页面。

这一页只讲实际写作流程：字段怎么写见 [Frontmatter 与元数据](/guide/frontmatter-fields)，放在哪、怎么排序见 [内容组织与排序](/guide/organizing-content)，正文语法与安全边界见 [Markdown 写作](/guide/markdown-runtime)。

## 写作流程

从新建文件到可阅读页面，按这个顺序走：

1. **创建内容**：在 `content/` 下新建 `.md` 文件，路径按目标 URL 设计。
2. **选择类型**：文档用 `doc`，按日期发布的长文用 `article`，独立阅读页用 `page`；布局差异见 [内容类型与路由](/guide/content-types)。
3. **设置元数据**：先写 `title` 与 `description`，再按类型补导航与时间字段；文章加 `category` 与 `tags`。写法见 [Frontmatter 与元数据](/guide/frontmatter-fields)。
4. **组织阅读**：把页面放进已有的 `collection` / `section`，用 `order` 固定顺序；文章选择单分类与多标签。见 [内容组织与排序](/guide/organizing-content)。
5. **写 Markdown**：用 h2–h4 组织正文，h1 由页面布局负责，不需要在正文里重复。
6. **本地检查**：运行 `npm run dev`，打开对应路由检查排版、导航与链接；提交前执行 typecheck 与站点 build。

一个最小文档：

```md
---
title: 编写内容
description: 使用 Folio 创建和维护内容。
group: 写作
collection: 指南
order: 11
type: doc
---

## 从这里开始

正文使用 Markdown 编写。
```

把文件放在 `content/guide/authoring.md`，最终路由是 `/guide/authoring`。

## 选择内容类型

三种类型的用途不同：

- `doc`：需要侧栏导航、连续阅读或父子层级的内容。
- `article`：按 `date` 发布、需要文章布局与归档入口的内容。
- `page`：不进入侧栏与分页的独立阅读材料，必须从至少一篇文档链入。

未写 `type` 时，`blogs/*` 推断为 `article`，其他目录推断为 `doc`。每种类型的布局与路径规则见 [内容类型与路由](/guide/content-types)。

## Frontmatter 写什么

完整的逐字段说明只维护在 [Frontmatter 参考](/reference/frontmatter)；这里只列写作时先要满足的条件：

- `title` 必填，作为页面、导航与 SEO 标题；`description` 写真实摘要。
- `type` 决定阅读布局；缺省时按目录推断。
- 文档用 `collection` / `section` 进入侧栏，`order` 默认 `99`。
- 文章写 `date` 参与倒序排列，再写一个 `category` 和若干 `tags` 作为归档入口。
- `author`、`cover`、`status` 等按站点约定添加；核心不认识的字段保留在 `doc.data`。

## 文件放在哪里

- `content/introduction.md` → `/introduction`
- `content/guide/start.md` → `/guide/start`
- `content/guide/index.md` → `/guide`

需要固定 URL 时，可以在 Frontmatter 里显式写 `path`。显式 `path` 同时决定导航树中的位置；移动文件会改变默认路由，搬动前先检查站内链接与外部引用。

## 组织与排序

侧栏位置由内容自己决定，而不是由代码维护：

```yaml
collection: 指南
section: 写作
order: 11
```

`collection` 决定侧栏，`section` 决定分组，`order` 决定组内顺序。文章按 `date` 倒序，独立页面不进入侧栏但必须从至少一篇文档链入。完整规则见 [内容组织与排序](/guide/organizing-content)。

文章的分类与标签是另一套归档维度：`category` 只写一个值，`tags` 可以写多个；两者都不改变文章 URL、不进入侧栏，也不替代 `collection` / `section`。归档入口与配置见 [内容组织与排序](/guide/organizing-content)。

## 发布前检查

- `title` 与 `description` 描述实际内容，不写营销口号。
- `type`、`group`、`order` 与所在分区一致。
- 文章只写一个 `category`，`tags` 先复用已有主题词。
- 内部链接使用以 `/` 开头的真实 route，移动页面后同步更新引用。
- 命令、字段与 API 名称对照当前源码，不把规划写成事实。
- 运行 `npm run validate`，或至少执行 site 的 typecheck 与 build。

新增或修改文档前，先读 [官方站点内容维护约定](/reference/content-maintenance)。

## 相关文档

- [内容类型与路由](/guide/content-types)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容组织与排序](/guide/organizing-content)
- [Markdown 写作](/guide/markdown-runtime)
- [Frontmatter 参考](/reference/frontmatter)
- [内容协议](/guide/content-contract)
