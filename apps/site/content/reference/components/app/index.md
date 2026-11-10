---
title: FolioApp
description: 路由、页面外壳、统一导航、主题与组件插槽的公开 React 入口。
type: doc
collection: 参考
section: API
order: 10
status: published
tags: [React, Runtime, API]
---

`FolioApp` 是 Folio 的 React 运行时入口：它创建 `BrowserRouter`，把构建层解析出的 `docs` 映射为路由，并接通内置首页、集合页、阅读布局、Header、Footer 与搜索浮层。它不解析 Markdown、不读取磁盘，也不承担静态生成。

## 用途与导入

~~~tsx
import { FolioApp, type FolioAppProps } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
~~~

`FolioApp` 与 `FolioAppProps` 都从包根导出；`styles.css` 是整站样式表，不是隔离的嵌入样式。核心对等依赖为 React 19、React DOM 19 与 React Router DOM 7，Vite 与 PWA 相关对等依赖是可选的。

## 最小示例

~~~tsx
import { createRoot } from "react-dom/client";
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "./folio.config";

createRoot(document.getElementById("root")!).render(
  <FolioApp config={config} docs={docs} basePath={import.meta.env.BASE_URL} />,
);
~~~

`docs` 来自 Folio Vite 插件的 `virtual:folio/content`；生产构建时应已经过 Frontmatter 解析、路由与排序校验。

## 公共 Props 与默认值

~~~ts
type FolioAppProps = {
  config: FolioConfig;
  docs: FolioDoc[];
  basePath?: string; // 默认 "/"
  slots?: FolioSlots;
  ui?: FolioUiOptions;
};
~~~

`basePath` 经 `normalizeBasePath` 处理后作为 `BrowserRouter` 的 `basename`；子路径部署时传站点实际 base，不要在路由里写死前缀。

`ui` 是运行时开关：布尔项默认都是 `true`，`defaultTheme` 默认 `"system"`。

| 选项 | 默认 | 行为 |
| --- | --- | --- |
| `search` | `true` | `false` 时不渲染搜索按钮、不注册 ⌘/Ctrl+K，也不在 404 页提供搜索入口 |
| `theme` | `true` | `false` 时不写 `data-folio-theme`、不持久化主题 |
| `share` | `true` | 控制移动端 Header 分享；普通内容页不再默认插入分享工具栏 |
| `docsShell` | `true` | `false` 时 `type: doc` 也按普通内容页渲染，不再有侧栏、页内目录和上下篇 |
| `footerOnDocs` | `true` | 只在文档阅读布局下生效，见下文“Footer 策略” |
| `defaultTheme` | `"system"` | 依次读取 `localStorage("folio-theme")`、该偏好、系统主题 |

## 页面类型与默认壳

| 内容 | 默认呈现 | 关键差异 |
| --- | --- | --- |
| `/` 首页 | `slots.home` → `config.home` → 内置编辑式首页 | 按此优先级取第一个可用入口，不会叠加 |
| `type: doc` | `FolioDocsShell` | 左侧统一导航、页内目录、上/下篇、移动抽屉；`ui.docsShell: false` 时降级为普通内容页 |
| `type: article` | 普通内容页 | 标题、元数据、可选归档标签、正文、`articleFooter`；有标题时附页内目录；无默认分组/分享工具栏 |
| `type: page` | 普通内容页 | 标题、元数据、正文与 `articleFooter`；不生成页内目录，也无默认工具栏 |
| `config.collections[]` | 集合索引页 | 条目列表，以及归档启用时的分类行与标签链接 |
| `collections[].archive` | 分类/标签归档页 | 由 `buildFolioArticleArchiveModel` 派生，未知 slug 落 404 |
| 其他路径 | 404 | 含返回首页与可选搜索入口 |

“普通内容页”指 `DocumentPage`：它复用 `FolioDocumentBody`（标题、摘要、`FolioDocMeta`、Markdown），所以文档页与 Article/Page 的署名行为一致，只是外围壳不同。`DocumentPage` 不再自动注入分组/分享工具栏；消费者仍可独立组合 `FolioShareButton`，移动 Header 分享仍受 `ui.share` 控制。

## Footer 策略

站点 Footer 与正文后的 `articleFooter` 由同一个策略决定：`shouldShowFolioPageFooter(resolveFolioReaderKind(doc, ui.docsShell !== false), ui.footerOnDocs)`。

| 页面 | 站点 Footer | `articleFooter` |
| --- | --- | --- |
| 文档阅读布局（`type: doc` 且 `docsShell` 开） | `footerOnDocs !== false` | 与站点 Footer 同开同关 |
| Article / Page / 被降级的 doc | 始终显示 | 始终显示 |
| 首页、集合页、归档页、404 | 始终显示 | 不渲染 |

`resolveFolioReaderKind`、`shouldShowFolioPageFooter` 与对应类型同样从包根导出，自建外壳可以复用同一判断，不必重新猜页面类型。

