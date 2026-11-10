---
title: FolioDocMeta
description: 极简文章署名栏：头像、作者、日期和阅读时长；完整 Git 历史仍保留在 FolioDoc。
type: doc
collection: 参考
section: API
order: 43
status: draft
tags: [React, Metadata, Git, API]
---

`FolioDocMeta` 默认呈现一行轻量的文章信息：**作者头像 / 作者 / 日期 / 预计阅读时间**。没有双列卡片，也不会把每一项 Git 记录放到阅读页上。

示例：`[编] 编辑部 / 2026 年 11 月 5 日 / 约 6 分钟`

## 用途与导入

~~~tsx
import {
  FolioDocMeta,
  getFolioDocByline,
  getFolioDocMeta,
} from "@uichat-mira/folio";
~~~

组件、两个纯函数与 `FolioDocMetaProps` / `FolioDocByline` / `FolioDocMetaField` 类型都从包根导出，源码位于包内 `src/ui/doc-meta/` 与 `src/core/doc-meta.ts`。组件不依赖 Router，可以在任意 React 树中渲染。

## 最小示例

~~~tsx
import { FolioDocMeta, FolioMarkdown } from "@uichat-mira/folio";

<article>
  <h1>{doc.title}</h1>
  <FolioDocMeta doc={doc} className="my-document-meta" />
  <FolioMarkdown source={doc.body} options={{ removeH1: true }} />
</article>;
~~~

## 公共 Props 与默认值

~~~ts
type FolioDocMetaProps = {
  doc: Pick<
    FolioDoc,
    "data" | "body" | "createdBy" | "createdAt" | "publishedAt"
  >;
  className?: string;
};
~~~

| Prop | 默认 | 说明 |
| --- | --- | --- |
| `doc` | 必填 | 需要 Frontmatter 数据、正文，以及 `createdBy` / `createdAt` / `publishedAt` 三个字段；实际构建产物传整个 `FolioDoc` 即可 |
| `className` | 无 | 追加到基础类 `folio-doc-meta` 之后 |

当作者、日期、阅读时间全部无法确定时，组件返回 `null`，不会输出空容器。

## 署名数据来源

| 展示项 | 优先级 |
| --- | --- |
| 作者 | Frontmatter `author`（字符串或 `{ name, avatar }`，数组取第一项）→ `createdBy`；都没有则不显示作者 |
| 头像 | Frontmatter `author.avatar` → 与署名同名的 Git 首次提交作者 GitHub 头像 → 30px 方形首字头像 |
| 日期 | `publishedAt` → `createdAt`；按 UTC 格式化为 `YYYY 年 M 月 D 日`，同时输出 ISO `datetime` |
| 阅读时长 | 从正文估算；正文为空时不显示 |

阅读时长的规则是：忽略围栏代码块、行内代码、链接目标、URL、HTML 标签与 Markdown 标记后，按 CJK 字符数 ÷ 350 加其他单词数 ÷ 225 计算，向上取整且至少 1 分钟。它是估算值，不是精确统计。

## 完整 Git 历史仍保留在 FolioDoc

四个 Git 历史字段可以逐项被 Frontmatter 覆写，且不影响 `author`（作品署名）与 `publishedAt`（发表日期）的独立语义：

| 元数据 | Git 默认来源 | Frontmatter 覆写 |
| --- | --- | --- |
| `createdAt` | 首次提交时间 | `createdAt` |
| `updatedAt` | 最近提交时间 | `updatedAt` |
| `createdBy` | 首次提交作者 | `createdBy` |
| `updatedBy` | 最近提交作者 | `updatedBy` |

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

`getFolioDocMeta(doc)` 返回上述四项的 `{ key, label, value, dateTime? }` 列表，供“最后更新”等自定义 UI 使用；`FolioDocMeta` 本身只显示作者、日期与阅读时长，不渲染 `updatedAt` / `updatedBy`。

四项互不覆盖，`author` 与 `publishedAt` 也是独立字段。但署名日期在 `publishedAt` 缺失时会回退到 `createdAt`，因此覆写 `createdAt` 可能改变页面上显示的日期；需要固定发表日期时应写 `publishedAt`。

浅克隆缺少首次提交证据时不推断创建者和创建时间；文件尚未提交时不假造历史记录。Frontmatter 显式 `author` 与 Git 首次提交作者不是同一个名字时，不会把提交者头像冒充文章作者。

## 与 FolioApp / FolioDocumentBody 的组合

- 应用内由 `FolioDocumentBody` 自动渲染（它已内置 `<FolioDocMeta doc={doc} />`），文档页、文章页与独立 Page 都复用同一处；组件自身不需要 Router，也没有专用署名插槽。
- 在 `FolioApp` 中没有专用的署名插槽：需要完全不同署名时，自行组合本组件或 `getFolioDocByline`，不要覆写 `.folio-doc-meta` 内部选择器。
- 自建署名时使用 `getFolioDocByline(doc)`：它返回同一个 `{ author, date, readingMinutes }` 投影，React 与静态页共用。
- 静态输出使用 `renderFolioStaticDocMeta(doc)`（`@uichat-mira/folio/vite`），与 React 端消费同一个 byline 模型和 `<time datetime>`。
- 组件本身不访问 Git、文件系统或网络；Git 身份与头像在构建阶段写入 `FolioDoc.gitHistory`。

## React 与静态 HTML 边界

- React 端与预渲染静态页都由构建层提供数据；组件只做投影，不改变 `FolioDoc`。
- 静态页的署名 HTML 由 `renderFolioStaticDocMeta` 生成；自定义静态模板应调用它，而不是复制一份日期/阅读时长算法。
- 浏览器端不会请求 GitHub API，也不会公开提交邮箱。
- 构建层只对 GitHub 远端做有限次提交查询，单次子进程上限 5 秒；`FOLIO_GITHUB_AVATARS=0` 可完全关闭 API 查询（noreply 身份仍可离线解析）。无网、API 受限或账号不匹配时回退首字头像。

## 关键失败与限制

- 没有作者、没有可信日期且正文为空时返回 `null`；这是正常空态，不是错误。
- 头像只接受 `http(s)://` URL 或以单个 `/` 开头的站点路径；`//` 协议相对地址与 `data:` 会被忽略，回退首字。
- 只有署名姓名与 Git 首次提交作者同名时才使用该提交者的 GitHub 头像。
- `FolioDocMetaProps` 的 `Pick` 不含 `gitHistory`；要获得 Git 头像，传入的对象仍需带 `gitHistory`（实际构建产物传完整 `FolioDoc` 即可）。
- 不显示 `updatedAt` / `updatedBy`；需要“最后更新”请用 `getFolioDocMeta`。
- 阅读时长忽略代码，可能与页面字数统计不一致，也不代表实际阅读速度。
- 组件不做作者身份认证；Git 作者只是提交历史证据。

## 版本与状态

- 本文按 `dev` 源码 `packages/folio/src/ui/doc-meta/DocMeta.tsx`、`core/doc-meta.ts`（base `f49557c`）核对。
- npm `0.1.1` **不含** `FolioDocMeta`、`getFolioDocByline`、`getFolioDocMeta`；该版本的阅读页也不显示作者、日期与阅读时长。
- 页面状态保持 `draft`：组件与数据模型尚未进入发布版本。

## 延伸阅读

- [Frontmatter 与元数据](/guide/frontmatter-fields)
- [Frontmatter 参考](/reference/frontmatter)
- [FolioDocsShell](/reference/components/docs-shell)
- [静态发布不是只产出一个 SPA 壳](/guide/static-publishing)
