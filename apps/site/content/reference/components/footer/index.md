---
title: FolioFooter
description: 支持旧版文本、门户链接分组、品牌、法律信息和深浅色 Logo 的页脚组件。
type: project
order: 30
status: draft
tags: [React, Footer, Configuration]
---

`FolioFooter` 已独立到 `src/ui/footer/` 并作为公共 API 导出。

## 两种配置

~~~ts
footer: "Built with Folio.";

// 或结构化门户页脚
footer: {
  brand: {
    name: "示例站点",
    description: "站点说明",
    logo: { src: "/logo.svg", darkSrc: "/logo-inverse.svg", alt: "站点" },
  },
  groups: [
    { title: "资料", links: [{ label: "文档", href: "/guide" }] },
  ],
  legal: {
    copyright: "© 示例组织",
    registrations: [], // 只填真实备案信息
    links: [],
  },
}
~~~

## 已内置

- 未设置时使用默认页脚；旧字符串继续有效；`footer: false` 隐藏。
- 支持品牌介绍、多栏导航、备案和法律链接。
- 站内链接使用 React Router；新窗口外链带 `noopener noreferrer`；根路径 Logo 资源会适配部署子路径。
- `slots.footer` 可以整体覆盖；技术文档是否显示 Footer 由 `ui.footerOnDocs` 决定。

## 边界

Footer 不会替站点生成真实版权归属、备案号或法律页面。静态路由正文预渲染目前不自动注入 React 应用壳的 Footer。
