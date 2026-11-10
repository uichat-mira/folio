---
title: FolioMarkdown
description: 从字符串渲染 Markdown 的公开 React 组件：Props、标题锚点、Mermaid 增强与安全边界。
type: doc
collection: 参考
section: API
order: 60
status: draft
tags: [Markdown, React, Rendering, Security]
---

`FolioMarkdown` 从字符串渲染内容，使用与静态构建相同的 `renderFolioMarkdown()`，内置标题锚点、代码高亮、GFM 与已集成的 Markdown 扩展。

## 版本与发布状态

`FolioMarkdown` 与 `FolioMarkdownRenderOptions` 已包含在 npm 发布版 `0.1.1`（Git tag `folio-v0.1.1`）中；当前 `dev` 把实现文件从 `src/markdown.ts` 移到 `src/core/markdown.ts`，但渲染逻辑与公开 Props 一致。页面本身随当前 `dev` 文档批次新增，因此保持 `status: draft`；组件能力已发布。本页适用于 `0.1.1` 及当前 `dev`。

## 导入与最小用法

~~~tsx
import { FolioMarkdown } from "@uichat-mira/folio";

<FolioMarkdown source={"## 二级标题\n\n正文内容。"} />;
~~~

组件渲染一个 `<article class="folio-markdown">`，其余合法 HTML 属性会转发到该元素。它不使用 React 子节点，正文通过 `dangerouslySetInnerHTML` 注入 `renderFolioMarkdown()` 生成的 HTML。

## 公开 Props

~~~ts
type FolioMarkdownProps = {
  source: string;
  options?: FolioMarkdownRenderOptions;
  className?: string; // 默认 "folio-markdown"
} & Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML">;

type FolioMarkdownRenderOptions = {
  removeH1?: boolean; // 默认 false
  headingAnchors?: boolean; // 默认 true
};
~~~

- `source` 必填；内容变化时重新渲染。
- `options.removeH1` 为真时移除正文中的 ATX 一级标题（`# ` 行），代码块内的 `#` 不受影响；阅读布局通常用它避免与页面标题重复。
- `options.headingAnchors` 为 `false` 时，不生成 h2–h4 的 `id` 与 `#` 锚点链接；默认为 `true`。如果同时使用 [FolioToc](/reference/components/toc)，应保持开启，否则目录链接没有目标。
- `className` 替换默认的 `folio-markdown`；传入其他 HTML 属性（`id`、`lang`、`dir`、`style`、事件处理器等）会应用到根 `<article>`。`children` 与 `dangerouslySetInnerHTML` 被类型排除。

## 渲染行为

- 使用 `marked` 的 GFM 模式：表格、任务列表、删除线等按 GFM 输出。
- 代码块使用 highlight.js 高亮；未标注语言时回退到自动检测。带 `mermaid` 标记的代码块不按普通代码高亮，而是保留源码并加上 `data-mermaid` 占位。
- 支持 `::: tip / info / note / warning / danger` Callout，正文继续按 Markdown 解析，标题使用固定中文标签。
- h2–h4 在默认设置下生成稳定、去重的锚点；显式 HTML 标题的 `id` 会被保留并优先占位，后续自动生成的重复 id 会加后缀。h1、h5、h6 不参与目录锚点。
- 标题锚点链接是 `<a class="md-anchor" href="#id" aria-label="链接到 …">#</a>`，属于正文内的普通 hash 链接。
- `::: html` 块与 Markdown 中的原始 HTML 会原样插入输出，详见下面的安全边界。

## 无障碍与移动端

- h2–h4 的 `#` 锚点带有 `aria-label="链接到 …"`，键盘可聚焦；标题层级仍由作者负责，组件不会修正跳级标题。
- 组件没有移动端专用布局或视口判断，宽度由消费站 CSS 决定；Markdown 表格在窄屏的换行/横向滚动也由站点样式负责。
- Mermaid 生成的 SVG 的可访问文本由 Mermaid 输出决定，Folio 不额外补充图注或替代文本；关键信息应同时写在正文中。

## 安全边界（重要）

`FolioMarkdown` **不是 HTML 清理器**。当前实现：

- 原样保留 Markdown 中的原始 HTML 与 `::: html` 块；
- Callout 正文可以继续包含 Markdown 与 HTML；
- 不清理 `javascript:` 等链接协议，也不做属性白名单；
- 通过 `dangerouslySetInnerHTML` 注入最终 HTML。

因此只应渲染**经过审核并已合并的仓库内容**。不要把未经审核的投稿、抓取页面、外部 PR 预览或用户输入直接交给 `FolioMarkdown`。需要渲染不可信内容时，必须在调用前使用独立的安全清理方案，并自行承担链接、图片与事件属性策略；Folio 0.1.x 不提供该保证。更完整的写作约定见 [Markdown 写作](/guide/markdown-runtime)。

## Mermaid：仅浏览器增强

页面挂载后，组件会动态导入 `mermaid`，查找容器内带 `data-mermaid` 的节点并渲染为 SVG：

- `securityLevel` 固定为 `"strict"`；源码同时以转义后的 `<pre class="markdown-mermaid-source">` 保留，渲染失败时不会丢内容。
- 主题跟随 `document.documentElement.dataset.folioTheme`；主题变化会被 `MutationObserver` 捕获并重新渲染。
- 渲染失败或 Mermaid 运行时加载失败只在控制台输出警告，不会让 React 抛错或清空正文。
- 动态导入与 DOM 扫描只在浏览器 `useEffect` 中执行；服务端渲染与静态构建不会执行它。

这意味着无 JS 的静态页面只有 Mermaid 源码回退，**不会**有预生成的 SVG；Mermaid 是渐进增强，不是构建期图形生成。

## React 与无 JS 静态边界

React 阅读页和静态输出共用 `renderFolioMarkdown()`，因此同一份 Markdown 生成相同的 HTML 结构（标题、Callout、代码高亮、Mermaid 源码块）。区别在于：

- `FolioMarkdown` 是客户端组件，会执行 Mermaid 增强并处理主题变化；
- 静态构建直接调用 `renderFolioMarkdown()`，没有 Mermaid 运行时、没有浏览器事件，也没有 `FolioMarkdown` 的 HTML 属性转发；
- 自定义静态渲染器应复用同一函数，而不是另写 Markdown 管线：

~~~ts
import { renderFolioMarkdown } from "@uichat-mira/folio";

const html = renderFolioMarkdown(source, {
  removeH1: true,
  headingAnchors: true,
});
~~~

`FolioMarkdown` 是阅读组件，不是可视化 Markdown 编辑器，也不负责内容审核、链接校验或 Sanitizer。实际阅读布局由 [FolioDocsShell](/reference/components/docs-shell) 组织，正文由 `FolioDocumentBody` 组合标题、摘要与元信息。
