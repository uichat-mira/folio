---
title: FolioDocsShell
description: 内置左右栏、移动抽屉、Markdown 正文和上下篇导航的阅读布局。
type: project
order: 40
status: draft
tags: [React, Docs, Layout]
---

`FolioDocsShell` 是阅读页布局组件。它把内容、左侧导航、右侧页内目录和分页组合起来，**并不单独决定项目父子关系**。

## 公共能力

~~~ts
type FolioDocsShellProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  footer?: ReactNode;
  children?: ReactNode;
  renderNav?: (props: FolioTreeNavProps) => ReactNode;
  renderToc?: (props: FolioTocProps) => ReactNode;
  pageNeighbors?: FolioPageNavNeighbors; // previous/next 仅需 path 与 title
  menuLabel?: string;
  share?: boolean; // 已弃用：文档工具栏已移除
};
~~~

## 当前使用方式

- 普通文档与项目型内容：默认同一个 `FolioTreeNav`，数据来自 `buildFolioNavigationTree()`。
- 阅读主体由 `FolioDocumentBody` 统一组合标题、摘要、[FolioDocMeta](/reference/components/doc-meta) 和 Markdown；Git 自动获取、Frontmatter 独立覆写。即使没有作者或日期，有正文时仍可显示阅读时间；全部缺失才不显示空容器。
- 底部上一篇／下一篇由独立的 [FolioPageNav](/reference/components/page-nav) 呈现；默认按照与左侧 `FolioTreeNav` 相同的阅读顺序，组件子树末尾可以接到同一分类的普通文档。独立项目仍限制在项目内部，`FolioToc` 仍是页内标题目录。
- 手机：左右导航可通过菜单抽屉访问，传入的 `onNavigate` 会在跳转后关闭抽屉。
- 781–1100px：左侧导航仍在，右侧目录改为顶部「页面导航」浮层；打开时锁定背景滚动，支持 Escape、点击外部和关闭按钮退出。小于 780px 时浮层与菜单抽屉同时可用。

## 边界

它是已有阅读 UI 的组合层，不是页面编辑器；它也不会自行发现磁盘中的 Markdown，内容仍由构建层导入。
