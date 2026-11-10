---
title: FolioFooter
description: 品牌、明暗主题 Logo、分组链接、备案与法律信息的结构化门户页脚。
type: doc
collection: 参考
section: API
order: 30
status: draft
tags: [React, Footer, Configuration]
---

`FolioFooter` 是站点页脚组件：默认渲染一行文本，也可以按 `FolioConfig.footer` 的结构化配置渲染品牌、链接分组与法律信息。它不绑定 Folio 官网或 Mira 的品牌内容；实际文字、图片与法律声明都由消费站提供。

## 用途与导入

~~~tsx
import { FolioFooter, type FolioFooterProps } from "@uichat-mira/folio";
~~~

组件与 Props 类型都从包根导出，源码位于包内 `src/ui/footer/`，样式来自 `@uichat-mira/folio/styles.css`。内部使用 `Link` 与 `useHref`，所以**必须位于 React Router 上下文内**；在 `FolioApp` 中已自动满足，通常不需要直接渲染。

## 最小示例

~~~tsx
import { BrowserRouter } from "react-router-dom";
import { FolioFooter } from "@uichat-mira/folio";

<BrowserRouter>
  <FolioFooter footer={config.footer} siteTitle={config.title} />
</BrowserRouter>;
~~~

## 公共 Props 与默认值

~~~ts
type FolioFooterProps = {
  footer?: FolioConfig["footer"]; // string | FolioFooterConfig | false
  siteTitle?: string;             // 结构化品牌未命名时的回退标题
};
~~~

`footer` 的四种输入：

| 输入 | 结果 |
| --- | --- |
| `undefined` | 渲染默认文案 `Built with Folio.` |
| 字符串 | 原样文本，不解析 Markdown 或 HTML |
| `false` | 返回 `null`，不输出任何标记 |
| `FolioFooterConfig` | 结构化页脚，字段全部可选 |

结构化配置的默认值：

| 字段 | 默认 |
| --- | --- |
| `brand` | 无；只有提供时才渲染身份区 |
| `brand.name` | `siteTitle`，再回退到 `"Folio"` |
| `brand.href` | `"/"` |
| `brand.logo.alt` | 解析后的品牌名 |
| `groups` | `[]` |
| `links[].newTab` | `false` |
| `legal` | 无；只有 `copyright`、`registrations`、`links` 任一存在时才渲染法律区 |

## 结构化配置示例

~~~tsx
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "示例站点",
  description: "介绍真实的站点内容与服务。",
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
  },
});
~~~

以上仅演示结构，不代表真实站点具有相应版权、备案或隐私政策页面。

## 链接与资源解析

- 以 `/` 开头的站内链接使用 React Router 的 `Link`，遵循 `basename`；`//` 开头按外部 URL 处理。
- `newTab: true` 设置 `target="_blank"` 与 `rel="noopener noreferrer"`；外部链接默认不新开窗口。
- 以 `/` 开头的 Logo 资源路径会按 `basename` 重写，其余 URL 原样使用。
- `darkSrc` 存在时同时输出浅色与暗色两张图片，由 `[data-folio-theme="dark"]` 切换，不使用 CSS 滤镜反色；未提供时只显示 `src`。

## 与 FolioApp / slots 的组合

- `FolioApp` 默认在页面策略允许时渲染 `<FolioFooter footer={config.footer} siteTitle={config.title} />`。
- 文档阅读页受 `ui.footerOnDocs` 控制（默认显示）；`ui.docsShell: false` 时 `type: doc` 不再算阅读布局，`footerOnDocs` 对它无效，站点 Footer 始终显示。
- `slots.footer` 完全替换站点 Footer，消费站负责 `<footer>` landmark 与内部结构；Folio 不会在插槽外再包一层页脚。
- `slots.articleFooter` 是正文之后的另一块区域，不是站点 Footer；两者独立渲染。
- 需要非常规多层页脚或额外区域时，用 `slots.footer` 整体替换，而不是修改公共页脚的结构约定。

## React 与静态 HTML 边界

- 静态 HTML 不渲染 `FolioFooter`；`@uichat-mira/folio/vite` 生成的页面没有 React 组件，页脚标记由消费站的 `index.html` 模板负责。
- 结构化页脚、双 Logo、分组链接与法律区都只在浏览器运行时生效。
- 默认样式来自 `styles.css`，没有独立的 Footer CSS 包入口。

## 关键失败与限制

- 缺少 Router 上下文时，`Link` / `useHref` 抛错。
- `groups` 只支持一层链接，不是可无限嵌套的导航树，也没有图标字段。
- 不验证备案资质，不会自动生成版权年份、隐私政策或法律声明；缺省字段不会补全或虚构。
- 不生成、不校验、不上传品牌素材；`darkSrc` 只是切换图片，不做反色或滤镜。
- `footer={false}` 只影响组件本身；在 `FolioApp` 中还要看 `footerOnDocs` 与 `slots.footer` 的优先级。
- 组件不会把页脚注入静态 HTML，也不会参与 SEO 元数据。

## 版本与状态

- 本文按 `dev` 源码 `packages/folio/src/ui/footer/Footer.tsx`、`types.ts` 的 `FolioFooter*` 类型（base `f49557c`）核对。
- npm `0.1.1` **没有导出 `FolioFooter`**；它的 `FolioConfig.footer` 只是 `string`，应用内固定渲染 `config.footer ?? "Built with Folio."`。结构化配置、`false` 与 `slots.footer` 都是 `0.1.1` 之后进入 dev 的候选能力。
- 页面状态保持 `draft`：本文描述的结构化页脚尚未进入发布版本。

## 延伸阅读

- [站点配置与扩展](/guide/configuration)
- [静态发布不是只产出一个 SPA 壳](/guide/static-publishing)
- [只用公开 API 组合站点](/guide/runtime-composition)
- [组件索引](/reference/components)
