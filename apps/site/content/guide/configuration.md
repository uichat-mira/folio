---
title: 站点配置与扩展
description: FolioConfig、Vite plugin options 与 React slots 的公共契约。
group: 概念
collection: 指南
order: 21
type: doc
status: published
tags:
  - Config
  - Slots
---

## FolioConfig

```ts
type FolioConfig = {
  title: string
  description: string
  author?: FolioAuthor | FolioAuthor[]
  logo?: string
  siteUrl?: string
  base?: string
  navigation?: {
    label: string
    href: string
    /** 额外的路由前缀，命中即视为当前页；只影响高亮，不改变渲染形态。 */
    activeMatch?: string[]
    children?: {
      label: string
      href: string
      icon?: string
      description?: string
      /** 阅读任务分组；省略时面板保持旧版的扁平结构。 */
      group?: string
    }[]
    panel?: {
      eyebrow?: string
      title?: string
      description?: string
      overviewLabel?: string
    }
  }[]
  collections?: {
    path: string
    title?: string
    description?: string
    emptyMessage?: string
  }[]
  home?: FolioHomeConfig
  footer?: string | false | FolioFooterConfig
  github?: string
}
```

`title` 与 `description` 是必填项。`author` 是生成 Article/TechArticle JSON-LD 时的默认作者；文档 Frontmatter 的 `author` 优先，两者都缺失时不生成作者字段。`siteUrl` 也是 canonical、sitemap、robots 与 feed URL 的前置条件。

本页描述当前 `dev` 源码。`collections`、`home` 与 `author` 属于尚未包含在已发布 `0.1.1` 中的候选契约；已发布包的能力边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。

## 门户 Footer 配置

Footer 已抽成公开的 FolioFooter 组件（包内 src/ui/footer/）。原有字符串配置保持不变；不配置时仍显示默认 Built with Folio.，设置为 false 可以隐藏页脚。需要标准门户信息层级时使用结构化配置：

~~~ts
footer: {
  brand: {
    name: "Folio",
    description: "Git-native 内容与门户发布引擎。",
    logo: { src: "/folio-logo.svg", darkSrc: "/folio-logo-inverse.svg", alt: "Folio" },
  },
  groups: [
    {
      title: "使用指南",
      links: [
        { label: "快速开始", href: "/guide/getting-started" },
        { label: "GitHub", href: "https://github.com/uichat-mira/folio", newTab: true },
      ],
    },
  ],
  legal: {
    copyright: "© 2026 Mira Organization",
    // 按站点真实资质填写；没有备案信息就不要添加。
    registrations: [],
    links: [],
  },
},
~~~

内部链接通过 React Router 跳转；以 / 开头的 Logo 资源路径会根据站点部署子路径解析。也可通过 FolioApp 的 slots.footer 完全替换默认页脚（自行提供 footer 语义元素）。

使用 Folio 阅读壳（`docsShell`）时，`<FolioApp ui={{ footerOnDocs: false }} />` 会同时隐藏全站 Footer 和正文 `articleFooter` 插槽。它适用于 `type: doc` 文档阅读壳，独立文章和页面不会因为此开关被隐藏 Footer。首页、文章和集合页不受影响。默认值为 `true`，保留已有消费者行为；`slots.footer` 也服从阅读壳的显示策略。此开关由布局决定，而非按内容类型分别设置；若关闭 `docsShell`，普通页面布局独立决定 Footer。静态路由正文的预渲染不会额外注入 React 应用 Footer。

## 内置首页配置

`FolioConfig.home` 只配置内置首页，不需要复制静态路由或默认组件：

```ts
home: {
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

`sections` 的数组顺序就是首页区块顺序；省略时保留默认顺序，`[]` 只保留可选的 meta 条。精选与近期内容复用 `config.collections` 的路由集合，不写死 `/blogs` 或 `/projects`。`resolveFolioHome(config, docs)` 会返回 React 与默认静态首页共用的结构化模型。

## 三种首页路径

1. **直接使用默认首页**：不设置 `home`，也不设置 `slots.home`。
2. **通过配置自定义**：设置 `config.home`；React 与默认静态首页使用同一份选择与排序。
3. **高级完整覆写**：`slots.home` 仍然完整替换 React 首页；`staticRoutes.home` 只替换静态 `/`，其他路由、404、sitemap 与 robots 不变。完整自定义静态 `routes` 时，该路由数组仍然是全站真相源；需要时可在其中调用 `renderFolioStaticHome(context)`。

静态 `staticRoutes.home` 接收显式 HTML，不能把任意 ReactNode 自动变成静态 HTML；SSR 与 React 服务端渲染由 consumer 自行负责。以上 `home` 配置与 `staticRoutes.home` 是 `dev` 候选契约，未包含在已发布的 `0.1.1` 中。

## Vite plugin

```ts
type FolioPluginOptions = {
  contentDir?: string
  config: FolioConfig
  staticRoutes?: boolean | FolioStaticBuildOptions
  exclude?: (sourcePath: string) => boolean
  route?: (sourcePath: string, doc: FolioDoc) => string
}
```

`contentDir` 默认是 `content`。`exclude` 在解析后过滤文件，`route` 用于 consumer 级 URL 兼容。`staticRoutes` 的完整字段、SEO、索引策略与 feed 配置见 [静态构建与 SEO](/reference/seo)。

## React slots

```ts
type FolioSlots = {
  home?: ReactNode
  headerActions?: ReactNode
  articleFooter?: ReactNode
  navigation?: (props: FolioTreeNavProps) => ReactNode
  docToc?: (props: FolioTocProps) => ReactNode
  footer?: ReactNode
}
```

### 可复用文档导航与页内目录

左右栏是 Folio 的独立公开组件，均从 `@uichat-mira/folio` 导出，沿用原有单入口 CSS。消费者可独立使用组件，也可组合到文档阅读壳里：

- `FolioTreeNav`：唯一左侧导航渲染器，接收 `tree` 和 `currentPath`；普通与嵌套技术文档均可使用，支持路由、分组标题、层级与展开状态。
- `buildFolioNavigationTree(docs, current, { scopePath? })`：Core 纯函数，生成统一导航树；可通过 `scopePath` 显式声明范围。默认以文档集合和内容路由推导范围，不维护第二份导航清单。
- `FolioToc`：传入 `headings`，按标题生成锚点与滚动高亮，支持 `className`、`onNavigate`，空列表不渲染。

导航的 `collection / section` 分类始终显示为**不可点击、不可折叠的标签**；只有有子页面的内容父节点才出现 `+ / −`。标题链接负责导航，右侧按钮独立控制展开／收起；整行共享背景与圆角，选中态高于悬停态。FolioApp 将展开状态保存在阅读路由上层，换文章时不会丢失。当前文章的祖先初始展开，其他有概览的分支初始收起；点击箭头不会切换路由。展开区域按实际内容高度平滑变化，折叠时子链接不可获取焦点，并尊重操作系统的减少动态效果设置。公共 `FolioTreeExpansionProps` 继续支持 `defaultExpanded`、`expandedPaths`、`onExpandChange`；`collapsible: false` 可显式切回路由驱动的无按钮模式。没有 JavaScript 时静态页面保留完整链接，不渲染无效按钮。

默认无需配置。想覆盖内置文档页的左右栏，可以使用动态渲染插槽：

```tsx
import { FolioApp, FolioTreeNav, FolioToc } from "@uichat-mira/folio";

