---
title: 内容协议
description: Markdown、YAML Frontmatter 与 FolioDoc 共同依赖的最小稳定契约，以及 0.1.1 与 dev 的字段边界。
group: 开始
collection: 指南
order: 4
type: doc
status: published
tags:
  - FolioDoc
  - Frontmatter
  - Markdown
---

这一页定义内容文件的**最小稳定契约**：文件如何变成路由、哪些 Frontmatter 字段有公共语义、扩展字段放在哪里。安装与接入见[快速开始](/guide/getting-started)，写作流程见[编写内容](/guide/authoring)，完整字段表见 [Frontmatter 参考](/reference/frontmatter)。

## 最小内容文件

每篇内容是一个带 YAML Frontmatter 的 Markdown 文件。Folio 把文件解析成 `FolioDoc`，React runtime、虚拟内容清单和静态构建消费同一份数据。

```md
---
title: 你好，Folio
description: 站点里的第一篇文档。
type: doc
group: 开始
order: 1
---

## 正文

Markdown 写在这里。
```

`title` 与 `description` 是必填信息；其余字段按需要添加，不写的字段使用默认值。

## 文件到路由

内容根目录下的相对路径决定默认路由，扩展名与结尾的 `index` 会被去掉：

```text
hello.md               → /hello
guide/hello.md         → /guide/hello
guide/index.md         → /guide
```

Frontmatter 的 `path` 可以覆盖默认 URL。两条内容路由相同时，静态构建会直接报错，而不是静默覆盖。

## Frontmatter 核心字段

| 字段 | 作用 | 默认值 |
| --- | --- | --- |
| `title` | 页面、导航与 SEO 标题 | 必填 |
| `description` | 摘要与 metadata | 必填 |
| `type` | `doc`、`article`、`page`；决定阅读布局 | 按目录推断 |
| `group` | 侧栏分组标题的后备值 | 按类型生成；文章默认为「博客」 |
| `collection` | 文档侧栏的集合标题；同一 collection 的文档进入同一侧栏 | 「文档」 |
| `section` | 侧栏内的分组标题 | 回退到 `group` |
| `order` | 组内排序；数字越小越靠前 | `99` |
| `date` | 文章日期；文章之间优先按日期倒序 | 无 |
| `tags` | 标签列表 | `[]` |
| `status` | 内容状态，透传给 `FolioDoc` | 无 |
| `cover` | 分享图与封面 | 无 |
| `path` | 覆盖由文件位置生成的路由 | 文件路径 |
| `id` | 稳定标识 | 由路由生成 |

`collection` 与 `section` 只影响文档侧栏的组织，不改变 URL；它们也是已发布 `0.1.1` 就支持的字段。`type` 决定阅读布局：`doc` 使用文档壳，`article` 使用文章布局，`page` 使用普通页面。

## 类型推断

- 当前 `dev` 源码：`blogs/*` 推断为 `article`，其他目录（包括 `projects/*`）推断为 `doc`。
- 已发布 `0.1.1`：`blogs/*` 推断为 `article`，`projects/*` 推断为 `project`，其他目录为 `doc`。

升级或对照版本时以这里为准；新内容建议显式写 `type`，不要依赖目录推断。

## 排序与分组

- 文档按 `order` 升序，再按路径排序；
- 文章之间先按 `date` 倒序，再按 `order`；
- 侧栏先按 `collection` 分集合，再按 `section`（缺省时 `group`）分组；
- 静态输出与 React runtime 使用同一套排序和分组结果。

导航配置、首页与集合索引属于站点配置，不在内容文件里重复定义，见[站点配置与扩展](/guide/configuration)。

## 扩展字段

核心不认识的 Frontmatter 字段不会丢失，而是保存在 `doc.data` 中。官方站用 `surface`、`contract` 和 `private_imports` 证明 consumer 可以增加自己的元数据，而无需扩展 Folio 核心类型。

扩展字段属于 consumer 契约。若某个字段影响渲染或构建，应同时在 consumer 代码和内容维护说明中写清用途与默认值；不要假设其他站点理解同名扩展字段。

## 版本边界

以下差异来自已发布 `0.1.1` 与当前 `dev` 源码的实际实现，写 consumer 内容时必须区分：

| 能力 | 已发布 `0.1.1` | 当前 `dev` |
| --- | --- | --- |
| `publishedAt`、`updatedAt`、`dateSources` | 不支持 | 支持，属于日期契约候选 |
| `projects/*` 类型推断 | 推断为 `project` | 推断为 `doc` |
| `config.collections`、`config.home`、collection archive | 不支持 | 候选配置 |
| 结构化导航与扩展 slots | 仅 `label`/`href` 与基础 slots | 另有 `children`、`panel`、`activeMatch` 等候选 |

公开包的完整边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。不要把 `dev` 候选字段复制到 `0.1.1` 项目，也不要把本文的 `dev` 行为描述成已发布能力。

## 渲染边界

Folio 渲染的是站点所有者审核过的受信任 Markdown：原始 HTML、`::: html` 块与 Callout 正文会原样保留，不做消毒。未经审核的用户投稿、抓取内容或外部 PR 预览不应进入渲染器。完整安全边界与样式表行为见消费者契约的 Markdown 与 Styles 章节。

## 相关文档

- [编写内容](/guide/authoring)
- [内容模型](/guide/content-model)
- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [导航与内容清单](/guide/navigation)
- [首个可运行站点](/guide/first-site)
