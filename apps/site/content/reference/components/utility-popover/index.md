---
title: FolioUtilityPopover
description: 轻量信息浮层的公开 Props、键盘与外部点击语义、移动端行为及静态边界。
type: doc
collection: 参考
section: API
order: 70
status: published
tags: [Popover, React, Accessibility]
---

`FolioUtilityPopover` 是独立的轻量信息浮层，适合工具栏中的版本、说明或链接面板，不是后台弹窗管理系统，也不是 ARIA menu。

## 版本与发布状态

本页描述当前 `dev` 源码。npm 最新发布版 `0.1.1`（Git tag `folio-v0.1.1`）**未导出** `FolioUtilityPopover`，。安装 `0.1.1` 时不能按本页示例导入该组件；本页适用于当前 `dev` 或包含该导出的后续版本。 `status: published` 仅表示文档内容已审校，不表示此组件已包含在 npm 0.1.1 中。

## 导入与最小用法

~~~tsx
import { FolioUtilityPopover } from "@uichat-mira/folio";

<FolioUtilityPopover
  label="Folio 发布版本与资源"
  trigger={<span>v0.1.1</span>}
>
  <a href="/reference/migration-status">迁移状态</a>
  <a href="https://github.com/uichat-mira/folio/releases">版本发布页</a>
</FolioUtilityPopover>;
~~~

组件渲染一个相对定位的容器：触发器是原生 `<button>`，面板默认隐藏，点击后展开。

## 公开 Props

~~~ts
type FolioUtilityPopoverProps = {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};
~~~

- `label` 必填，同时作为触发按钮的 `aria-label` 和面板的 `role="group"` 可访问名称；它应描述面板内容，而不是重复触发器的视觉文字。
- `trigger` 是按钮内容，推荐放纯文本、图标或 `aria-hidden` 的 SVG。**不要放链接或另一个按钮**，否则会形成嵌套交互元素。
- `children` 是面板正文，可放普通链接、按钮、说明文本等。
- `className` 追加到根 `<div class="folio-utility-popover">`。

组件没有 `open`、`defaultOpen` 或 `onOpenChange`，展开状态完全由内部维护，调用方不能以受控方式指定初始状态。

## 默认交互

- 点击触发器切换展开/收起；面板在关闭时仍保留在 DOM 中，只通过 CSS `visibility: hidden`、`opacity: 0` 与 `pointer-events: none` 隐藏。
- 面板打开后，点击组件**外部**任意位置的 `pointerdown` 会关闭；点击面板内部不是链接的内容不会关闭。
- 点击面板内的普通 `<a href>` 后会关闭面板，但不会阻止浏览器原生导航、组合键点击或新标签页行为。
- 普通 `<button>` 或非链接内容不会自动关闭面板；组件也没有暴露命令式 `close()`，需要关闭时应点击外部、按 Escape 或让内容触发导航。
- 展开时 `aria-expanded="true"`、`aria-controls` 指向面板 `id`；面板带 `role="group"` 与 `aria-label={label}`。触发器没有 `aria-haspopup`，因为面板不是 menu。

## 键盘与焦点

- 触发器是原生按钮，可 Tab 聚焦并用 Enter/Space 打开；焦点环由样式提供。
- Escape 关闭面板并把焦点返回触发器。
- 关闭时面板应用了 `visibility: hidden`，因此其中的链接和按钮不会进入 Tab 顺序；组件**没有**模态焦点陷阱，也没有 `inert`/`aria-hidden` 切换。
- 焦点移出面板不会自动关闭，也没有 hover 打开；这是普通 disclosure，不是 tooltip。
- Escape 同时由文档级监听和组件根节点处理。组件根节点的处理会 `stopPropagation()`，使嵌套在移动导航里的浮层先关闭最内层，而不会连带关闭外层抽屉。
- 面板是绝对定位在组件容器内、右对齐、最大宽度受视口限制的普通 `div`；没有 Portal、碰撞检测、滚动跟随或全局堆叠管理。祖先的 `overflow` 可能裁剪它。
- 组件不依赖 React Router，也不在渲染阶段访问 `document`；文档级 `pointerdown` / `keydown` 监听只在面板打开后注册。服务端渲染输出的是关闭状态的面板。

## 移动端与动效

- 面板在移动端使用 `max-width: calc(100vw - 32px)`，避免超出视口；但不会锁定背景滚动。
- 展开/收起有透明度与位移过渡；`prefers-reduced-motion: reduce` 时过渡关闭。
- 在 Header 的移动菜单中嵌套使用时，Escape 的 `stopPropagation` 让浮层先关闭；点击链接跳转后菜单是否关闭仍由外层 Header/抽屉负责。

## React 与无 JS 静态边界

`FolioUtilityPopover` 是纯 React 组件，没有静态 HTML 对应函数。无 JavaScript 时：

- 触发器仍然渲染，但点击没有任何行为；
- 面板因 CSS 默认隐藏，其中的内容不可见、不可聚焦。

因此它只适合非关键的辅助信息；不要把无 JS 时也必须可读的导航、法律声明或发布说明只放在浮层里。需要静态可访问时，应在页面正文或原生 `<details>` 中提供同样内容。

## 边界

它不是 Dialog / Modal，不提供焦点陷阱、`aria-modal`、滚动锁定或 Escape 全局关闭堆栈；也不是导航 mega-menu。面板内容可以是信息、导航或普通交互，但具体语义由消费站放入的元素决定。官方站的版本浮层是使用示例，不是组件的固定内容。

完整的应用 Header、移动菜单协作见 [FolioHeader](/reference/components/header)，需要模态对话框时应使用消费站自己的实现。
