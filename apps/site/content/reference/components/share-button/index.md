---
title: FolioShareButton
description: 可用时调用 Web Share，不支持时通过剪贴板复制页面 URL。
type: doc
collection: 参考
section: API
order: 80
status: draft
tags: [Share, React, Browser]
---

`FolioShareButton` 是已导出的公开组件，提供页面分享的最小交互。

## Props

~~~ts
type FolioShareButtonProps = {
  title: string;
  text?: string;
  className?: string;
  compact?: boolean;
};
~~~

## 已内置

用户点击时优先调用 `navigator.share()`；不支持时使用 Clipboard API，必要时回退到临时文本框复制。操作结束显示短暂状态提示，用户取消系统分享不会被当作失败。

## 边界

它依赖浏览器分享和剪贴板能力，不包含服务端短链接、分享统计或站点社交元数据生成。技术文档上方的旧分享工具栏已经移除，不应因为组件存在就重新插入。
