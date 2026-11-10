---
title: Frontmatter 与元数据
description: 完整示例、导航字段、日期与作者，以及 Article 的单分类与多标签。
group: 写作
collection: 指南
order: 13
type: doc
status: published
tags:
  - Frontmatter
  - Metadata
  - Authoring
---

Frontmatter 是 Folio 唯一的内容元数据层。标题、导航位置、排序、日期、作者与分享图都写在这里，页面正文只负责内容本身。

这一页讲怎么写、怎么选；逐字段的默认值与类型规则以 [Frontmatter 参考](/reference/frontmatter) 为准。

## 一个完整示例

```yaml
---
title: 部署到 GitHub Pages
description: 处理项目子路径与发布工作流。
type: doc
group: 部署
collection: 参考
section: 部署
order: 50
date: 2026-11-01
tags:
  - Deployment
  - GitHub Pages
status: published
cover: /images/github-pages.png
author:
  name: 编辑部
  avatar: /images/editorial.png
surface: handbook
---
```

`title` 是 schema 必填字段；`description` 建议始终填写，缺省时为空字符串。其余字段按需要添加，不写的字段使用默认值。

## 字段分组

| 分组 | 字段 | 作用 |
| --- | --- | --- |
| 身份 | `id`、`path` | 稳定标识与显式路由 |
| 内容 | `type`、`title`、`description` | 类型、页面标题与摘要 |
| 导航 | `group`、`collection`、`section`、`order` | 侧栏归属、分组与顺序 |
| 时间 | `date`；`publishedAt`、`updatedAt`、`createdAt`、`createdBy`、`updatedBy` | 文章日期与可信时间、署名（后五项为 dev） |
| 归档 | `category`（dev）、`tags` | Article 的单分类与多标签 |
| 展示 | `status`、`cover` | 状态与分享图 |
| 扩展 | 任意其他键 | 保留在 `doc.data` |

完整默认值与类型规则见 [Frontmatter 参考](/reference/frontmatter)。这一页只说明写作时怎么选。

## 默认值

- `type`：按目录推断，`blogs/*` 为 `article`，其他目录为 `doc`。
- `path`：由文件位置生成，`index.md` 映射到目录本身；`id` 由 `path` 生成。
- `order`：默认 `99`。
- `group`：按类型生成，文章为「博客」，其余默认为「文档」。
- `tags`：空数组；`category`：未设置即「未分类」（dev）。
- `status`、`cover`：未设置。

## 导航字段

`collection` 决定文档侧栏，`section` 决定侧栏分组，`order` 决定组内顺序。没有 `section` 时使用 `group` 作为分组标题。三者都写在内容里，站点配置不需要重复维护。

```yaml
collection: 指南
section: 写作
order: 13
```

同一 `collection` 的页面进入同一个侧栏；不同 `collection` 可以共享路由目录，也可以跨越多个目录。组织方式见 [内容组织与排序](/guide/organizing-content)。

`group` 还用于文档工具条的 eyebrow、首页卡片与搜索结果摘要，它不是 `collection` 的别名，也不是归档分类。

## 分类与标签（Article，dev）

`category` 与 `tags` 是 Article 的归档维度，不参与文档侧栏：

```yaml
---
title: 为什么内容要留在 Git
description: 从评审、发布和回滚三个动作解释 Git-native 内容源。
type: article
date: 2026-11-04
category: 工程实践
tags:
  - Git
  - Content
---
```

- `category` 只接受一个非空字符串；数组、数字、布尔值与空字符串都按「未分类」处理。
- `tags` 推荐写成数组；`|`、`,` 或 `，` 分隔的单个字符串是兼容写法。
- 只有 `type: article` 进入分类/标签归档；`doc` 与 `page` 不参与。
- 集合在站点配置中写了 `archive: true` 才会生成 `<collection>/category/<slug>` 与 `<collection>/tag/<slug>`；官方站 `/blogs` 已开启。
- 归档身份来自 Frontmatter 值：NFC、去首尾空白、合并空白，并忽略 ASCII 大小写（`Frontend` 与 `frontend` 是同一个归档），中文原样保留。显示名可以单独配置，但不改变归档 URL。
- 这些字段与归档能力属于当前 `dev` 源码（FOL-040 / FOL-041），尚未包含在已发布的 `0.1.1` 中。

分类、标签与 `collection` / `section` / `group` 的区别见 [内容组织与排序](/guide/organizing-content)。

## 时间与作者

- `date`：文章排序字段，按字符串倒序；`doc.date` 原样保留。文章排序**不读取** `publishedAt`。
- `publishedAt`（dev）：更明确的发布时间；显式值优先于 `date`。只接受 `YYYY-MM-DD` 或带 `Z`/时区偏移的 ISO 8601；没有时区的时间会被忽略，交由下一个可信来源填写。
- `updatedAt`（dev）：优先显式值；否则取文件最近一次 Git 提交。
- `createdAt`、`createdBy`、`updatedBy`（dev）：可由 Git 历史补齐，也可以逐项覆写；浅克隆下首次提交不可信，`publishedAt` 会保持未定义。
- `dateSources`（dev）：记录每个日期的来源（`frontmatter`、`legacy-date`、`git-first-commit`、`git-last-commit` 或 `unknown`）。
- 没有可信来源时保持未定义，不生成伪造日期或作者。

`author` 支持字符串、对象或数组（署名取第一个）：

```yaml
author:
  name: 编辑部
  avatar: /images/editorial.png
```

`author` 不是核心类型字段，写入后保留在 `doc.data`；官方站的署名栏与结构化数据在 `dev` 中读取它。未写 `author` 时，署名回退到 Git 首次提交作者；两者都没有时不显示作者。日期、作者与阅读时长的展示规则见 [FolioDocMeta](/reference/components/doc-meta)。

## 扩展字段

核心不认识的字段不会丢失，而是保存在 `doc.data`：

```yaml
surface: handbook
```

```ts
doc.data.surface; // "handbook"
```

扩展字段属于站点自己的契约。若某个字段影响渲染或构建，应在站点代码与 [官方站点内容维护约定](/reference/content-maintenance) 中同时说明用途。

## 写作建议

- `title`、`description` 描述实际内容，不写营销口号。
- `status` 按站点约定统一取值，官方站使用 `published`、`reference` 或 `active`。
- `tags` 先复用已有主题词，再考虑新增。
- 文章只写一个 `category`；分类应表达归档主题，不要拿它当栏目或路由目录。
- 修改公开行为或字段时，同步更新对应文档。
- 已发布 `0.1.1` 与 `dev` 候选契约要分开说明：`collection`、`section`、`date`、`tags` 在 `0.1.1` 中已可用；`category`、`publishedAt`、`updatedAt`、`createdAt`、`createdBy`、`updatedBy`、`dateSources` 以及分类/标签归档是当前 `dev` 源码中的候选能力。

## 相关文档

- [编写内容](/guide/authoring)
- [内容类型与路由](/guide/content-types)
- [内容组织与排序](/guide/organizing-content)
- [内容模型](/guide/content-model)
- [Frontmatter 参考](/reference/frontmatter)