## 插槽

`slots` 是明确的 React 扩展点，不是页面编辑器；所有插槽都只影响浏览器运行时。

| 插槽 | 类型 | 位置与要求 |
| --- | --- | --- |
| `home` | `ReactNode` | 替换 `/` 的全部内容，优先于 `config.home` 与内置首页 |
| `headerBrand` | `ReactNode` | 放在 Header 的首页链接内；Folio 仍拥有布局与链接 |
| `headerActions` | `ReactNode` | Header 右侧与移动面板内的自定义操作 |
| `articleFooter` | `ReactNode` | 正文之后、分页之前的自定义区域 |
| `navigation` | `(props: FolioTreeNavProps) => ReactNode` | 同时替换文档桌面侧栏与移动抽屉 |
| `docToc` | `(props: FolioTocProps) => ReactNode` | 同时替换桌面目录与移动目录浮层 |
| `footer` | `ReactNode` | 完全替换站点 Footer；`<footer>` landmark 由消费站负责 |

注意：

- `navigation` 与 `docToc` 是函数，因为渲染它们需要当前页面的树、标题与 `onNavigate` 回调。**必须把 `onNavigate` 继续传给最终组件**，否则移动端点击链接后抽屉不会关闭。
- `footer` 插槽只在策略判定要显示站点 Footer 时渲染；`footerOnDocs: false` 时文档页连插槽一起不显示。
- `slots.footer` 只要不是 `undefined` 就优先于 `config.footer`，包括 `config.footer: false` 的情况。

## 导航插槽示例

~~~tsx
import { FolioApp, FolioTreeNav, FolioToc } from "@uichat-mira/folio";

<FolioApp
  config={config}
  docs={docs}
  slots={{
    navigation: ({ tree, currentPath, onNavigate }) => (
      <FolioTreeNav
        tree={tree}
        currentPath={currentPath}
        onNavigate={onNavigate}
        className="site-navigation"
      />
    ),
    docToc: (props) => <FolioToc {...props} />,
  }}
/>;
~~~

`tree` 由 `buildFolioNavigationTree(docs, currentDoc)` 生成，包含 `collection / section` 分类与真实内容父子；不再有项目专用子树。完全替换导航 DOM 时，消费站需要自行保留可访问的导航标签、真实路由与选中态。

## 与 Router 的组合要求

- `FolioApp` 自带 `BrowserRouter`，不要再套一层 Router；需要自定义路由时，直接组合 `FolioHeader`、`FolioDocsShell` 等公开组件。
- 它面向浏览器运行时，不做 SSR 水合；`basePath` 之外的资源路径仍由消费站负责。
- 集合配置错误会在渲染时抛错：某个 `collections[].path` 与文档最终路由重合时，`assertNoFolioCollectionConflicts` 抛出 `folio collection route conflict`。

## React 与静态 HTML 边界

- 插槽、`ui` 开关、主题、搜索、抽屉与展开状态都是运行时行为，不会写进静态 HTML。
- 静态页面由 `@uichat-mira/folio/vite` 生成：`type: doc` 有等价的无 JS 阅读壳；`type: article` 保留归档标签与页内目录，但不再生成顶部工具栏；`type: page` 是没有顶部工具栏的简化正文；首页由静态首页或自定义 `routes` 生成。
- 静态模板中的页头与页脚由消费站自己提供；Folio 的 React Header/Footer 不参与静态输出。

## 关键失败与限制

- `docs` 必须是构建层产物；组件不会自动发现 Markdown 文件，也不会解析正文。
- 同一最终路由的重复文档应在构建层被拒绝；运行时按数组顺序匹配，不能当作冲突恢复机制。
- 没有内容或集合时首页显示空状态而不是报错；这不代表内容配置正确。
- 搜索默认使用 `searchFolioDocs` 的客户端索引，不提供全文服务或持久化。
- 主题只持久化 `light`/`dark`；`system` 是首次解析用的偏好，不是持久值。

## 版本与状态

- 本文按 `dev` 源码 `packages/folio/src/index.ts`、`ui-types.ts`、`app.tsx`（base `f49557c`）核对。
- npm `0.1.1`（2026-11-01 发布）已导出 `FolioApp`，但其 `FolioSlots` 只有 `home`、`headerActions`、`articleFooter`；`ui` 没有 `footerOnDocs`；`config.footer` 只能是字符串；没有集合索引、归档路由以及 `headerBrand`/`navigation`/`docToc`/`footer` 插槽。
- 本页 `status: published` 只表示组件参考文档已经审校，并不表示 API 已随 npm 0.1.1 发布。具体可用版本以上文对照的公开导出与 Props 为准。

## 延伸阅读

- [只用公开 API 组合站点](/guide/runtime-composition)
- [站点配置与扩展](/guide/configuration)
- [内容类型与路由](/guide/content-types)
- [静态发布不是只产出一个 SPA 壳](/guide/static-publishing)
