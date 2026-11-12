---
title: 站点配置与扩展
description: 从最小 FolioConfig 到 Header、Footer 与内置首页：哪些能力由配置声明，哪些仍属于消费站。
group: 概念
collection: 指南
order: 21
type: doc
status: published
tags:
  - Config
  - Header
  - Footer
  - Home
  - Theme
---

配置一个 Folio 站点只有两个文件：`folio.config.ts` 声明站点身份与内容结构，`vite.config.ts` 注册插件、负责内容发现与静态输出。本文按上手顺序说明：最小配置 → 字段 → 插件 → Header → Footer → 内置首页 → 主题。

导航条目的完整规则在[导航与内容清单](/guide/navigation)；React 组件与 slots 的组合方式在[用 FolioApp 与 slots 组合 React 页面](/guide/runtime-composition)；分层的职责归属在 [Core、UI、Build 与站点边界](/guide/architecture)。

> 本文以 `dev` 源码为准。npm 已发布 `0.1.1` 的字段与组件边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准，两者差异集中列在文末。

## 最小可用站点

```ts
// folio.config.ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "My Site",
  description: "用 Markdown 维护的文档与文章站点。",
  siteUrl: "https://example.com",
  github: "https://github.com/example/my-site",
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

export default defineConfig({
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

`defineFolioConfig` 只保留对象字面量的类型推断，不做运行时校验；`title` 与 `description` 必填，其余字段可选。字段少写不会报错，但对应能力会退回默认值或直接缺席——最典型的是 `siteUrl`：没有它就没有绝对 URL 的 canonical、`sitemap.xml`、`robots.txt` 与 feed。

React 入口把同一份 `config` 和 `virtual:folio/content` 交给 `FolioApp`，参考[组合 React 页面](/guide/runtime-composition)。

## 字段速查

| 字段 | 作用 | 说明 |
| --- | --- | --- |
| `title` / `description` | 站点身份 | 必填。Header 品牌文字取 `title`；站点与文档的 `description` 回退也取这里。 |
| `siteUrl` | 绝对 URL 的前置条件 | canonical、Open Graph、JSON-LD、`sitemap.xml`、`robots.txt` 与 feed 都依赖它。 |
| `github` | Header 仓库入口 | 默认 Header 在桌面与移动菜单都渲染这个链接；不配置就不显示。 |
| `logo` | 默认品牌图片 | Header 品牌区使用；静态页面没有 route 级图片时也作为 social image 的兜底。 |
| `author` | 默认作者 | 生成 Article／TechArticle JSON-LD 的作者；文档 Frontmatter 的 `author` 优先，两者都缺省时省略作者字段，不编造。 |
| `navigation` | 顶栏条目 | 详见[导航](/guide/navigation)。 |
| `collections` | 集合索引页 | 声明“哪些路由目录要生成集合索引页”，与侧栏分组无关。 |
| `home` | 内置首页 | 见下文“内置首页”。 |
| `footer` | 页脚 | 字符串、`false` 或结构化配置。 |
| `base` | 类型中保留的字段 | 当前 `dev` 源码不读取它。子路径由 Vite `base` 与 `<FolioApp basePath>` 决定，不要把它当成部署开关。 |

字段的完整类型定义以 `packages/folio/src/types.ts` 为准，本页只列入口与行为，不复制整份定义。组件级 Props 见 [FolioApp](/reference/components/app)、[FolioHeader](/reference/components/header) 与 [FolioFooter](/reference/components/footer)。

## 子路径部署

部署在项目子路径（例如 GitHub Pages 的 `/folio/`）时，两条链路必须一致：

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveGithubPagesBase } from "@uichat-mira/folio";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

const base =
  process.env.FOLIO_SITE_BASE ??
  resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);

export default defineConfig({
  base,
  plugins: [react(), folio({ contentDir: "content", config, staticRoutes: true })],
});
```

```tsx
// src/main.tsx
<FolioApp config={config} docs={docs} basePath={import.meta.env.BASE_URL} />
```

Vite 的 `base` 决定静态输出里每条路由与资源的前缀；`FolioApp` 的 `basePath` 决定 React Router 的 `basename`，默认 `/`。两者不一致时，本地预览可能正常，部署后却会白屏或 404：文件在 `/folio/` 下，而 Router 以为自己在根路径。`resolveGithubPagesBase()` 是公开 helper，按仓库名归一化出 `/repo/`（`<owner>.github.io` 仓库则为 `/`），返回结果已带首尾斜杠。

