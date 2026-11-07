---
title: Frontmatter 与元数据
description: 标题、类型、分组、日期、作者与扩展字段的写法。
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

`title` 与 `description` 必填；其余字段按需要添加，不写的字段使用默认值。

## 字段分组

| 分组 | 字段 | 作用 |
| --- | --- | --- |
| 身份 | `id`、`path` | 稳定标识与显式路由 |
| 内容 | `type`、`title`、`description` | 类型、页面标题与摘要 |
| 导航 | `group`、`collection`、`section`、`order` | 侧栏归属、分组与顺序 |
| 时间 | `date`、`publishedAt`、`updatedAt`、`createdAt`、`createdBy`、`updatedBy` | 文章日期与署名时间 |
| 展示 | `tags`、`status`、`cover` | 标签、状态与分享图 |
| 扩展 | 任意其他键 | 保留在 `doc.data` |

完整默认值与类型规则见 [Frontmatter 参考](/reference/frontmatter)。这一页只说明写作时怎么选。

## 默认值

- `type`：按目录推断，`blogs/*` 为 `article`，`projects/*` 为 `project`，其他为 `doc`。
- `path`：由文件位置生成，`index.md` 映射到目录本身。
- `order`：默认 `99`。
- `group`：按类型生成，文章为「博客」，项目为「项目」，其他为「文档」。
- `tags`：空数组。

## 导航字段

`collection` 决定侧栏，`section` 决定分组，`order` 决定组内顺序。没有 `section` 时使用 `group` 作为分组标题。三者都写内容里，站点配置不需要重复维护。

```yaml
collection: 指南
section: 写作
order: 13
```

同一 `collection` 的页面进入同一个侧栏；不同 `collection` 可以共享路由目录，也可以跨越多个目录。组织方式见 [内容组织与排序](/guide/organizing-content)。

## 时间与作者

- `date` 用于文章排序，文章之间按日期倒序。
- `publishedAt` 是更明确的发布时间；显式值优先于 `date`。
- `createdAt`、`updatedAt`、`createdBy`、`updatedBy` 可由 Git 历史补齐，也可以逐项覆写。
- 没有可信来源时保持未定义，不生成伪造日期或作者。

`author` 支持字符串或对象：

```yaml
author:
  name: 编辑部
  avatar: /images/editorial.png
```

未写 `author` 时，署名栏回退到 Git 首次提交作者；两者都没有时不显示作者。日期、作者与阅读时长的展示规则见 [FolioDocMeta](/reference/components/doc-meta)。

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
- `status` 统一使用 `published`、`reference` 或 `active`。
- `tags` 先复用已有主题词，再考虑新增。
- 修改公开行为或字段时，同步更新对应文档。
- 已发布 `0.1.1` 与 `dev` 候选契约要分开说明；`collection`、`section`、日期字段属于当前 `dev` 候选。

## 相关文档

- [编写内容](/guide/authoring)
- [内容类型与路由](/guide/content-types)
- [内容组织与排序](/guide/organizing-content)
- [Frontmatter 参考](/reference/frontmatter)
