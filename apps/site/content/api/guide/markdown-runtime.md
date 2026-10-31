---
title: Markdown Runtime
path: /api/guide/markdown-runtime
description: Folio 自带的 GFM、代码高亮、Callout、表格与 Mermaid 渲染能力。
group: Folio API · 快速开始
order: 13
type: doc
status: published
tags:
  - Markdown
  - Mermaid
  - Highlight
---

Folio 的文档页面直接使用 `FolioMarkdown`。这页就是运行时能力的 dogfood。

::: warning 只渲染可信仓库内容
Folio 0.1.0 会原样保留 Markdown 里的原始 HTML、HTML 专用块与 Callout 正文，不做 HTML 清理，也不过滤 `javascript:` 链接。只应渲染经过审核并已合并的仓库内容；未经审核的投稿、抓取页面或外部 PR 预览不能直接交给当前渲染器。
:::

::: tip
`FolioApp` 与 consumer 直接使用同一个 `renderFolioMarkdown()` contract，不再各自调用 `marked.parse()`。
:::

::: warning
Mermaid 使用 `securityLevel: strict`。渲染失败时不会吞掉内容，而是保留可读源码。
:::

## GFM 表格

| 能力 | 状态 |
| --- | --- |
| GFM table | 内置 |
| Syntax highlight | highlight.js |
| Mermaid | 浏览器端动态增强 |
| Callout | tip / info / note / warning / danger |

## 代码高亮

```ts
export function hello(name: string) {
  return `Hello, ${name}`;
}
```

## Mermaid

```mermaid
flowchart LR
  A[Markdown] --> B[Folio engine]
  B --> C[Semantic HTML]
  C --> D[Design system]
  C --> E[Mermaid enhancement]
```

## 失败语义

Mermaid 是 progressive enhancement：HTML 中始终先保留源码 fallback；浏览器加载 Mermaid 成功后再替换为 SVG。

安全、样式与静态能力的完整消费者边界见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。
