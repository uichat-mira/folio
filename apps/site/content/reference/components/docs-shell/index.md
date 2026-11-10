---
title: FolioDocsShell
description: 内置左右栏、移动抽屉、Markdown 正文和上下篇导航的阅读布局。
type: doc
collection: 参考
section: API
order: 40
status: draft
tags: [React, Docs, Layout]
---

`FolioDocsShell` 是 `type: doc` 的阅读布局：左侧统一导航、正文、右侧页内目录、移动抽屉与上下篇分页都由它组合。它不决定内容父子关系，也不读取磁盘，**不是**项目专用阅读器。

## 用途与导入

~~~tsx
import { FolioDocsShell, type FolioDocsShellProps } from "@uichat-mira/folio";
~~~

组件与 Props 类型都从包根导出，源码位于包内 `src/docs-shell.tsx`。内部通过 `Link` 渲染导航与分页，因此**必须位于 React Router 上下文内**；`FolioApp` 在 `doc.type === "doc"` 且 `ui.docsShell !== false` 时自动渲染它。

## 最小示例

~~~tsx
import { FolioDocsShell } from "@uichat-mira/folio";

<FolioDocsShell
  doc={currentDoc}
  docs={docs}
  menuLabel="参考目录"
  footer={<aside className="doc-note">本文档随 dev 源码更新。</aside>}
/>;
~~~

## 公共 Props 与默认值

~~~ts
type FolioDocsShellProps = {
  doc: FolioDoc;
  docs: FolioDoc[];
  footer?: ReactNode;
  /** @deprecated 文档工具栏已移除，保留该选项仅为源码兼容。 */
  share?: boolean;
  children?: ReactNode;
  renderNav?: (props: FolioTreeNavProps) => ReactNode;
  renderToc?: (props: FolioTocProps) => ReactNode;
  pageNeighbors?: FolioPageNavNeighbors;
  menuLabel?: string; // 默认 "文档菜单"
};
~~~

| Prop | 默认 | 说明 |
| --- | --- | --- |
| `doc` | 必填 | 当前文档；标题、摘要、[FolioDocMeta](/reference/components/doc-meta) 与标题锚点都来自它 |
| `docs` | 必填 | 全量内容，用于构建统一导航树与默认分页顺序 |
| `footer` | 无 | 正文之后、分页之前的节点；`FolioApp` 传入 `slots.articleFooter` |
| `children` | 无 | **只替换 Markdown 正文**；标题、摘要与署名仍然保留 |
| `renderNav` | 内置 `FolioTreeNav` | 同时接管桌面侧栏与移动抽屉 |
| `renderToc` | 内置 `FolioToc` | 同时接管桌面目录与移动目录浮层 |
| `pageNeighbors` | 由导航树推导 | 显式覆盖上一篇/下一篇，只需 `path` 与 `title` |
| `menuLabel` | `"文档菜单"` | 移动抽屉的 `aria-label`，不影响可见文字 |

## 阅读布局行为

- 导航树由 `buildFolioNavigationTree(docs, doc)` 生成：`collection / section` 分组加真实内容父子，不再有独立的项目子树。
- 分页默认取 `getFolioNavigationNeighbors(tree, doc.path)`，与左侧树同一阅读顺序；只有存在真实文档的节点才参与。
- 桌面：左栏、正文、右栏三段式。
- 781–1100px：左栏保留，右侧目录改为顶部“页面导航”浮层；打开时锁定背景滚动，支持 Escape、点击外部和关闭按钮退出。
- 小于 780px：左侧导航收进菜单抽屉，页内目录仍用浮层；两者通过 `onNavigate` 在跳转后自动关闭。
- 正文与分页之间是 `footer`；分页由独立的 [FolioPageNav](/reference/components/page-nav) 渲染，不占 `children` 的位置。

## 与 FolioApp / slots 的组合

- `FolioApp` 把 `slots.navigation` 接到 `renderNav`、`slots.docToc` 接到 `renderToc`，把 `slots.articleFooter` 接到 `footer`；`pageNeighbors` 由 Folio 默认推导。
- `renderNav` 收到 `{ tree, currentPath, onNavigate }`，`renderToc` 收到 `{ headings, onNavigate }`；自定义渲染必须转发 `onNavigate`，否则移动端点击后抽屉或浮层不会关闭。
- 文档页不受 `ui.footerOnDocs` 影响分页：分页槽位始终挂载，没有上一篇/下一篇时不输出标记；该选项只控制站点 Footer 与 `articleFooter`。
- `ui.docsShell: false` 时整个组件不挂载，`type: doc` 按普通内容页渲染，没有侧栏、页内目录与上下篇。
- 独立组合时，把 Router、`FolioHeader`、本组件和 `FolioFooter` 按站点需要拼装即可。

## React 与静态 HTML 边界

- 静态构建不运行 React。默认静态路由在 `@uichat-mira/folio/vite` 中组合 `renderFolioStaticDocumentBody`、`renderFolioStaticTreeNav`、`renderFolioStaticToc` 与 `renderFolioStaticPageNav`，输出结构等价、无需 JavaScript 的阅读壳。
- 静态版保留全部真实链接，但移动菜单与目录是原生 `<details>` 折叠块，而不是 React 抽屉：没有开合动画、焦点管理、背景滚动锁定，也不持久化手动展开状态。
- React 与静态输出使用同一份 Core 导航树和 `FolioDocByline` 署名模型，避免两端排序或元数据漂移。
- `renderFolioStaticProjectShell` 是已弃用的兼容别名，现在就是普通文档壳，不代表还存在项目专用布局。

## 关键失败与限制

- 不是页面编辑器，也不做内容发现；`docs` 必须来自构建层。
- 不负责决定内容父子关系；`collection / section` 与路由推导在 Core 层完成。
- 已没有项目专用语义：所有 `type: doc` 共用这套布局，分页按统一树先序，不会在“项目”边界内截断。
- `share` 传入不会报错，但已无任何效果（文档工具栏已移除）。
- `pageNeighbors` 只覆盖上下篇，不改变侧栏与页内目录。
- 缺少 Router 上下文时，`Link` 渲染会抛错。
- `renderNav` / `renderToc` 返回 `null` 或缺少导航结构时，移动端抽屉仍然存在但没有可操作内容；Folio 不补默认导航。

## 版本与状态

- 本文按 `dev` 源码 `packages/folio/src/docs-shell.tsx`、`ui/page-presentation.ts`（base `f49557c`）核对。
- npm `0.1.1` 也导出 `FolioDocsShell`，但 Props 只有 `doc`、`docs`、`footer`、`share`、`children`；没有 `renderNav`、`renderToc`、`pageNeighbors`、`menuLabel`，当时的侧栏也不是统一 Core 导航树。
- 页面状态保持 `draft`：本文描述的覆盖能力与统一导航树尚未随 `0.1.1` 发布。

## 延伸阅读

- [FolioTreeNav](/reference/components/tree-nav)
- [FolioToc](/reference/components/toc)
- [FolioPageNav](/reference/components/page-nav)
- [内容类型与路由](/guide/content-types)