## Vite plugin

```ts
import { folio } from "@uichat-mira/folio/vite";

folio({
  contentDir: "content",
  config,
  exclude: (sourcePath) => /(^|\/)README\.md$/i.test(sourcePath),
  route: (sourcePath, doc) => doc.path.replace(/^\/legacy(?=\/|$)/, ""),
  staticRoutes: true,
});
```

处理链是固定的：读取 Markdown → `parseFolioDoc` → `exclude` → `route` → 归一化路径 → `compareFolioDocs` 排序。因此 `route()` 决定的不只是 URL，也包括导航归属与静态输出路径；旧 URL 兼容属于消费站的迁移策略，不要求 Folio 核心认识某个旧目录。

`staticRoutes` 有三态：

| 取值 | 行为 |
| --- | --- |
| 省略或 `true` | 使用默认静态构建：为所有路由写目录式 HTML，并生成 `404.html`；配置了 `siteUrl` 时再生成 `sitemap.xml` 与 `robots.txt`。 |
| `false` | 只提供虚拟模块与开发服务器，不写静态路由。 |
| `FolioStaticBuildOptions` | 自定义路由、首页覆写、notFound、feed、索引策略等。 |

`staticRoutes` 的完整字段、SEO 与 feed 配置见[静态构建与 SEO](/reference/seo)，构建阶段细节见 [Vite 构建集成](/reference/build-integration)。本章不重复这些清单。

## Header

默认 Header 由 Folio 渲染；可配置的是站点身份、顶栏条目与两个插槽：

```ts
export default defineFolioConfig({
  title: "Acme Docs",
  description: "产品文档与工程记录。",
  logo: "/brand/acme-wordmark.svg",
  github: "https://github.com/acme/docs",
  navigation: [
    { label: "指南", collection: "/guide" },
    { label: "参考", href: "/reference/overview", collection: "/reference" },
  ],
});
```

- `config.title` 与 `config.logo` 组成默认品牌区，品牌整体链接回站点根。`config.logo` 原样作为 `<img src>` 输出：部署在子路径时要自己带上 base（如 `${import.meta.env.BASE_URL}brand/logo.svg`），或改用 `slots.headerBrand`；Footer 的结构化 logo 则会自动解析 base。
- `config.github` 渲染 GitHub 入口；不配置时不出现。
- `config.navigation` 决定顶栏条目；省略时 `FolioApp` 回退到 `文档`（`/docs`）与 `博客`（`/blogs`）两条内置条目。这是兜底，不是推荐配置。
- 搜索入口与主题开关由 `ui` 开关控制，默认开启；它们属于 React 壳，静态 HTML 不包含。

需要替换品牌内容时使用 `slots.headerBrand`（`dev` 候选）：它替换的是品牌区里的内容，外层的站点根链接、顶栏布局与可达性仍由 Folio 管理：

```tsx
<FolioApp
  config={config}
  docs={docs}
  slots={{ headerBrand: <img src="/brand/acme-wordmark.svg" alt="Acme Docs" /> }}
/>
```

`slots.headerActions` 用于在 Header 右侧追加消费站自己的操作（版本切换、外部入口等），不改变导航与品牌。Folio 没有整体替换 Header 的插槽：如果需要完全不同的 Header，就不要把整个站点交给 `FolioApp`，而是自行组合 `FolioHeader`／`FolioDocsShell`，边界见[组合 React 页面](/guide/runtime-composition)。

## Footer

`config.footer` 接受三种形态，都不需要写 React：

```ts
// 1. 字符串：整段页脚文字
footer: "© 2026 Acme",

// 2. false：完全隐藏
footer: false,

// 3. 结构化门户页脚
footer: {
  brand: {
    name: "Acme Docs",
    description: "产品文档与工程记录。",
    href: "/",
    logo: { src: "/brand/acme-mark.svg", darkSrc: "/brand/acme-mark-inverse.svg", alt: "Acme" },
  },
  groups: [
    {
      title: "开始使用",
      links: [
        { label: "快速开始", href: "/guide/getting-started" },
        { label: "GitHub", href: "https://github.com/acme/docs", newTab: true },
      ],
    },
  ],
  legal: {
    copyright: "© 2026 Acme",
    // 按站点真实资质填写；没有备案信息就留空，Folio 不会替你生成。
    registrations: [],
    links: [],
  },
},
```

