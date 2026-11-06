---
title: FolioMarkdown
description: Folio 公开 Markdown 阅读组件及构建时/运行时的渲染能力边界。
type: project
order: 60
status: draft
tags: [Markdown, React, Rendering]
---

`FolioMarkdown` 从字符串渲染内容，内置标题锚点、代码高亮和已集成的 Markdown 扩展。

## Props

~~~ts
type FolioMarkdownProps = {
  source: string;
  options?: FolioMarkdownRenderOptions;
  className?: string;
  // 以及除 children 和 dangerouslySetInnerHTML 之外的 HTMLAttributes
};
~~~

~~~tsx
import { FolioMarkdown } from "@uichat-mira/folio";

<FolioMarkdown source={"## 二级标题\n\n正文内容。"} />;
~~~

## 已内置

- 使用 `renderFolioMarkdown()` 生成 HTML；可通过 `options` 处理标题锚点和是否移除原文 H1。
- 页面加载后支持 Mermaid 图的客户端增强；失败时保留来源回退，并输出警告。
- 既可在内置阅读壳使用，也可由消费者直接引用。

## 边界

`FolioMarkdown` 是阅读组件，不是可视化 Markdown 编辑器；Mermaid 浏览器增强也不等于无 JS 的静态图形已经生成。
