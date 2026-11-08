---
title: FolioToc
description: 读取当前 Markdown 标题、生成页内锚点并随滚动高亮的公开组件。
type: doc
collection: 参考
section: API
order: 55
status: draft
tags: [Navigation, TOC, API]
---

`FolioToc` 是可复用的**页内标题目录**。它与站点左侧 `FolioTreeNav` 不同：前者跳到当前文章的标题，后者切换不同文章。

## Props

~~~ts
type FolioTocProps = {
  headings: readonly FolioHeading[];
  className?: string;
  onNavigate?: () => void;
  title?: string;
};
~~~

`FolioHeading` 由 Markdown 解析器生成，含标题级别、文本与 `id`。`FolioToc` 输出页内 `#heading-id` 锚点，按 h2 → h3 → h4 的层级嵌套，监听滚动并用轨道上的滑动标记指示当前标题；没有标题时不渲染目录。`title` 默认为“本页目录”，只改变面板标题与 `aria-label`。

内部使用的 `buildFolioOutlineTree(headings)` 也从包根导出，静态页面可用 `@uichat-mira/folio/vite` 的 `renderFolioStaticToc(headings)` 生成相同结构的 HTML，避免 React 与静态产物各写一套。

~~~tsx
import { FolioToc } from "@uichat-mira/folio";

<FolioToc headings={currentDoc.headings} />;
~~~

在 `FolioApp` 中，右侧标题目录已经由 `FolioDocsShell` 接线，也可以通过 `slots.docToc` 替换。消费者在移动端覆写时应保留 `onNavigate`，以便点击标题后关闭目录抽屉。

## 边界

页面中必须存在与 `heading.id` 一致的真实标题元素，滚动定位和高亮才可靠。`FolioToc` 不参与站点分类、项目父子关系或上一篇／下一篇计算，也不是可编辑的内容大纲。
