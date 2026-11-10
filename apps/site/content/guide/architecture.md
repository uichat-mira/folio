---
title: Core、UI、Build 与站点边界
description: Folio 的三层实现、五个公开入口，以及默认壳、自定义页面与消费站之间到底谁拥有什么。
group: 组合
collection: 指南
order: 24
type: doc
status: published
tags:
  - Architecture
  - Core
  - Build
  - Consumer
---

Folio 把“内容契约、React 呈现、静态构建”拆成三层，并把它们放进同一个 npm 包。理解这三个名字，就能判断一个新需求该落在哪一层、该不该改这个仓库。

本文说明：分层与依赖方向 → 公开入口 → React／静态两个投影 → 仓库与消费站边界 → 四种页面所有权 → 升级与契约。配置、导航与组合分别在[站点配置与扩展](/guide/configuration)、[导航与内容清单](/guide/navigation)与[组合 React 页面](/guide/runtime-composition)。

## 一个包，三层实现

```text
packages/folio/src/
├── types.ts, core/        Core：内容与配置的纯逻辑，不依赖 React／DOM
├── ui/**, app.tsx …       UI：React 外壳、组件与 slots
├── build/**, static*.ts   Build：Vite 插件、虚拟模块与静态 HTML
└── index.ts               公开 barrel，只做 re-export
```

| 层 | 负责 | 明确不负责 |
| --- | --- | --- |
| **Core** | `FolioDoc`／`FolioConfig` 类型、Frontmatter 与 Markdown 解析、`defineFolioConfig` 等配置 helper、文档结构与导航树、集合索引、归档索引、首页模型、搜索、页内目录树 | React、DOM 全局、Vite、读写磁盘 |
| **UI** | `FolioApp` 路由与外壳、`FolioHeader`／`FolioFooter`／`FolioDocsShell`／`FolioTreeNav`／`FolioToc`、Markdown 的 React 渲染、主题状态、slots | 生成静态文件、写 `sitemap.xml`、直接读内容目录 |
| **Build** | `folio()` 插件、`virtual:folio/content`、静态 route HTML、SEO／canonical／JSON-LD、`404.html`、sitemap、robots、feed、可选 PWA 产物 | React 组件渲染、浏览器状态、设计表达 |

`index.ts` 只是公开出口，不拥有行为。

依赖方向是单向的：

```text
Core  ←  UI
Core  ←  Build
```

UI 与 Build 是**兄弟层**，彼此从不 import。所以 React 壳不能偷偷调用静态写入函数，静态构建也不能复用某个 React 组件的 DOM 结果。两边共享的是 Core 模型，而不是彼此的实现。

这条规则不是约定俗成，而是有门禁的：`packages/folio/scripts/dependency-layers.mjs` 会读取真实的 import／re-export 边与包导入，检查 Core 没有引用 React、Vite 或 DOM 全局（`document`、`window`、`localStorage` 等），UI 与 Build 没有互相引用，且每个源文件都被明确归层。它由 `packages/folio` 的测试执行，也就是随 `npm test` 与完整 `release:check` 一起跑。未分类的新文件会直接失败，避免悄悄绕过边界。

两个可见结果：

- `types.ts` 属于 Core，因此导航条目的 `icon` 只能是字符串，不能是 React 组件。这条“限制”正是 Core 能同时服务 React 与静态构建的原因。
- Markdown 渲染被拆成 `core/markdown.ts`（返回 HTML 字符串）与 `markdown-react.tsx`（插入该字符串并做浏览器增强）：同一份输出进入页面与静态文件，不会出现两套渲染规则。

## 五个公开入口

包的 `exports` 字段决定消费站能 import 什么：

| 入口 | 层 | 内容 |
| --- | --- | --- |
| `@uichat-mira/folio` | 运行时 + Core | `FolioApp` 等 React 组件、Core 函数、公共类型 |
| `@uichat-mira/folio/vite` | Build | `folio()`、虚拟模块、静态 helper 与 `FolioStatic*` 类型 |
| `@uichat-mira/folio/pwa` | Build | 可选 PWA 集成；不调用 `folioPwa()` 就不产生产物 |
| `@uichat-mira/folio/pwa/react` | UI | 可选的更新提示组件与 hook |
| `@uichat-mira/folio/styles.css` | 样式 | 整站默认 token 与组件样式（CSS only） |

`packages/folio/src/*` 的深层路径没有对外导出，也不该被消费站 import——官方站自己也不例外。官方站只从上面五个入口取能力，这件事由[案例页的公开规则](/reference/site)约束。

## 两个投影：React 与静态

同一份 Core 模型会投影成两个产物：

| Core 模型 | React 投影 | 静态投影 |
| --- | --- | --- |
| `buildFolioNavigationTree` | `FolioTreeNav` 侧栏 | `renderFolioStaticTreeNav(context, doc)` |
| `resolveFolioHome` | 内置首页或 `config.home` | 默认静态首页或 `renderFolioStaticHome(context)` |
| `folioCollectionIndexes` / `selectFolioCollectionDocs` | 集合索引页与首页选材 | 集合页 HTML 与 sitemap 条目 |
| `buildFolioArticleArchiveIndex` | 归档路由与标签链接 | 归档页 HTML |
| `buildFolioOutlineTree` | `FolioToc` | `renderFolioStaticToc(headings, { title })` |
| `getFolioDocByline` | `FolioDocMeta` | `renderFolioStaticDocMeta(doc)` |
| `renderFolioMarkdown` | `FolioMarkdown` | `renderFolioStaticDocumentBody(doc, html)` |

