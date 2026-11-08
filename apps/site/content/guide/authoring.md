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

写一篇内容只需要三步：选类型、写 Frontmatter、写正文。

## 写作流程

1. 在 `content/` 下新建 `.md` 文件。
2. 写 `title` 与 `description`，按需补充 `type`、`collection`、`section`、`order` 等字段。
3. 用 h2–h4 组织正文；h1 由页面布局负责，不需要在正文里重复。
4. 运行 `npm run dev`，打开对应路由检查排版、导航与链接。

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

| 类型 | 适合写什么 | 阅读布局 |
| --- | --- | --- |
| `doc` | 文档、指南、参考 | 左侧导航 + 页内目录 |
| `article` | 博客、按日期阅读的长文 | 文章布局 + 页内目录 |
| `page` | 独立案例、附录、自定义页面 | 普通页面，无侧栏 |

未写 `type` 时，`blogs/*` 推断为 `article`，其他目录（包括 `projects/*`）推断为 `doc`。每种类型的布局差异与路由规则见 [内容类型与路由](/guide/content-types)。

## Frontmatter 写什么

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `title` | 是 | 页面、导航与 SEO 标题 |
| `description` | 是 | 摘要与 metadata |
| `type` | 推荐 | 决定阅读布局；缺省按目录推断 |
| `group` | 推荐 | 侧栏分组；没有 `section` 时作为分组标题 |
| `collection` / `section` | 按需 | 侧栏归属与分组 |
| `order` | 推荐 | 组内排序，默认 99 |
| `date` | 文章需要 | 文章之间按日期倒序 |
| `tags` | 推荐 | 搜索与主题归类 |
| `status` | 推荐 | `published`、`reference` 或 `active` |
| `cover` | 按需 | 分享图与封面 |
| `author` | 按需 | 署名；缺省使用 Git 首次提交作者 |
| 其他字段 | 否 | 保留在 `doc.data`，由站点自行解释 |

字段默认值、类型推断与日期来源见 [Frontmatter 与元数据](/guide/frontmatter-fields) 和 [Frontmatter 参考](/reference/frontmatter)。

## 文件放在哪里

- `content/introduction.md` → `/introduction`
- `content/guide/start.md` → `/guide/start`
- `content/guide/index.md` → `/guide`

需要固定 URL 时，可以在 Frontmatter 里显式写 `path`。移动文件会改变默认路由，搬动前先检查站内链接与外部引用。

## 组织与排序

侧栏位置由内容自己决定，而不是由代码维护：

```yaml
collection: 指南
section: 写作
order: 11
```

`collection` 决定侧栏，`section` 决定分组，`order` 决定组内顺序。文章按 `date` 倒序，独立页面不进入侧栏但必须从至少一篇文档链入。完整规则见 [内容组织与排序](/guide/organizing-content)。

## 发布前检查

- `title` 与 `description` 描述实际内容，不写营销口号。
- `type`、`group`、`order` 与所在分区一致。
- 内部链接使用以 `/` 开头的真实 route，移动页面后同步更新引用。
- 命令、字段与 API 名称对照当前源码，不把规划写成事实。
- 运行 `npm run validate`，或至少执行 site 的 typecheck 与 build。

新增或修改文档前，先读 [官方站点内容维护约定](/reference/content-maintenance)。

## 相关文档

- [内容类型与路由](/guide/content-types)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容组织与排序](/guide/organizing-content)
- [Markdown 写作](/guide/markdown-runtime)
- [内容协议](/guide/content-contract)
