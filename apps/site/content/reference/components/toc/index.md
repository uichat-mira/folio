---
title: FolioToc
description: 页内标题目录的公开 Props、锚点、滚动高亮、移动端回调与静态输出边界。
type: doc
collection: 参考
section: API
order: 55
status: published
tags: [Navigation, TOC, API, React]
---

`FolioToc` 是可复用的**页内标题目录**。它跳到当前文章的标题；[FolioTreeNav](/reference/components/tree-nav) 则切换不同文章。两者职责不同，也不共享展开状态。

## 版本与发布状态

本页描述当前 `dev` 源码。npm 最新发布版 `0.1.1`（Git tag `folio-v0.1.1`）**未导出** `FolioToc` 与 `buildFolioOutlineTree`，。安装 `0.1.1` 时不能按本页示例导入该组件；本页适用于当前 `dev` 或包含该导出的后续版本。 `status: published` 仅表示文档内容已审校，不表示此组件已包含在 npm 0.1.1 中。

## 导入与最小用法

~~~tsx
import { FolioToc } from "@uichat-mira/folio";

<FolioToc headings={currentDoc.headings} />;
~~~

`currentDoc.headings` 由 `parseFolioDoc()`（内部调用 `extractHeadings()`）从 Markdown 生成，包含 h2–h4 的 `depth`、`text` 与 `id`。也可以手动传入 `FolioHeading[]`，但 `id` 必须与页面中真实标题元素的 `id` 完全一致。

## 公开 Props

~~~ts
type FolioTocProps = {
  headings: readonly FolioHeading[];
  className?: string;
  onNavigate?: () => void;
  title?: string; // 默认 “本页目录”
};

type FolioHeading = {
  depth: number;
  text: string;
  id: string;
};
~~~

- `headings` 必填；空数组时组件返回 `null`，不渲染空的 `<nav>`。
- `className` 追加到根 `<nav class="folio-toc">`。
- `onNavigate` 在每个锚点被点击时调用；它不接收参数，也不阻止默认的 hash 跳转。
- `title` 同时作为 `<h2>` 面板标题和 `<nav>` 的 `aria-label`，默认“本页目录”。它不改变标题列表。

组件没有受控选中项：当前标题由滚动位置计算，调用方不能通过 Prop 指定。

## 默认行为与锚点

- 默认输出 `<nav aria-label="本页目录">`，内部是 `<h2>` 与嵌套的 `<ul>`；每个条目是 `href="#heading-id"` 的原生 `<a>`，并使用标题文本作为 `title` 属性。自定义 `title` 会同时替换面板标题和导航名称。
- 按 h2 → h3 → h4 的层级嵌套；h5、h6 以及级别更浅的 h1 不进入目录。
- 当前项带 `aria-current="location"`。滚动位置在页面最顶部时不选中任何项；滚动到页面底部时选中最后一个标题；其余情况选中最后一个已越过视口顶部（计入 CSS `scroll-margin-top`）的标题。
- 滚动与窗口 resize 通过 `requestAnimationFrame` 合并更新；激活项变化时，目录自身的轨道会把对应链接滚动到可见区域（`block: "nearest"`），并移动轨道上的标记。
- 动画遵循 `prefers-reduced-motion`：减少动态效果时，目录内滚动与标记过渡改为无动画。
- 链接是普通 hash 锚点，**不依赖 React Router**，可以在 Router 外使用；点击后的滚动行为由浏览器和消费站 CSS 决定（Folio 不强制 `scroll-behavior`）。
- 组件不读取窗口尺寸来决定桌面或移动端形态；移动抽屉由 [FolioDocsShell](/reference/components/docs-shell) 或其他外壳负责。

## 无障碍与移动端

- 导航名称来自 `title`；每个链接使用标题文本，激活项用 `aria-current="location"` 表示，不伪造按钮语义。
- 目录是普通链接列表，不提供方向键导航、焦点陷阱或 `role="tree"`。
- 移动端覆盖 `FolioToc` 时，**必须继续转发 `onNavigate`**。Folio 的移动目录浮层依赖它关闭抽屉；否则点击锚点后浮层会继续遮挡正文。
- 移动浮层的 Escape、外部点击关闭、背景滚动锁定属于 `FolioDocsShell`，不在 `FolioToc` 内；`FolioToc` 只负责标题列表与高亮。

## 目录树与静态输出

`buildFolioOutlineTree()` 同样从包根导出，是 React 与静态输出共用的 Core 模型：

~~~ts
import {
  buildFolioOutlineTree,
  type FolioOutlineNode,
} from "@uichat-mira/folio";

const outline: FolioOutlineNode[] = buildFolioOutlineTree(headings, {
  minLevel: 2, // 默认 2
  maxLevel: 4, // 默认 4
});
~~~

- 层级按 `depth` 嵌套；范围外的标题被跳过。
- 级别跳跃的标题（例如 h2 后直接 h4）会成为最近一个更浅标题的子节点，不会从目录中丢失。
- `FolioOutlineNode` 是 `FolioHeading` 加 `children`。

静态页面可从 `@uichat-mira/folio/vite` 调用：

~~~ts
import { renderFolioStaticToc } from "@uichat-mira/folio/vite";

const tocHtml = renderFolioStaticToc(currentDoc.headings);
const customTitle = renderFolioStaticToc(currentDoc.headings, { title: "大纲" });
~~~

静态版本与 React 版本共用 `buildFolioOutlineTree()` 和样式类，输出相同的嵌套链接；但：

- 没有滚动监听、激活项、滑动标记，也没有 `data-folio-toc-id` 等客户端标记。
- 没有标题时返回空字符串。
- 文章与文档的静态移动端都使用原生 `<details>` 提供目录，不需要 JavaScript；文档桌面布局直接输出目录面板。

因此静态页面保留的是**可阅读的锚点目录**，不是带滚动高亮的交互目录。

## 边界

- 页面中必须存在与 `heading.id` 一致的真实标题元素，滚动定位和高亮才可靠；如果渲染 Markdown 时设置 `headingAnchors: false`，标题没有 `id`，目录链接会失效。
- 组件不会从正文重新提取标题，也不参与站点分类、内容父子关系或上一篇／下一篇计算；它不是可编辑的内容大纲。
- 它不生成 `id`、不清理 HTML，也不负责标题文本的 slug 规则；这些属于 Markdown/Core 层。标题锚点的生成规则见 [Markdown 写作](/guide/markdown-runtime)。
