---
title: FolioShareButton
description: 浏览器 Web Share 与剪贴板复制兜底的公开分享按钮：Props、状态、DOM 条件与边界。
type: doc
collection: 参考
section: API
order: 80
status: published
tags: [Share, React, Browser]
---

`FolioShareButton` 是已导出的公开组件，提供页面分享的最小交互：优先调用系统分享面板，不支持时复制当前页面 URL。

## 版本与发布状态

`FolioShareButton` 已包含在 npm 发布版 `0.1.1`（Git tag `folio-v0.1.1`）中；当前 `dev` 与发布版实现一致。页面已经完成内容审校，`status: published` 仅表示文档成熟，不表示新增 API 已发布；组件能力已发布。本页适用于 `0.1.1` 及当前 `dev`。

## 导入与最小用法

~~~tsx
import { FolioShareButton } from "@uichat-mira/folio";

<FolioShareButton title={doc.title} text={doc.description} />;
~~~

组件渲染原生 `<button type="button">`，点击后执行分享。它只在浏览器中工作；可以在服务端渲染出按钮，但分享逻辑读取 `window.location.href` 与 `navigator`，不会在渲染阶段访问这些全局对象。

## 公开 Props

~~~ts
type FolioShareButtonProps = {
  title: string;
  text?: string;
  className?: string; // 默认 "folio-share-button"
  compact?: boolean; // 默认 false
};
~~~

- `title` 必填，作为分享标题；`text` 可选，分享时回退到 `title`。
- `className` 替换默认按钮类名，不会自动保留 `folio-share-button`。
- `compact` 为 `true` 时按钮内容是一枚 `aria-hidden` 的分享图标；否则按钮文字显示当前状态标签。两种模式的默认可访问名称都来自同一状态标签。

组件没有 `url`、`onShare`、`disabled` 或 `canShare` 等 Prop；分享地址固定为当前页面的 `window.location.href`（包含 query 与 hash）。

## 默认行为与 fallback

用户点击时按以下顺序执行：

1. 当前环境存在 `navigator.share`：调用 `navigator.share({ title, text: text || title, url })`。成功后将按钮状态设为“已分享”。
2. 没有 Web Share，但 `navigator.clipboard.writeText` 可用：把当前 URL 写入剪贴板，状态设为“链接已复制”。
3. 剪贴板 API 不可用：创建临时 `<textarea>`，选中 URL，通过 `document.execCommand("copy")` 复制后移除，状态设为“链接已复制”。实现不检查 `execCommand()` 的布尔返回值。
4. 任一步抛出非 `AbortError` 异常：状态设为“分享失败”。

用户取消系统分享通常抛出 `DOMException` 且 `name === "AbortError"`；组件直接返回，不显示失败状态。成功或失败后约 1800ms，状态恢复为“分享”。

状态标签同时用于按钮的 `aria-label` 与 `title`；没有额外的 toast、`aria-live` 区域或全局通知。按钮在请求期间不会禁用，连续点击可能触发多次分享/复制。

## 无障碍与移动端

- 触发器是原生 `<button type="button">`，可用 Enter/Space 激活；可访问名称来自状态标签，紧凑模式下的 SVG 标记为 `aria-hidden`，不参与命名。
- 状态变化只更新可访问名称与 `title`，没有 `aria-live`；如需屏幕阅读器播报结果，消费站应自行提供状态区域。
- 组件没有响应式布局；官方站在移动 Header 中使用 `compact` 图标形态，桌面文章工具栏使用文字形态。两者行为一致。

## 浏览器与安全上下文

- `navigator.share` 与 `navigator.clipboard` 由浏览器决定是否存在；两者通常都要求安全上下文（HTTPS 或 localhost），但最终能力以实际浏览器为准。组件不做特性探测后的降级提示，只按上面的顺序回退。
- 组件不检查 `navigator.canShare()`，也不支持分享文件、图片或自定义分享目标；传入的只有标题、文本与 URL。
- 它不依赖 React Router；分享的是浏览器地址栏中的当前 URL，而不是组件收到的某个路由参数。
- 在无 JS 的静态页面中按钮没有点击处理器；该组件没有静态 HTML 对应实现，不能作为无 JavaScript 分享入口。

## 边界与站点用法

`FolioShareButton` 不生成短链接、分享统计、社交卡片（Open Graph/Twitter metadata）或服务端分享记录；这些若需要应由消费站或构建层另行实现。

在 Folio 官方站中，它用于 Header 移动工具区和文章/普通页面工具栏；文档阅读页顶部的旧分享工具栏已移除，`FolioDocsShell` 的 `share` 选项也仅为源码兼容而保留。不要因为组件存在就重新把分享按钮插入技术文档正文。页面的社交元数据由静态站点构建生成，与本组件无关。