- 不配置 `footer` 时显示默认文本 `Built with Folio.`；`footer: false` 隐藏整块页脚。
- 内部链接（以 `/` 开头）走 React Router，外部链接保持普通 `<a>`；`newTab` 默认 `false`，外部链接也不会自动新开。
- 页脚 Logo 以 `/` 开头时按运行时 base 解析，因此根域与 `/folio/` 子路径都能用；其他 URL 视为消费站自己负责的地址。
- 结构化配置只覆盖常见门户信息层级，不引入主题或布局 DSL；完整自定义 DOM 用 `slots.footer`，由消费站自己提供 `<footer>` 语义与样式。
- 文档阅读壳里可以用 `ui.footerOnDocs: false` 同时隐藏站点 Footer 与正文 `articleFooter`。这个开关只作用于 `type: doc` 的阅读布局；首页、文章与普通页面不受影响，默认 `true`。
- Footer 是 React 组件：静态路由的 HTML 使用站点 `index.html` 模板与 `staticRoutes` 提供的正文，不会自动携带 React Footer。`slots.footer` 同样只影响运行时。

## 内置首页

`config.home` 只配置内置首页，不需要复制默认组件，也不维护第二份首页数据：

```ts
home: {
  // 以下 route 都属于示例站点自己的内容，不是 Folio 内置页面。
  meta: { left: "FIELD NOTES", right: "ARCHIVE" },
  sections: [
    { type: "intro", title: "写在前面" },
    { type: "featured", collection: "/notes" },
    { type: "recent", collection: "/notes", limit: 3 },
    { type: "collections", paths: ["/projects"], limit: 2 },
    { type: "about", path: "/info/about", linkLabel: "继续阅读" },
  ],
}
```

`meta` 与 `sections` 都可选：

- `meta: false` 隐藏顶部信息条；省略时使用默认文案。
- `sections` 的数组顺序就是渲染顺序；省略时保留默认顺序 `intro → featured → recent → collections → about`；`sections: []` 只保留可选的 meta 条。

各区块的选择来源都落在 `config.collections` 的路由集合上，不写死 `/blogs` 或 `/projects`：

| 区块 | 关键字段 | 说明 |
| --- | --- | --- |
| `intro` | `collection`、`title`、`description`、`kicker` | 介绍区；`collection` 缺省用第一个集合。 |
| `featured` | `collection`、`path`、`label`、`readLabel` | `path` 优先于集合排序。 |
| `recent` | `collection`、`limit`、`title`、`label`、`emptyMessage`、`endMessage` | `limit` 默认 4；被精选的条目不会重复出现。 |
| `collections` | `paths`、`limit`、`emptyMessage` | `paths` 缺省显示除主集合外的全部集合；`limit` 默认 3。 |
| `about` | `path`、`title`、`description`、`linkLabel` | 缺省使用第一个 `page` 类型内容。 |

同一个模型由公开的 `resolveFolioHome(config, docs)` 产出，React 首页与默认静态首页共用它，所以选择、排序与链接不会分叉。首页有三条路径，区别只在“替换到哪一层”：

1. **默认首页**：既不设置 `home`，也不设置 `slots.home`。
2. **配置自定义**：设置 `config.home`，React 与默认静态首页一起变化。
3. **完整覆写**：`slots.home` 换掉 React 的 `/`；静态侧用 `staticRoutes.home` 只替换 `/` 的正文与元数据，或在自有 `staticRoutes.routes` 中调用 `renderFolioStaticHome(context)`（来自 `@uichat-mira/folio/vite`）。`slots.home` 不会自动生成静态 HTML。

`slots.home` 的优先级高于 `config.home`：只要提供了 React 节点，React 首页就完全使用该节点，静态侧仍需单独提供对应正文。官方站就是 `slots.home` 的真实消费例，见[这个站就是 Folio 的测试用例](/reference/site)。

## 主题与品牌接口

> **版本边界：** 以下 `appearance`、`home.template`、`FolioHome`、`useFolioAppearance()` 是当前 **`dev` 源码**的能力，**尚未进入 npm 0.1.1**。已经安装 npm 0.1.1 的项目不要直接复制使用；需等待包含这些 API 的版本正式发布。

