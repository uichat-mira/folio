---
title: 内容组织与排序
description: 用 collection、section 与 order 组织侧栏与阅读顺序，并区分 Article 的 category 与 tags。
group: 写作
collection: 指南
order: 14
type: doc
status: published
tags:
  - Navigation
  - Content
  - Authoring
---

Folio 的内容组织写在 Frontmatter 里，而不是写死在站点代码里。改导航时不需要搬动文件；搬动文件时才需要同步修改链接。

这一页回答“页面放在哪、按什么顺序、文章如何归类”；字段写法见 [Frontmatter 与元数据](/guide/frontmatter-fields)，解析事实见 [内容模型](/guide/content-model)。

## 三层归属

| 层 | 写在哪里 | 决定什么 |
| --- | --- | --- |
| `collection` | 页面 Frontmatter | 进入哪个文档侧栏 |
| `section` | 页面 Frontmatter | 侧栏中的哪个分组 |
| `order` | 页面 Frontmatter | 分组内的阅读顺序 |

没有 `section` 时，`group` 作为分组标题。没有 `collection` 的页面回落到字面量「文档」。

## 一个例子

```yaml
---
title: 编写内容
description: 写作流程与发布前检查。
group: 写作
collection: 指南
section: 写作
order: 11
type: doc
---
```

侧栏会按 `collection` 与 `section` 聚合：

```text
指南
├─ 开始
│  ├─ Folio 是什么
│  ├─ 快速开始
│  └─ 内容协议
└─ 写作
   ├─ 编写内容
   ├─ 内容类型与路由
   ├─ Frontmatter 与元数据
   ├─ 内容组织与排序
   └─ Markdown 写作
```

## 排序规则

- `doc`：按 `order` 升序；相同 `order` 按路由字典序。
- `article`：按 `date` 倒序优先，再按 `order`；没有 `date` 的文章排在后面。
- 隐式目录（没有 `index.md` 的目录）：使用子节点最小的 `order`。
- 排序值相同不保证编辑顺序，建议留出间隔：`10`、`20`、`30`，避免插入时重排整组。

文章排序只读取 `date`。`publishedAt` 是可信发布时间的补充（dev），用于结构化数据与署名，不改变文章顺序。

## 不可互换的组织概念

`collection`、`section`、`group`、`category`、`tags` 不是同一套东西，互相替代会产生错误的结构：

| 概念 | 值 | 作用 | 改变路由？ |
| --- | --- | --- | --- |
| `collection` | 字符串，可缺省 | 文档侧栏的第一层归属 | 否 |
| `section` | 字符串，可缺省 | 侧栏分组；缺省时用 `group` | 否 |
| `group` | 字符串，可缺省 | 工具条 eyebrow、卡片与摘要的分组展示；也是 `section` 的默认标题 | 否 |
| `category` | 单个非空字符串（dev） | Article 的分类归档身份 | 否 |
| `tags` | 零到多个字符串 | 搜索文本与 Article 的标签归档 | 否 |
| `order` | 数字 | 组内顺序 | 否 |
| `date` | 字符串 | 文章倒序 | 否 |

- `collection` / `section` 组成文档阅读骨架；`category` / `tags` 组成 Article 的归档入口。写 `category` 不会产生栏目、侧栏节点或路由目录，也不会把文章塞进文档侧栏。
- `group` 不是 `collection` 的别名：它只是展示标签与 `section` 的缺省标题。
- `category` 只能有一个值，`tags` 可以有多个。
- 归档维度只对 `type: article` 生效；`doc` 与 `page` 不进入分类/标签归档。
- 这些字段都不改变 `doc.path`。需要改路由时用显式 `path` 或移动文件。

## Article 归档怎么工作（dev）

集合在站点配置里显式开启归档后，Folio 从同一批 `FolioDoc` 派生路由，而不是要求手写标签页：

```ts
collections: [
  { path: "/blogs", title: "博客", archive: true },
];
```

- 生成 `<collection>/category/<slug>` 与 `<collection>/tag/<slug>`；官方站 `/blogs` 已开启，例如 `/blogs/category/工程实践`、`/blogs/tag/git`。
- 集合索引页出现一行「分类」入口；文章卡片与文章元信息区的标签变成链接。归档入口不会注入全局顶部导航。
- 归档身份来自 Frontmatter 值：NFC、去首尾空白、合并空白并忽略 ASCII 大小写（`Frontend` / `frontend` 合并），中文保留。
- `slug` 复用站点的 `slugify`：中文保留、ASCII 小写、标点剥离；非 ASCII 段在请求 URL 中会被百分号编码。
- 未知 slug 进入正常 404；两个不同身份折叠到同一 slug（如 `C++` / `C#`）会让构建失败，而不是偷偷共用一个归档。
- 分类显示名可以通过集合配置的 `categoryLabels` 覆盖，只改变显示标题，不改变 URL。
- 归档不提供多级分类、栏目树、多选筛选、标签云或分页。

归档能力属于当前 `dev` 源码（FOL-040 / FOL-041），尚未包含在已发布的 `0.1.1` 中。只用 `0.1.1` 的站点不会得到这些路由，需要自己从内容清单派生或升级版本。

## 与站点配置的区别

几个概念容易混：

- `collection` / `section`：写在内容里，决定**文档侧栏**。
- `config.collections`：写在站点配置里，决定**集合索引页**与是否生成归档（`archive`）。
- `config.navigation`：写在站点配置里，决定**顶部入口与高亮**。

它们可以同名对齐，也可以独立变化。站点配置不覆盖页面里的 `collection`。

## 文章与独立页面

文章按日期排序，不进入文档侧栏；它的入口通常来自集合索引页、首页或文章之间的链接。开启归档的集合还会提供分类行与标签链接。

独立页面不参与侧栏与分页，但必须从至少一篇文档链入。

## 检查清单

- 新增页面复用了已有 `collection` 与 `section`。
- `order` 与相邻页面保持间隔，不为了插入而整组重排。
- 文章写了 `date`，文档没有误用日期排序。
- 文章只写一个 `category`，`tags` 复用已有主题词。
- 分类/标签没有当栏目或路由目录使用。
- 独立页面至少有一个文档入口。
- 页面移动后更新站内链接与外部引用。

## 相关文档

- [编写内容](/guide/authoring)
- [内容类型与路由](/guide/content-types)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [内容模型](/guide/content-model)
- [导航与内容清单](/guide/navigation)
