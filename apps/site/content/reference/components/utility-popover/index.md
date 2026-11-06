---
title: FolioUtilityPopover
description: 支持聚焦、Escape 与外部点击关闭的轻量信息浮层。
type: project
order: 70
status: draft
tags: [Popover, React, Accessibility]
---

`FolioUtilityPopover` 是独立公开组件，适合工具栏中的信息面板，而不是后台弹窗管理系统。

## Props

~~~ts
type FolioUtilityPopoverProps = {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};
~~~

## 已内置

点击触发器展开或收起，Esc 和外部 `pointerdown` 关闭；面板中的普通链接点击后也会关闭。展开状态通过 `aria-expanded` 表示，面板以 `role="group"` 组织信息。

## 边界

这里使用普通可聚焦链接和按钮，**不是 ARIA menu，也不是 Dialog / Modal**：没有提供全局对话框堆栈、模态焦点陷阱或复杂弹层定位系统。