`config.appearance` 定义三条互不绑定的外观维度，`home.template` 单独选择内置首页结构：

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "我的 Folio 站点",
  description: "由 Folio 构建的内容与门户",
  appearance: {
    preset: "pearl",      // pearl | editorial | graphite
    scheme: "system",     // system | light | dark
    codePalette: "auto",  // auto | xuanzhi | xuanmo
  },
  home: { template: "portal" }, // portal | editorial
});
```

- **Preset** 决定整站语义颜色，**Scheme** 决定浅色 / 深色（`system` 随操作系统变化）；**Code Palette** 独立决定代码表面及语法高亮（`auto` 跟随最终明暗），不会替换整站的设计主题。
- **Home Template** 仅决定框架**内置首页**的 Portal / Editorial 渲染方式。官网自身的 `slots.home` 是自定义首页，因此它在 Design 板块中只做模板预览，不替换官网首页。
- 在 `FolioApp` 内，`useFolioAppearance()` 提供 `appearance`、`effectiveScheme`、`preview(partial)`、`resetPreview()`。`preview()` 只在当前会话临时覆盖外观，不写本地存储；`resetPreview()` 恢复读者已有的明确选择，然后是站点配置和系统偏好。
- Header 的用户主动明暗切换才会持久化到 `folio-theme-choice`；操作系统的最终深浅值不会伪装成读者选择。旧的 `folio-theme` 不再作为显式用户选择读取。
- `ui.defaultTheme` 仍接受 `"light" | "dark" | "system"`，它作为 React 应用的初始偏好，优先级高于 `config.appearance.scheme`，但低于读者明确选择及临时预览。
- React 应用由 `FolioApp` 单独维护根元素上的 `data-folio-preset`、`data-folio-theme`、`data-folio-code-palette`。消费站不得自行争抢这些状态；静态 HTML 仍由 Folio 的 CSS `prefers-color-scheme` 回退照顾无 JS 场景。
- `ui.theme: false` 关闭读者主题切换并固定浅色渲染；如要跟随系统，请保持主题功能启用。

需在自定义 React 页面预览内置模板时，直接使用 `<FolioHome config={config} docs={docs} template="editorial" as="div" />`。它使用真实模型和 React Router 的 basePath；嵌入已有 `<main>` 时请指定 `as="div"`，不要生成嵌套 `main`。

官网首页 [Design 主题实验区](/#portal-design-title) 可现场切换四维配置，并复制本节同形状的 `folio.config.ts`。它使用 `FolioMarkdown` 展示真实语法配色，而非仿制代码卡片。

品牌接口保持独立：`config.logo` / `config.title` 和 `slots.headerBrand` 决定 Header 品牌内容，结构化 Footer 的 `brand.logo.src` / `darkSrc` 提供对应素材。公共 `@uichat-mira/folio/styles.css` 包含 `--folio-*` Token，消费站可以添加自己的 `--site-*` 透明别名；官网不再固定覆写所有预设的核心主色。

## 发布状态与 dev 标签

`dev` 源码与 npm `0.1.1` 的差异还包括新的主题与可组合首页 API。发表文章、写文档时不要把 `dev` 能力当成已发布能力：

| 能力 | `dev` 源码 | npm `0.1.1` |
| --- | --- | --- |
| `title` / `description` / `logo` / `siteUrl` / `github` | 支持 | 支持 |
| `navigation` 的 `label` / `href` | 支持 | 支持 |
| `navigation` 的 `collection` 简写、`children`、`panel`、`activeMatch` | 支持 | 不支持 |
| `collections`（含 `archive`）、`home`、`author` | 支持 | 不支持 |
| 结构化 `footer`、`footer: false` | 支持 | 不支持（只有字符串） |
| `slots.headerBrand` / `navigation` / `docToc` / `footer` | 支持 | 不支持 |
| `ui.footerOnDocs` | 支持 | 不支持 |
| `appearance.preset` / `scheme` / `codePalette`、`home.template` | 支持 | 不支持 |
| `useFolioAppearance()` / `FolioHome` 运行时组件 | 支持 | 不支持 |

差异的权威描述与逐项行为在[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)；本文不把 `dev` 候选契约表述成已发布承诺。

## 相关文档

- [导航与内容清单](/guide/navigation)：顶栏条目、集合简写、侧栏树与 Collection／Section。
- [用 FolioApp 与 slots 组合 React 页面](/guide/runtime-composition)：完整消费站配置与 slots 示例。
- [Core、UI、Build 与站点边界](/guide/architecture)：分层、公开入口，以及默认壳与自定义页面各自的所有权。
- [静态发布](/guide/static-publishing)：静态路由、SEO 产物与无 JS 阅读。
- [静态构建与 SEO](/reference/seo)：`FolioStaticBuildOptions` 的完整字段。
