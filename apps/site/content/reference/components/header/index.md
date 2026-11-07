---
title: FolioHeader
description: 内置站点导航、移动菜单、搜索、主题与分享操作的应用 Header。
type: project
order: 20
status: draft
tags: [React, Header, Navigation]
---

`FolioHeader` 位于包内 `src/ui/header/`，已从入口 `@uichat-mira/folio` 导出。

## 公共 Props

~~~ts
type FolioHeaderProps = {
  config: FolioConfig;
  navigation?: FolioNavigationItem[];
  docs?: readonly FolioDoc[]; // 解析 navigation[].collection 的第一篇入口
  currentDoc?: FolioDoc;
  searchEnabled?: boolean;
  themeEnabled?: boolean;
  shareEnabled?: boolean;
  darkMode?: boolean;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  actions?: ReactNode;
};
~~~

## 内置行为

根据站点 `navigation` 渲染桌面与移动导航；支持菜单面板、主动关闭、键盘 Escape、搜索触发、主题按钮，以及与当前路由相关的导航高亮。

移动端工具区的分享按钮由 `shareEnabled` 控制，对首页、集合索引和内容页一致显示：存在 `currentDoc` 时使用文档标题与描述，否则回退到站点 `config.title` / `config.description`，分享链接始终是当前页面 URL。

## 边界

它依赖 React Router 上下文，搜索索引和主题持久化由应用外壳管理。`FolioHeader` 不内置任何消费站的 Logo 或备案信息；官方站使用自己的品牌 CSS。
