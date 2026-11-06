---
title: FolioToc
description: 根据正文标题生成锚点链接并随滚动更新当前位置。
type: project
order: 30
status: draft
tags: [Navigation, TOC, API]
---

`FolioToc` 是可复用的页内目录，左侧文档分组或树形导航均可与它组合。

## Props

~~~ts
type FolioTocProps = {
  headings: readonly FolioHeading[];
  className?: string;
  onNavigate?: () => void;
};
~~~

正文 Markdown 的标题经 Folio 解析后生成 `FolioHeading[]`，目录会输出 `#heading-id` 锚点，并根据页面滚动位置标记当前标题。没有标题时返回空内容。

## 边界

`FolioToc` 只负责**当前文章内**的标题，不参与不同文章之间的父子关系。它需要页面中实际存在相应 `id` 的标题元素，才有正确的滚动定位与高亮。