<FolioApp
  config={config}
  docs={docs}
  slots={{
    navigation: (props) => <FolioTreeNav {...props} className="my-tree-nav" />,
    docToc: (props) => <FolioToc {...props} className="my-doc-toc" />,
  }}
/>
```

插槽会随着当前文档自动收到新数据，桌面和打开的移动端菜单使用同一渲染方式。移动端 `props.onNavigate` 用于跳转后关闭抽屉，覆写时应继续传递。若完全替换导航 DOM，消费者应保持相应语义、布局类名和无障碍行为；独立使用 `FolioTreeNav` 时需位于 React Router 内。

静态 HTML 仍使用默认导航和 TOC，保证无 JS 时能浏览。React 的插槽不自动改变静态构建输出，消费者若需要自定义静态布局，应通过站点的 `staticRoutes` 管理。

### 文档目录与父级推导

层级文档不需要手工维护目录清单，也不需要在每篇文档上填写父级 ID。为文档声明相同的 `collection` 与 `section`，Folio 就会从路由路径构建导航层级：

~~~text
projects/
  com-design/
    index.md                     # 项目概览 -> /projects/com-design
    repeated-operations/
      index.md                   # 子文章 -> /projects/com-design/repeated-operations
    notes/
      design-principles/
        index.md                 # 深层文章，继续嵌套
~~~

Frontmatter 示例：

~~~yaml
---
type: doc
collection: 示例文档
section: 案例
title: "ComDesign：AI 时代的设计系统实验"
order: 2
description: "关于设计系统的长期探索"
---
~~~

- 默认情况下，Markdown 路径自动推导 URL，目录中的 `index.md` 对应概览父节点，子目录文章成为它的后代。
- 同章节内的子文档依 `order` 排序；当前页会高亮，上一篇／下一篇按同一文档导航树的可见顺序移动。
- 如果父目录暂时没有 `index.md`，文档导航仍可显示实际子文档，**不会创建假的概览链接**；单独使用 `buildFolioContentTree()` 时可得到不可点击的隐式目录节点。
- 显式设置 `path` 会覆写默认路由，因此也会改变导航归属；不同项目之间只按完整路径段匹配，避免相似前缀误归属。

普通技术文档和层级文档都通过 `FolioTreeNav` 渲染，不再需要项目专用侧栏。`buildFolioNavigationTree(docs, current, { scopePath? })` 统一组合文档分类与子文档；`buildFolioContentTree` 仍可独立构造纯路由目录树。需要独立排版时也可以自行组合：

~~~tsx
import {
  buildFolioContentTree,
  FolioTreeNav,
} from "@uichat-mira/folio";

const tree = buildFolioContentTree(docs, { rootPath: "/projects" });
<FolioTreeNav tree={tree} currentPath={currentDoc.path} />;
~~~

消费者使用唯一的 `slots.navigation(props)` 自定义侧栏，回调接收 `tree`、`currentPath` 和 `onNavigate`，对普通与嵌套文档完全一致。移动端应继续传递 `onNavigate`，以便跳转后关闭抽屉。

Folio 的静态构建与 React 使用同一份 Core 树形模型；自定义 `staticRoutes` 如需复用旧 `renderFolioStaticProjectShell(context, doc, markdownHtml?)`，该导出目前仅作为兼容入口，内部转用普通文档阅读壳，不再提供项目特权；新站点应优先使用普通 `doc` 与默认静态文档路由。

官方 Folio 首页就是 `slots.home` 的真实 consumer。`slots.home` 的优先级高于 `config.home`：只要提供 React 首页节点，就完全使用该节点。

品牌、复杂 landing page 和额外交互属于 consumer；Folio runtime 不需要为官网增加隐藏接口。完整的首页定制边界见[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md#configurable-built-in-home-fol-030-candidate-not-published-in-011)。
