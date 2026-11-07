---
title: FolioFooter
description: 品牌、明暗主题 Logo、分组链接、备案与法律信息的结构化门户页脚。
type: project
order: 30
status: draft
tags: [React, Footer, Configuration]
---

`FolioFooter` 是已公开的站点页脚组件，既接受原有的文本配置，也接受结构化门户配置。它不绑定 Folio 官网或 Mira 的品牌内容；实际文字、图片与法律声明都由消费站提供。

## 配置方式

~~~tsx
import { FolioFooter, type FolioFooterProps } from "@uichat-mira/folio";

// 直接组合
<FolioFooter footer={config.footer} siteTitle={config.title} />;
~~~

站点级 `FolioConfig.footer` 支持三种形式：

- 省略或传入字符串：使用默认文案或指定文本。
- `false`：不显示站点 Footer。
- `FolioFooterConfig`：使用品牌信息、导航分组与法律信息组合门户页脚。

~~~ts
footer: {
  brand: {
    name: "示例站点",
    description: "介绍真实的站点内容与服务。",
    href: "/",
    logo: {
      src: "/brand/logo.svg",
      darkSrc: "/brand/logo-dark.svg",
      alt: "示例站点",
    },
  },
  groups: [
    {
      title: "资源",
      links: [
        { label: "指南", href: "/guide" },
        { label: "组织网站", href: "https://example.org", newTab: true },
      ],
    },
  ],
  legal: {
    copyright: "© 示例组织",
    registrations: [],
    links: [{ label: "隐私政策", href: "/privacy" }],
  },
}
~~~

上述内容仅演示结构，不代表真实站点具有相应版权、备案或隐私政策页面。

## 品牌：FolioFooterBrand

~~~ts
type FolioFooterBrand = {
  name?: string;
  description?: string;
  href?: string;
  logo?: {
    src: string;
    darkSrc?: string;
    alt?: string;
  };
};
~~~

- `name` 未设置时回退到 `siteTitle`；由应用外壳组合时通常传入 `config.title`。`href` 默认站点根路径。
- `logo` 不存在时显示文字品牌，存在时使用消费站提供的图片；Folio 不负责生成或上传品牌素材。
- `darkSrc` 可选：提供后按 `[data-folio-theme="dark"]` 切换两张实际图片，而非用 CSS 滤镜硬反色。未提供时只展示 `src`。
- 以 `/` 开头的站点 Logo 资源路径会考虑 React Router `basename`，可用于子路径部署。**Header 并不因此自动获得同一套双 Logo 配置。**

## 导航链接：FolioFooterGroup 与 FolioFooterLink

~~~ts
type FolioFooterLink = {
  label: string;
  href: string;
  newTab?: boolean;
};

type FolioFooterGroup = {
  title: string;
  links: FolioFooterLink[];
};
~~~

`groups` 支持多个分组，但每组只包含一层链接，不是无限嵌套的导航树。以 `/` 开头的站内链接使用 React Router，遵循 `basename`；站外 URL 使用普通 `<a>` 标签。`newTab: true` 时设置新窗口及 `rel="noopener noreferrer"`。

需要非常规多层页脚或额外区域，可以通过 `FolioApp` 的 `slots.footer` 完整替换，而不是修改公共页脚的结构约定。

## 法律信息：FolioFooterLegal

~~~ts
type FolioFooterLegal = {
  copyright?: string;
  registrations?: FolioFooterLink[];
  links?: FolioFooterLink[];
};
~~~

`copyright` 为原样展示的文本；`registrations` 可放真实备案链接；`links` 可放隐私政策、服务条款等合法且实际存在的目标。未提供的字段不会自动补全或虚构。

**Folio 不验证备案资质，也不会自动生成隐私政策、版权归属或法律声明。**

## 显隐边界

`slots.footer` 可整体覆盖站点 Footer。对于文档与项目阅读布局，`ui.footerOnDocs: false` 还会隐藏正文 `articleFooter`；首页、普通文章和集合页不受这个选项控制。

组件默认样式来自 `@uichat-mira/folio/styles.css`，不单独提供 Footer CSS 包入口。默认静态正文预渲染也不会自动注入 React 应用外壳的 Footer。
