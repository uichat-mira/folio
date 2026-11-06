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
  renderNav?: (props: FolioDocNavProps) => ReactNode;
  renderToc?: (props: FolioTocProps) => ReactNode;
  pageNeighbors?: { previous?: FolioDoc; next?: FolioDoc };
  menuLabel?: string;
  share?: boolean; // 已弃用：文档工具栏已移除
};
~~~

## 当前使用方式

- 普通技术文档：默认 `docNav` 和 `FolioToc`。
- 项目型内容：应用外壳提供 `FolioTreeNav` 和项目内上下篇关系。
- 手机：左右导航可通过菜单抽屉访问，传入的 `onNavigate` 会在跳转后关闭抽屉。

## 边界

它是已有阅读 UI 的组合层，不是页面编辑器；它也不会自行发现磁盘中的 Markdown，内容仍由构建层导入。
