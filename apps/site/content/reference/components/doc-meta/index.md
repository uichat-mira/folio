---
title: FolioDocMeta
description: 极简文章署名栏：头像、作者、日期和阅读时长；保留完整 Git 历史元数据。
type: doc
collection: 参考
section: API
order: 43
status: draft
tags: [React, Metadata, Git, API]
---

`FolioDocMeta` 默认呈现一行轻量的文章信息：**作者头像 / 作者 / 日期 / 预计阅读时间**。没有双列卡片，也不会把每一项 Git 记录放到阅读页上。

示例：`[编] 编辑部 / 2026 年 11 月 5 日 / 约 6 分钟`

- 作者优先使用 Frontmatter 的 `author`，否则使用 Git 首次提交作者（`createdBy`）；没有任何姓名时不杜撰作者。
- 日期优先使用 `publishedAt`，否则使用 `createdAt`；不知道时不杜撰日期，且不使用构建时刻或文件 `mtime`。
- 阅读时长根据正文估算（汉字每分钟约 350 字、其他文本约 225 词），忽略 Markdown 代码块；正文为空时不显示。
- 头像优先使用 Frontmatter 显式图片；对于可确认身份的 GitHub 首次提交作者，自动使用 GitHub 头像；其余情况回退为 30px 方形首字头像。无需人物目录或 Gravatar。
- 没有作者和可信日期时，有正文仍独立显示阅读时间；三者均不存在时不输出空白署名栏。

## 零配置与 Frontmatter

四个 Git 历史字段仍然完整保存在 `FolioDoc`：

| 元数据 | Git 默认来源 | Frontmatter 覆写 |
| --- | --- | --- |
| `createdAt` | 首次提交时间 | `createdAt` |
| `updatedAt` | 最近提交时间 | `updatedAt` |
| `createdBy` | 首次提交作者 | `createdBy` |
| `updatedBy` | 最近提交作者 | `updatedBy` |

它们可以逐项覆写，不影响 `author`（作品署名）与 `publishedAt`（发表日期）的独立语义。浅克隆缺少首次提交证据时不推断创建者和创建时间；文件尚未提交时不假造历史记录。

~~~yaml
---
title: 内容协议
author:
  name: 编辑部
  avatar: /images/editorial.png
publishedAt: 2026-11-05
createdAt: 2024-06-01
createdBy: Mira
updatedBy: Folio Maintainers
---
正文……
~~~

`avatar` 可使用以 `/` 开头的站点路径或 `http(s)` 图片 URL（项目子路径部署时应提供可正确解析的 URL）。未设置 `author` 时，`createdBy` 会作为默认显示姓名；若显式 `author` 与 Git 首次提交作者不是同一个名字，不会将提交者头像冒充文章作者。

## 文档主体默认集成

`FolioDocumentBody` 将标题、摘要、`FolioDocMeta` 与 Markdown 正文组合为统一阅读主体。文章页、文档页和项目页通过各自的外围布局复用它，无需逐篇添加元信息组件。示例站的静态预渲染也通过 `renderFolioStaticDocumentBody` 复用相同结构，保留 Git/Frontmatter 优先级。

## 独立组合

~~~tsx
import {
  FolioDocMeta,
  getFolioDocByline,
  getFolioDocMeta,
} from "@uichat-mira/folio";

<FolioDocMeta doc={currentDoc} className="my-document-meta" />;

// 对应单行展示的数据
const byline = getFolioDocByline(currentDoc);
// 完整四项历史字段仍供其他功能消费
const historyFields = getFolioDocMeta(currentDoc);
~~~

React 阅读页与预渲染静态页消费同一个 `getFolioDocByline` 模型；自定义静态模板可以从 `@uichat-mira/folio/vite` 调用 `renderFolioStaticDocMeta(doc)`。两端都使用 `<time>` 保留准确的 ISO 日期。组件本身不访问 Git、文件系统或网络。构建层可识别 GitHub noreply 邮箱，或向 GitHub 查询有限数量的提交 SHA 来核实作者身份；不会在浏览器请求 GitHub API，也不会公开提交邮箱。无网、API 受限或账号不匹配时回退首字。可设置 `FOLIO_GITHUB_AVATARS=0` 禁用 API 查询（仍支持 noreply 身份）。

**设计边界：** 它是文章署名，不是员工档案。Git 作者只是提交历史证据，不等于平台身份认证或真实作品作者；完整历史字段可以由消费站在其他位置展示。
