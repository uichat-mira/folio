---
title: 用 FolioApp 与 slots 组合 React 页面
description: 从入口挂载到七个 slots：哪些页面由默认壳渲染，哪些由消费站组合，静态 HTML 为什么不会跟着变。
group: 组合
collection: 指南
order: 23
type: doc
status: published
tags:
  - React
  - Slots
  - Consumer
---

Folio 的目标不是让所有站点长得一样，而是让不同站点共享同一套稳定内容与构建契约。`FolioApp` 负责默认路由、Header、文档阅读壳与基础样式；消费站在明确的插槽上表达品牌与交互，不 fork runtime。

本文按顺序说明：公开入口 → 最小挂载 → props 与 `ui` 开关 → 一套完整消费站 → slots 规则 → React 与静态输出的边界。站点字段见[站点配置与扩展](/guide/configuration)，导航规则见[导航与内容清单](/guide/navigation)。

## 公开入口

官方站没有从 `packages/folio/src/*` 偷 import 任何内部实现，只使用公开 package entrypoints：

| 入口 | 内容 |
| --- | --- |
| `@uichat-mira/folio` | React 运行时（`FolioApp` 等组件）、Core 函数、公共类型 |
| `@uichat-mira/folio/vite` | `folio()` 插件、`virtual:folio/content` 类型、静态发布 helper 与类型 |
| `@uichat-mira/folio/pwa` | 可选 PWA 构建集成；不调用就不产生任何输出 |
| `@uichat-mira/folio/pwa/react` | 可选的更新提示组件与 hook |
| `@uichat-mira/folio/styles.css` | 整站默认样式表与 `--folio-*` token |

```tsx
import { FolioApp } from "@uichat-mira/folio";
import docs from "virtual:folio/content";
import "@uichat-mira/folio/styles.css";
```

在既有品牌页里只嵌入正文时，样式表的全局规则会影响宿主页面；那属于 `FolioMarkdown` 的嵌入场景，边界见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。

