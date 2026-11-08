---
title: FolioApp
description: 路由、页面外壳、统一导航、主题与组件插槽的公开 React 入口。
type: doc
collection: 参考
section: API
order: 10
status: draft
tags: [React, Runtime, API]
---

`FolioApp` 是 Folio 的 React 应用入口。消费站传入站点配置与解析后的文档，便可使用内置首页、路由、阅读布局、Header 和 Footer，不必复制一套应用外壳。

## 基本接入

~~~tsx
import { FolioApp, type FolioAppProps } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";

<FolioApp config={config} docs={docs} />;
~~~

- 根据 `docs` 中的路由呈现首页、集合页、技术文档、博客文章及独立页面。
- `type: doc` 使用 `FolioDocsShell` 和 `FolioTreeNav`；底部分页与左侧导航保持相同阅读顺序，文档目录由 `collection`、`section` 和实际路由决定。
- 搜索、主题、分享等入口由应用外壳编排；消费者可以通过 `ui` 开关与插槽调整。
- `ui.footerOnDocs: false` 同时隐藏文档阅读布局的站点 Footer 和正文 `articleFooter`；不会改变首页或普通文章的 Footer。

## FolioSlots：可用插槽

`slots` 是明确的 React 扩展点，不是通用可视化页面编辑器。

| 插槽 | 类型 | 用途 |
| --- | --- | --- |
| `home` | `ReactNode` | 覆写首页内容 |
| `headerActions` | `ReactNode` | 追加 Header 操作 |
| `articleFooter` | `ReactNode` | 内容正文下方的自定义区域 |
| `footer` | `ReactNode` | 完全替换站点 Footer |
| `navigation` | `(props: FolioTreeNavProps) => ReactNode` | 统一覆写技术文档与项目页的左侧导航 |
| `docToc` | `(props: FolioTocProps) => ReactNode` | 覆写当前页面右侧的标题目录 |

`home`、`headerActions` 和 `footer` 等插槽接收现成的 React 节点；`navigation`、`docToc` 是函数，因为渲染它们需要当前页面的导航数据与回调。

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

`tree` 由 `buildFolioNavigationTree(docs, currentDoc)` 生成，包含文档分类与项目子树；`currentPath` 指向当前页。**请把 `onNavigate` 继续传给自定义导航**，以便移动端点击链接后关闭菜单。现在只有 `slots.navigation` 一条左侧导航扩展契约。

消费站若完全替换导航 DOM，需要自行保留可访问的导航标签、真实路由和选中态。

## 运行时与构建时的边界

React 插槽只影响运行时呈现，**不会自动改写构建阶段生成的静态 HTML**；需要特殊静态输出时应在消费站的静态渲染层处理。内容仍由构建层从 Markdown 解析、校验并提供给 `docs`。

当前文档描述的是已经接通的组件能力，不意味着 AI 写作、内容审核、Git 提交和发布编排已经由这个 React 组件实现。
