---
title: FolioHeader
description: 内置站点导航、移动菜单、搜索、主题与分享操作的应用 Header。
type: doc
collection: 参考
section: API
order: 20
status: draft
tags: [React, Header, Navigation]
---

`FolioHeader` 是 Folio 的站点 Header 运行时组件：桌面主导航、移动菜单、搜索与主题按钮、移动端分享、GitHub 链接都由它渲染。它只属于浏览器运行时，不生成静态 HTML。

## 用途与导入

~~~tsx
import { FolioHeader, type FolioHeaderProps } from "@uichat-mira/folio";
~~~

组件与 Props 类型都从包根导出，源码位于包内 `src/ui/header/`，样式来自 `@uichat-mira/folio/styles.css`。内部使用 `useLocation`，所以**必须位于 React Router 上下文内**；在 `FolioApp` 中已自动满足。

## 最小示例

~~~tsx
import { BrowserRouter } from "react-router-dom";
import { FolioHeader } from "@uichat-mira/folio";

<BrowserRouter>
  <FolioHeader
    config={config}
    navigation={config.navigation}
    docs={docs}
    currentDoc={currentDoc}
    darkMode={dark}
    onSearch={() => setSearchOpen(true)}
    onToggleTheme={() => setDark((value) => !value)}
    brand={<img src="/brand/wordmark.svg" alt="示例站点" />}
    actions={<a href="/changelog">更新日志</a>}
  />
</BrowserRouter>;
~~~

搜索与主题按钮还各自要求传入回调，详见下表；只打开开关不传回调时按钮不会渲染。

## 公共 Props 与默认值

~~~ts
type FolioHeaderProps = {
  config: FolioConfig;
  navigation?: FolioNavigationItem[]; // 默认 config.navigation ?? []
  docs?: readonly FolioDoc[];         // 解析 navigation[].collection 的第一篇入口
  currentDoc?: FolioDoc;
  searchEnabled?: boolean;            // 默认 true
  themeEnabled?: boolean;             // 默认 true
  shareEnabled?: boolean;             // 默认 true
  darkMode?: boolean;                 // 默认 false
  onSearch?: () => void;
  onToggleTheme?: () => void;
  brand?: ReactNode;
  actions?: ReactNode;
};
~~~

| Prop | 默认 | 说明 |
| --- | --- | --- |
| `config` | 必填 | 提供站点标题、Logo 回退、GitHub 链接，并作为默认导航来源 |
| `navigation` | `config.navigation ?? []` | 顶层导航；条目可带 `children` / `panel` 渲染下拉面板 |
| `docs` | 无 | 仅用于把 `navigation[].collection` 解析成该集合第一篇文档；缺失时回退集合索引路由 |
| `currentDoc` | 无 | 只用于移动端分享的标题与描述，不决定导航高亮 |
| `searchEnabled` / `themeEnabled` | `true` | 与对应回调同时存在才渲染按钮 |
| `shareEnabled` | `true` | 只控制移动面板里的分享按钮；桌面没有分享按钮 |
| `darkMode` | `false` | 决定主题图标与 `aria-label` 文案 |
| `onSearch` / `onToggleTheme` | 无 | 受控回调；Folio 不提供 Header 内部的主题或搜索状态 |
| `brand` | 无 | 首页链接内的品牌内容；缺省渲染 `config.logo` + `config.title` |
| `actions` | 无 | 桌面右侧与移动面板内的自定义操作节点 |

## 内置行为

- 桌面：一级条目渲染为链接；带 `children` 的条目在鼠标悬停、点击或键盘激活时打开面板，Escape、点击外部和路由变化都会关闭；离开导航区有一小段关闭延迟，避免指针斜穿时闪断。
- 移动：独立的手风琴面板，不是压缩后的桌面面板；点击条目后自动收起。
- 高亮：路径等于 `href` 或位于其下即视为当前；`activeMatch` 可补充额外路由前缀。
- 搜索快捷键 ⌘/Ctrl+K 由 `FolioApp` 注册，不在 Header 内部；Header 只负责按钮。

## 与 FolioApp / Router / slots 的组合

- `FolioApp` 已把 `searchEnabled`、`themeEnabled`、`shareEnabled`、`darkMode`、`onSearch`、`onToggleTheme` 接好，并将 `slots.headerBrand` 传给 `brand`、`slots.headerActions` 传给 `actions`。
- 直接使用 `FolioHeader` 时必须自己管理主题与搜索状态，并提供 `onSearch` / `onToggleTheme`；否则对应按钮不出现。
- `docs` 是导航简称解析数据，不是内容目录；真正的内容清单仍在 `docs` 全量数据里，由页面路由消费。
- 移动分享的标题与描述优先取 `currentDoc`，否则回退到 `config.title` / `config.description`，分享链接始终是当前页面 URL。
- 官方站同样通过 `slots.headerBrand` 注入品牌内容，而不是覆写 `.folio-header`、`.folio-brand` 等包内部选择器；默认组件样式由包拥有。

## React 与静态 HTML 边界

- Header 只在浏览器渲染。`@uichat-mira/folio/vite` 生成的静态 HTML 没有站点 Header，页头标注由消费站的 `index.html` 模板提供。
- 搜索索引、主题持久化（`localStorage` 键 `folio-theme` 由 `FolioApp` 写入）、菜单开合与焦点管理都是运行时行为，无 JS 的静态页不可用。
- Header 不参与静态 SEO 元数据；标题、canonical、Open Graph 由静态构建管线生成。

## 关键失败与限制

- 缺少 Router 上下文时，`useLocation()` 直接抛错；不要把它放进独立的 React 根节点。
- 只设置 `searchEnabled` / `themeEnabled` 而不传回调，按钮不会渲染，也不会退化为禁用态。
- 没有内置搜索索引：`onSearch` 打开什么由消费站决定；`FolioApp` 的默认实现是 `searchFolioDocs` 浮层。
- 没有暗色 Logo：`config.logo` 只有一张图；双 Logo 是 `FolioFooter` 的能力。
- 默认品牌图片带 `alt=""`（装饰性）。需要可读品牌名时使用 `brand` 插槽并自带 `alt`。
- 不内置消费站的 Logo、备案信息或版本弹层；这些通过 `brand` / `actions` 注入。

## 版本与状态

- 本文按 `dev` 源码 `packages/folio/src/ui/header/Header.tsx` 的 `FolioHeaderProps`（base `f49557c`）核对。
- npm `0.1.1` 也导出 `FolioHeader`，但 Props 只有 `config`、`navigation`、`currentDoc`、三个开关、`darkMode`、两个回调和 `actions`；没有 `docs` 与 `brand`，也没有下拉面板、`collection` 简称解析和分组面板。旧版只渲染 `{ label, href }` 一级链接。
- 页面状态保持 `draft`：本文描述的是 dev 契约，已发布的 `0.1.1` 并不完整支持。

## 延伸阅读

- [导航与内容清单](/guide/navigation)
- [站点配置与扩展](/guide/configuration)
- [只用公开 API 组合站点](/guide/runtime-composition)
- [组件索引](/reference/components)