因此选择、排序与链接在两个产物里一致。但“能渲染什么”不同：

- **只在 React 出现**：顶栏下拉菜单、搜索覆盖层、主题切换、分享按钮、所有 slots、`localStorage` 偏好。
- **只在 Build 出现**：`404.html`、`sitemap.xml`、`robots.txt`、canonical／Open Graph／Twitter Card／JSON-LD 注入、feed、可选 PWA manifest 与 Service Worker。

这也是“slot 不会自动改变无 JS 静态 HTML”的结构性原因：构建阶段根本拿不到 React 组件实例。需要静态输出跟随自定义布局，就要在 `staticRoutes` 里显式提供 HTML——通常复用上表静态列的公开 helper。

## 仓库与消费站边界

```text
uichat-mira/folio
├── packages/folio   @uichat-mira/folio（三层实现与公开入口）
├── apps/site        官方 reference implementation（自己的品牌与组合）
├── schemas          config.schema.json / content.schema.json
└── .github/workflows validate / pages / publish / dev-preview / review
```

| 归属 | 拥有 |
| --- | --- |
| Folio 包 | 内容模型、解析、运行时契约、默认组件、静态构建契约、公开类型 |
| 官方站 `apps/site` | 品牌、首页叙事、Header 操作、静态路由组合、`/folio/` 子路径部署；不得使用隐藏接口 |
| `schemas` | 仓库内配置与内容的 JSON Schema，随官网站点一起发布 |
| 消费站 | 自己的内容仓库、品牌与交互、URL 兼容策略、PWA 与搜索等可选集成、部署平台、额外 Frontmatter 字段 |
| Organization Skill | 属于 `uichat-mira/.github`，编排 GitHub 操作；不在本仓库维护第二份副本，也不获得绕过仓库权限的特权 |

额外 Frontmatter 不会丢：未知字段进入 `doc.data`，消费站可以自行读取，Folio 不替它解释。这是“扩展内容而不改 runtime”的最小入口。

Folio 不把 GitHub、Agent、CMS 或发布编排塞进 runtime：这些属于消费站的工作流，不属于内容契约。

## 四种页面所有权

同一个页面可以由不同层级拥有，边界取决于消费站接管到哪一步：

| 模式 | 谁渲染 | 无 JS 时可读性 | 典型用途 | 消费站要提供 |
| --- | --- | --- | --- | --- |
| 默认 React 壳 | `FolioApp` + 默认组件 | 取决于静态输出 | 普通文档站 | 只写内容与 `FolioConfig` |
| 默认静态壳（`staticRoutes: true`） | Build 的通用文档壳 | 侧栏、页内目录、上一篇／下一篇可用 | 文档站默认发布 | 无 |
| 自定义静态路由（`staticRoutes.routes`） | 消费站的静态渲染代码 | 由消费站决定；可复用静态 helper | 品牌化静态页面 | 路由数组、markup、SEO 数据 |
| 不用 `FolioApp` | 消费站自己的 Router + 公开组件 | 由消费站决定 | 已有站点的局部嵌入 | 路由、布局与数据传递 |

关键差别不在“好看”，而在**谁负责无 JS 阅读路径**：

- 默认静态壳自己保证禁用 JavaScript 时仍能读文档。它不含顶栏，因为顶栏是 React Header 的能力。
- 一旦消费站提供 `staticRoutes.routes`，路由数组就是全站真相源，页面正文由消费站拥有；想要侧栏、目录与分页，就调用公开 helper 自行组合。
- 首页唯一的窄覆写是 `staticRoutes.home`：只替换 `/` 的正文与元数据，其余路由、`404.html`、sitemap 与 robots 保持默认。
- React 侧无论怎么组合，都不改变静态侧；反过来，静态覆写也不会改变 React 页面。

## 升级与契约

- Folio 优先保持公开 API：新增能力走可选字段与可选插槽，已有配置继续编译、继续渲染。`{ label, href }` 顶栏条目、`footer` 字符串这些旧写法都在此类。
- `styles.css` 是**整站样式表**，不是隔离的嵌入样式；它会设置 `:root` token、`box-sizing`、`body` 与链接、按钮的基础规则。嵌入既有品牌页属于单独场景，规则见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)。
- 技术现实的优先级是代码与配置，其次是 `docs/consumer-contract.md`；后者是消费者承诺的唯一真相源。已发布 `0.1.1` 与 `dev` 源码的差距必须在文档里标成 `dev` 候选，不能混写成已发布能力。
- 仓库门禁是 `npm run validate`（类型检查、测试、样式所有权、OG worker、站点构建）与 `npm run release:check`（再加打包与真实 consumer 安装验证）。纯文档改动也要过站点 typecheck/build 与现有路由核验，不能用“只是文档”绕过。
- 判断需求归属的最快方式：需要改 `packages/folio` 才能表达的**品牌或叙事**，说明它本就该留在消费站；需要改消费站才能表达的**内容契约**，说明 Folio 的抽象还不完整。

## 相关文档

- [站点配置与扩展](/guide/configuration)：`FolioConfig`、Vite plugin、Header／Footer／首页与主题。
- [导航与内容清单](/guide/navigation)：Collection／Section、顶栏条目与文档树。
- [用 FolioApp 与 slots 组合 React 页面](/guide/runtime-composition)：一套完整消费站与七个 slots。
- [静态发布](/guide/static-publishing)：Build 层实际写出的文件。
- [这个站就是 Folio 的测试用例](/reference/site)：官方站遵守的公开 API 规则。