## 最小挂载

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { FolioApp, type FolioDoc } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FolioApp
      config={config}
      docs={docs}
      basePath={import.meta.env.BASE_URL}
    />
  </React.StrictMode>,
);
```

`FolioApp` 自己创建 `BrowserRouter`（`basename` 来自 `basePath`），所以消费站不要再包一层 Router。`docs` 直接来自虚拟模块；它是构建期发现并排序后的清单，不需要在 React 里再次排序或索引。

## Props 与 ui 开关

`FolioApp` 的 Props 只有五项：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `config` | `FolioConfig` | 与 Vite 插件共享的同一份站点配置。 |
| `docs` | `FolioDoc[]` | 虚拟模块导出的完整内容清单。 |
| `basePath` | `string` | React Router 的 `basename`，默认 `/`；必须与 Vite `base` 一致。 |
| `slots` | `FolioSlots` | 七个 React 扩展点，见下文。 |
| `ui` | `FolioUiOptions` | 外壳级开关，不是内容类型开关。 |

`ui` 里除 `defaultTheme` 外默认都是开启，只有确实不需要时才关闭：

| 开关 | 默认 | 关闭后的行为 |
| --- | --- | --- |
| `search` | `true` | 隐藏 Header 搜索按钮与 `Ctrl/Cmd + K` 覆盖层。 |
| `theme` | `true` | 隐藏主题切换，并停止写入 `data-folio-theme`；页面保持样式表默认（浅色）token。 |
| `share` | `true` | 隐藏文章页的分享按钮。 |
| `docsShell` | `true` | `type: doc` 不再使用 `FolioDocsShell` 阅读布局，按普通页面渲染，没有侧栏、页内目录与上一篇／下一篇。 |
| `footerOnDocs` | `true` | 文档阅读布局内同时隐藏站点 Footer 与 `articleFooter`；首页、文章与普通页面不受影响。 |
| `defaultTheme` | `"system"` | 取值 `"light"`、`"dark"` 或 `"system"`，决定首次加载的明暗偏好。 |

`footerOnDocs` 是布局级策略：它由“当前页面实际使用哪个阅读壳”决定，而不是按内容类型分别配置。关闭 `docsShell` 后，普通页面布局独立决定 Footer。

组件级 Props（`FolioSlots`、`FolioTreeNavProps`、`FolioTocProps`、`FolioUiOptions` 的完整定义）见 [FolioApp](/reference/components/app)、[FolioTreeNav](/reference/components/tree-nav) 与 [FolioToc](/reference/components/toc)。

## 一套完整消费站

下面是一套能直接照抄的消费站骨架：配置文件、Vite 配置与 React 入口三处互相对应。内容目录约定为 `content/`，路由 `/guide/*`、`/reference/*`、`/notes/*`、`/about` 都存在对应 Markdown。

```ts
// folio.config.ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Acme Docs",
  description: "Acme 的产品文档、工程记录与设计笔记。",
  siteUrl: "https://docs.acme.dev",
  github: "https://github.com/acme/docs",
  logo: "/brand/acme-wordmark.svg", // Header 由 slots.headerBrand 覆盖；这里仍作为 social image 兜底
  author: { name: "Acme Docs Team", url: "https://docs.acme.dev/about" },
  navigation: [
    { label: "指南", collection: "/guide" },
    { label: "参考", href: "/reference/overview", collection: "/reference" },
    { label: "笔记", href: "/notes" },
    {
      label: "资源",
      href: "/about",
      children: [
        { label: "快速开始", href: "/guide/getting-started", group: "上手", icon: "terminal", description: "装依赖、接插件、跑通第一篇文档。" },
        { label: "参考索引", href: "/reference/overview", group: "查阅", icon: "book", description: "按任务找到字段、API 与部署条件。" },
      ],
      panel: { eyebrow: "ACME DOCS", title: "按任务查找", overviewLabel: "关于本站" },
    },
  ],
  collections: [
    { path: "/guide", title: "指南", description: "从定位、内容协议读到发布。" },
    { path: "/reference", title: "参考", description: "字段、API 与部署条件。" },
    { path: "/notes", title: "笔记", description: "以日期和标签组织的长文。", archive: true },
  ],
  home: {
    meta: { left: "ACME DOCS", right: "FIELD NOTES" },
    sections: [
      { type: "intro", collection: "/guide", title: "先读这一页" },
      { type: "featured", collection: "/notes" },
      { type: "recent", collection: "/notes", limit: 3 },
      { type: "collections", paths: ["/guide", "/reference"], limit: 3 },
      { type: "about", path: "/about", linkLabel: "关于 Acme Docs" },
    ],
  },
  footer: {
    brand: {
      name: "Acme Docs",
      description: "内容以 Markdown 维护，发布为静态站点。",
      logo: {
        src: "/brand/acme-mark.svg",
        darkSrc: "/brand/acme-mark-inverse.svg",
        alt: "Acme",
      },
    },
    groups: [
      {
        title: "文档",
        links: [
          { label: "快速开始", href: "/guide/getting-started" },
          { label: "参考索引", href: "/reference/overview" },
        ],
      },
      {
        title: "组织",
        links: [
          { label: "GitHub", href: "https://github.com/acme/docs", newTab: true },
          { label: "状态页", href: "https://status.acme.dev", newTab: true },
        ],
      },
    ],
    legal: { copyright: "© 2026 Acme" },
  },
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

export default defineConfig({
  base: process.env.SITE_BASE ?? "/",
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config,
      staticRoutes: true,
    }),
  ],
});
```

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import {
  FolioApp,
  FolioToc,
  FolioTreeNav,
  type FolioDoc,
} from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";
import "./site.css";

const content: FolioDoc[] = docs;
const basePath = import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FolioApp
      config={config}
      docs={content}
      basePath={basePath}
      ui={{ footerOnDocs: false, defaultTheme: "system" }}
      slots={{
        headerBrand: (
          <img src={`${basePath}brand/acme-wordmark.svg`} alt="Acme Docs" />
        ),
        headerActions: (
          <a className="site-header-action" href="https://status.acme.dev">
            状态
          </a>
        ),
        articleFooter: (
          <aside className="site-proof">
            <span>Rendered by Folio</span>
            <p>这篇内容来自仓库 Markdown，经由同一个公开运行时渲染。</p>
          </aside>
        ),
        navigation: (props) => <FolioTreeNav {...props} className="site-tree-nav" />,
        docToc: (props) => <FolioToc {...props} title="本页目录" />,
      }}
    />
  </React.StrictMode>,
);
```

这套配置里没有第二份路由表、没有复制内容索引、没有内部 import：

- 路由、集合索引与归档页由 `FolioApp` 依据 `config` + `docs` 推导；404 由 React 兜底路由与静态构建各自生成。
- 首页由 `config.home` 驱动；React 与默认静态首页共用 `resolveFolioHome`。
- Footer 由 `config.footer` 的结构化配置渲染；`site.css` 只覆盖 `--folio-*` token 与消费站自己的类名。
- `ui.footerOnDocs: false` 让文档阅读页不显示站点 Footer 与 `articleFooter`，文章页仍保留 `articleFooter`。

## slots 规则

`slots` 是明确的 React 扩展点，不是通用可视化页面编辑器：它没有数据加载、没有路由接管，只接收 Folio 已经算好的节点或 props。

| 插槽 | 类型 | 作用位置 | 规则 |
| --- | --- | --- | --- |
| `home` | `ReactNode` | `/` | 完全替换默认／配置首页；优先级高于 `config.home`。 |
| `headerBrand` | `ReactNode` | Header 品牌区 | 替换品牌内容，外层站点根链接与布局仍由 Folio 管理。 |
| `headerActions` | `ReactNode` | Header 右侧 | 追加消费站操作，不改变导航与品牌。 |
| `articleFooter` | `ReactNode` | 正文之后 | 显示在文档阅读壳、文章或普通页面；受 `footerOnDocs` 控制。 |
| `navigation` | `(props: FolioTreeNavProps) => ReactNode` | 文档侧栏 | 桌面与移动共用同一渲染；必须继续传递 `onNavigate`。 |
| `docToc` | `(props: FolioTocProps) => ReactNode` | 页内目录 | 桌面与打开的移动目录共用同一渲染。 |
| `footer` | `ReactNode` | 整站页脚 | 完全替换页脚；提供后 `config.footer` 不再渲染，消费站自己负责 `<footer>` 语义。 |

`home`、`headerBrand`、`headerActions`、`articleFooter`、`footer` 接收现成节点；`navigation` 与 `docToc` 是函数，因为渲染时需要当前文档的导航树、标题与跳转回调。完整的 Props 类型见 [FolioApp](/reference/components/app)。

### 动态插槽的两个要求

```tsx
slots={{
  navigation: ({ tree, currentPath, onNavigate }) => (
    <FolioTreeNav
      tree={tree}
      currentPath={currentPath}
      onNavigate={onNavigate}
      className="site-tree-nav"
    />
  ),
  docToc: (props) => <FolioToc {...props} className="site-doc-toc" />,
}}
```

1. **继续传递 `onNavigate`**：移动端点击链接后要靠它关闭抽屉；丢掉它会让菜单留在屏幕上。
2. **保留语义与可达性**：如果完全替换导航 DOM，消费站要自己维持可访问的导航标签、真实路由链接与选中态。`FolioTreeNav`、`FolioHeader`、`FolioFooter` 需要位于 React Router 上下文中（`FolioApp` 已提供）；`FolioToc` 只用页内锚点，不依赖路由。

### 完全替换 Footer

`config.footer` 只覆盖常见的门户信息层级；需要完全不同的页脚结构时提供 `slots.footer`：

```tsx
<FolioApp
  config={config}
  docs={content}
  slots={{ footer: <SiteFooter /> }}
/>
```

```tsx
// src/SiteFooter.tsx
import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>© 2026 Acme. 内容以 Markdown 维护。</p>
      <nav aria-label="页脚导航">
        <Link to="/guide/getting-started">快速开始</Link>
        <Link to="/about">关于</Link>
      </nav>
    </footer>
  );
}
```

这时 `config.footer` 的字符串或结构化配置不再生效；两者只保留一个真相源。

### 首页与 slots.home

```tsx
slots={{ home: <SiteHome docs={content} /> }}
```

`slots.home` 只要提供，React 首页就完全使用该节点，`config.home` 在 React 侧被忽略。它不会自动生成静态 HTML：静态 `/` 仍来自 `staticRoutes`——要么使用默认静态首页（跟随 `config.home`），要么用 `staticRoutes.home` 提供显式 HTML，或在自有 `routes` 中调用公开的 `renderFolioStaticHome(context)`（来自 `@uichat-mira/folio/vite`）。首页三条路径的完整对比见[站点配置与扩展](/guide/configuration)。

## React 不是静态输出

这是最容易踩错的一条边界：**slots 只影响运行时，不会改写构建阶段生成的静态 HTML**。

构建阶段不读取 React：它的输入只有 `config`、`docs`、`staticRoutes`，以及 Vite `base` 与站点自己的 `index.html` 模板。`slots` 是 React 组件实例，构建时既不存在也无法序列化，所以：

| 页面 | React 默认渲染 | 静态默认输出 | slots 是否改变静态 |
| --- | --- | --- | --- |
| `/` 首页 | 默认首页或 `config.home`；`slots.home` 可整体替换 | 由 `config.home` 或 `staticRoutes.home` 决定；自定义 `routes` 时由 `routes` 决定 | 否 |
| 集合索引 | React 集合页 | 默认集合页 HTML | 否（只能通过 `staticRoutes.routes` 定制） |
| `type: doc` | `FolioDocsShell`：侧栏 + 页内目录 + 分页 | 默认静态文档壳，同样包含侧栏、目录与分页 | 否；`slots.navigation`／`docToc` 只换 React |
| `article` / `page` | 普通页面布局 | 正文与元数据的静态 HTML | 否；`articleFooter` 只换 React |
| 页脚 | `config.footer` 或 `slots.footer` | 静态 HTML 不自动包含 React Footer | 否 |

默认静态壳的链接都指向真实生成的 HTML，禁用 JavaScript 也能读文档、用页内目录、翻上一篇／下一篇；但它是通用壳，不含顶栏下拉菜单、搜索覆盖层与主题切换。需要自定义静态布局时，消费站拥有 `staticRoutes`：可以复用 `renderFolioStaticTreeNav(context, doc)`、`renderFolioStaticToc(headings, { title })`、`renderFolioStaticPageNav(context, doc)` 这些公开 helper（来自 `@uichat-mira/folio/vite`），以保持与 React 同一份导航树和排序，而不是另写一套。

官方站的 [static-routes.ts](https://github.com/uichat-mira/folio/blob/dev/apps/site/src/static-routes.ts) 就是这种消费方式：静态路由由站点自己组合，但树、目录与分页仍来自 Folio 的公开 helper。字段与 SEO 细节见[静态构建与 SEO](/reference/seo)，构建阶段见 [Vite 构建集成](/reference/build-integration)。

## 消费站拥有什么

边界可以压成一句话：

> Runtime 拥有契约，消费站拥有表达。

| 归属 | 内容 |
| --- | --- |
| Folio runtime | 路由推导、文档阅读壳、Header／Footer 默认组件、导航树、Markdown 渲染、搜索、主题机制 |
| 消费站 | 品牌字体与颜色（覆盖 `--folio-*`）、首页叙事、Header 操作、页脚结构、页面之外的交互、`staticRoutes` 与 JSON-LD |
| 构建层 | 内容发现、虚拟模块、静态 HTML、SEO 元数据、sitemap／robots、可选 PWA 产物 |

如果为了做一个漂亮站点必须修改 `packages/folio/src/*`，那说明边界用错了：先看是否能用配置表达，再看 slots，最后才考虑自行组合公开组件（例如不用 `FolioApp`，而是在自己的 Router 里组合 `FolioDocsShell`、`FolioTreeNav`、`FolioToc` 与 `FolioFooter`）。这条边界的完整说明在[Core、UI、Build 与站点边界](/guide/architecture)，官方站的自证在[这个站就是 Folio 的测试用例](/reference/site)。

## 发布状态与 dev 标签

- `0.1.1` 的 `FolioSlots` 只有 `home`、`headerActions`、`articleFooter`；`headerBrand`、`navigation`、`docToc`、`footer` 与 `ui.footerOnDocs` 是 `dev` 源码能力。
- `0.1.1` 也没有 `FolioTreeNav`／`FolioToc` 这两个公开组件；本文的组合示例以 `dev` 为准。
- 已发布版本的准确边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准，不要把 `dev` 示例表述成 npm 上可用的承诺。

## 相关文档

- [站点配置与扩展](/guide/configuration)：`FolioConfig`、Vite plugin、Header／Footer／首页与主题。
- [导航与内容清单](/guide/navigation)：集合简写、下拉菜单、侧栏树与静态侧栏。
- [Core、UI、Build 与站点边界](/guide/architecture)：分层、公开入口与默认壳的所有权。
- [静态发布](/guide/static-publishing)：构建阶段实际写出的文件与无 JS 阅读。
- [FolioApp](/reference/components/app)：Props、`FolioSlots` 与插槽示例的参考页。
