---
title: FolioDocNav
description: 按 collection / section 分组并高亮当前页的文档导航组件。
type: project
order: 10
status: draft
tags: [Navigation, Docs, API]
---

`FolioDocNav` 是公开的文档集合导航组件，位于 `src/ui/doc-nav/`。

## Props

~~~ts
type FolioDocNavProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
};
~~~

它通过 `findFolioDocCollection()` 选取当前文档的集合，用 `section`（或 `group`）生成分组，再按 `order` 排序。当前链接带 `aria-current="page"`；内部链接适配 React Router 的 `basename`。

## 边界

- 当前内置结构只使用 `type: doc`，且不按目录生成父子树。
- 必须位于 React Router 环境内；页面外手工使用时需要自行提供 `FolioDoc` 数据。
- 若想展示目录推导的项目父子关系，应使用 [FolioTreeNav](/reference/components/navigation/tree-nav)，不要伪造 `collection`。
