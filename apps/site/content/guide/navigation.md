---
title: 导航与内容清单
description: 从 virtual manifest、collection 与 section 到顶栏条目和侧栏树：导航如何由内容与配置共同推导。
group: 概念
collection: 指南
order: 22
type: doc
status: published
tags:
  - Navigation
  - Collection
  - Virtual Module
---

Folio 不让 React 组件自己扫描文件。内容发现只在构建层发生一次，导航再从同一份清单推导；因此侧栏、集合页、静态输出与顶栏高亮不会各自维护一份目录。

本文覆盖：内容清单 → 导航的四处来源 → Collection／Section → 顶栏条目 → 文档树 → 无 JS 边界。站点级字段见[站点配置与扩展](/guide/configuration)。

## virtual manifest

```ts
import docs, { roots } from "virtual:folio/content";
```

- `docs`：构建期发现并排序后的 `FolioDoc[]`，排序规则统一由 `compareFolioDocs` 决定。
- `roots`：内容源里的顶层目录名，用于需要按目录分组的消费场景。

Markdown 变更时，插件让虚拟模块失效并触发整页刷新。开发者不需要、也不应该在 React 里再写一套文件扫描或索引。

`@uichat-mira/folio` 已随包提供虚拟模块的类型声明；只在独立 TypeScript 工程里导入虚拟模块、完全不导入任何 Folio 入口时，需要在 `compilerOptions.types` 中注册 `@uichat-mira/folio`，而不是自己写 `declare module`。细节见[Vite 构建集成](/reference/build-integration)。

## 导航由四份来源组成

| 阅读位置 | 来源 | 谁渲染 | 是否来自内容目录 |
| --- | --- | --- | --- |
| 顶栏（Header） | `config.navigation` | React `FolioHeader` | 否，配置驱动 |
| 文档侧栏 | Frontmatter `collection` + `section`／`group`，叠加路由树 | `FolioTreeNav` | 是 |
| 集合索引页 | `config.collections[].path` | React 集合页与静态集合页 | 声明路由目录 |
| 首页 | `config.home` 或 `slots.home` | 内置首页或消费站组件 | 从集合中取内容 |

规则很简单：**顶栏是产品级入口，侧栏是阅读路径**。顶栏不会自动收录侧栏里的每一篇文档，侧栏也不会因为顶栏新增一个链接而改变结构。两者唯一共享的是同一份文档清单与同一套激活判断。

## Collection 与 Section

`collection`、`section`、`group` 是三个不同层级的字段，回答的问题不同：

```yaml
---
title: 内容模型
description: Folio 如何把 Markdown 变成统一的 FolioDoc。
type: doc
collection: 指南      # 侧栏标题：哪些页面放在同一个侧栏里读
section: 概念         # 侧栏内的小标题：同一侧栏里的阅读任务分组
group: 概念           # 没有 section 时的兼容回退
order: 20             # 组内排序
---
```

- **`collection`**：决定侧栏标题，也决定哪些页面出现在这个侧栏里。没写时回退到字面量 `文档`，因此一个站点可以只有一条侧栏，也可以有多条，且不需要移动任何 Markdown 文件。
- **`section`**：同一侧栏内的小标题。省略时回退到 `group`；两者都没有时归入 `文档`。分组按其第一篇文档的 `order` 排序。
- **`group`**：历史字段，继续作为 `section` 的回退并被搜索与部分页面读取；新内容优先写 `section`。
- **`order`**：同组内的阅读顺序，也是上一篇／下一篇与静态分页的依据。

关键区分是：`config.collections` **不参与**侧栏分组。它声明的是“哪个 URL 目录要生成集合索引页”。

```ts
collections: [
  { path: "/guide", title: "指南", description: "从定位读到发布。" },
  { path: "/blogs", title: "博客", archive: true },
],
```

所以，「哪些文档该放在一起读」用 Frontmatter `collection`；「哪条路由该有索引页」用 `config.collections`。两者可以、也应该用同一个名字：当内容目录、路由根、`config.collections.path` 与 `collection` 值四处一致时，读者在 `/guide/...` 看到指南侧栏、指南索引与点亮的指南顶栏条目，只有一个分界。

## 顶栏条目

最小形态是一个普通链接，行为与旧版本完全一致：

```ts
navigation: [
  { label: "博客", href: "/blogs" },
  { label: "关于", href: "/about" },
]
```

### 用 `collection` 简写声明入口

只写 `collection`，Folio 会同时解析入口与高亮范围：

```ts
navigation: [
  { label: "指南", collection: "/guide" },
  { label: "参考", href: "/reference/overview", collection: "/reference" },
]
```

- 入口 = 该集合读序第一篇 **`type: doc`** 文档（与集合页、侧栏使用同一排序）。集合里没有文档条目时取第一条内容，集合为空时回退到集合索引页。
- `activeMatch` 会自动包含集合根，因此 `/guide/*` 的任意页面都会点亮该条目，而不只是落地页的子树。
- `href` 同时存在时优先决定入口；`collection` 只继续补充高亮根。上例的参考入口固定在 `/reference/overview`，但整个 `/reference/*` 都保持点亮。
- `resolveFolioNavigation(items, docs)` 需要内容才能找到第一篇；`FolioApp` 已把 `docs` 传给 `FolioHeader`。单独使用 `FolioHeader` 的消费站要自己传 `docs`，否则回退到集合索引页。

### 结构化下拉菜单

顶层条目可以带 `children` 与 `panel`；两者都可选，只写 `label`／`href` 的条目不受影响：

```ts
navigation: [
  { label: "博客", href: "/blogs" },
  {
    label: "文档",
    href: "/guide/introduction",
    children: [
      { label: "快速开始", href: "/guide/getting-started", group: "入门", icon: "terminal", description: "装依赖、接插件、跑通第一篇文档。" },
      { label: "内容协议", href: "/guide/content-contract", group: "入门", icon: "file", description: "Frontmatter 与目录即路由。" },
      { label: "Frontmatter 参考", href: "/reference/frontmatter", group: "查阅", icon: "code", description: "字段、默认值与扩展规则。" },
    ],
    panel: { eyebrow: "HANDBOOK", title: "按要做的任务读", overviewLabel: "文档目录" },
  },
]
```

- `group` 标记阅读任务：回答同一个问题的条目渲染在同一标题下。分组按首次出现顺序排列，未分组的条目汇总为一段无标题内容排在最前。完全不写 `group` 时面板保持旧版扁平结构。
- 面板内部只有两级：阅读任务标题，以及该任务下的链接。更深的层级属于文档侧栏，不应塞进 Header 下拉。
- 触发器的普通点击用于展开面板，因此 Header 会自动补一条指向该条目自身 `href` 的入口（标签取 `panel.overviewLabel`，默认 `全部{label}`）；如果 `children` 里已经有同一路由，就不重复添加。`panel.title` 默认使用条目 `label`。
- `icon` 是普通字符串而不是 React 组件：`types.ts` 属于 Core 层，不能引入 React。内置键为 `book`、`compass`、`layers`、`sparkles`、`code`、`file`、`archive`、`link`、`terminal`、`info`、`search`，其他值渲染为中性链接图标。
- 菜单结构完全由配置驱动，没有按路由硬编码的分支：任何路由都可以成为菜单。
- 桌面端支持悬停、点击与键盘展开；`Escape` 与点击面板外关闭，路由变化也会关闭。移动端使用独立的可展开手风琴，而不是把桌面面板压缩进窄屏。
- 需要自己实现 Header 的消费站可以复用导出的 `resolveFolioNavigation()`、`isFolioNavItemActive()` 与 `groupEntries()`，保持同一套归一化、激活与分组判断。

### 让一个条目覆盖多个路由目录

条目在自身 `href` 相同或位于其下方时才算当前页。如果一个条目横跨多个路由目录，仅靠前缀匹配就会在目录之外丢失高亮：

```ts
navigation: [
  {
    label: "指南",
    href: "/handbook/introduction",
    activeMatch: ["/recipes/authoring", "/recipes/content-model"],
  },
]
```

- `activeMatch` 是额外的路由前缀，命中即视为当前页。它可选，省略等价于空列表。
- 它只影响高亮，不影响渲染形态：带 `activeMatch` 的条目仍然是普通链接。
- 前缀会经 `folioNavHref()` 归一化，空白与重复值被丢弃，与 `href` 相同的前缀只是冗余而不是错误。
- 这里刻意用显式清单而不是整个目录前缀：更宽的前缀会让同一页同时点亮两个一级条目。若一个目录确实混装两类内容，就逐个列出页面。

`activeMatch` 修好的是高亮，不是结构：页面仍散在多个目录里时，路由、内容目录和侧栏 `collection` 会彼此对不上。**能决定内容布局时，更好的做法是给每种阅读模式一个路由根**，让目录、路由前缀、`config.collections` 与 `collection` 使用同一个名字。`activeMatch` 留给无法重排的 URL 空间：已经发布且被外部引用的路由，或由别的团队维护的内容。

## 文档树与父级推导

层级文档不需要手工维护目录清单，也不需要在每篇文档上填写父级 ID。为文档声明相同的 `collection` 与 `section`，Folio 就会从路由路径构建导航层级：

```text
guides/
  com-design/
    index.md                     # 概览 -> /guides/com-design
    repeated-operations/
      index.md                   # 子文章 -> /guides/com-design/repeated-operations
    notes/
      design-principles/
        index.md                 # 深层文章，继续嵌套
```

- 默认情况下 Markdown 路径自动推导 URL；目录中的 `index.md` 对应概览父节点，子目录文章成为它的后代。
- 同章节内的子文档依 `order` 排序；当前页会高亮，上一篇／下一篇按同一导航树的可见顺序移动。
- 父目录暂时没有 `index.md` 时，导航仍会显示实际子文档，**不会创建假的概览链接**；`buildFolioContentTree()` 单独使用时得到的是不可点击的目录节点。
- 显式设置 `path` 会覆写默认路由，因此也会改变导航归属；不同分支只按完整路径段匹配，避免相似前缀误归属。

公开的 Core 函数与 React 组件分工明确：

| 导出 | 层 | 用途 |
| --- | --- | --- |
| `buildFolioNavigationTree(docs, current, { scopePath? })` | Core | 把文档分类与子文档组合成统一导航树；`scopePath` 显式声明范围，默认由集合与路由推导。 |
| `buildFolioContentTree(docs, { rootPath? })` | Core | 只按路由构造纯目录树，不掺入集合分组。 |
| `getFolioNavigationNeighbors(tree, currentPath)` | Core | 按同一棵树取上一篇／下一篇。 |
| `FolioTreeNav` | UI | 唯一的左侧导航渲染器，接收 `tree` 与 `currentPath`。 |
| `FolioToc` | UI | 页内目录，接收 `headings`。 |

`FolioTreeNav` 的可选 Props 沿用公开的 `FolioTreeExpansionProps`：

```tsx
import { buildFolioNavigationTree, FolioTreeNav } from "@uichat-mira/folio";

const tree = buildFolioNavigationTree(docs, currentDoc, { scopePath: "/guide" });

<FolioTreeNav
  tree={tree}
  currentPath={currentDoc.path}
  className="site-tree-nav"
  collapsible
  defaultExpanded={false}
/>
```

- `collapsible: false` 显式切回路由驱动的无按钮模式；`expandedPaths` + `onExpandChange` 可做完全受控的展开状态，`defaultExpanded` 设置非活动分支的初始状态。
- `collection`／`section` 分类始终渲染为**不可点击、不可折叠的标签**；只有带子页面的内容父节点才出现 `+ / −`。标题链接负责导航，右侧按钮独立控制展开／收起，两者共用一行背景与选中态。
- `FolioApp` 把展开状态保存在阅读路由上层，换文章时不会丢失；当前文章的祖先初始展开，其他有概览的分支初始收起。点击箭头不会切换路由。折叠时子链接不可获取焦点，并尊重操作系统的减少动态效果设置。
- 独立使用 `FolioTreeNav`、`FolioHeader` 或 `FolioFooter` 时，它们需要在 React Router 上下文中渲染；`FolioToc` 只生成页内锚点，不依赖路由。

## 无 JavaScript 与静态边界

导航的 React 与静态两个投影来自同一份 Core 树，但**能渲染的内容不同**：

- 默认静态壳（`staticRoutes: true` 或省略）会为 `type: doc` 页面输出侧栏、页内目录和上一篇／下一篇，链接都指向真实生成的 HTML，禁用 JavaScript 也能继续读。`collection` 分组同样生效，因为它在渲染侧栏时就已应用。
- 默认静态壳**不渲染顶栏**。结构化下拉菜单、搜索、主题切换都是 React Header 的能力，不会出现在静态 HTML 里。需要无 JS 顶栏的站点要在自己的 `staticRoutes` 中提供。
- `FolioApp` 的 `slots.navigation` / `slots.docToc` 只影响 React 渲染，不会改写静态输出。自定义静态侧栏应调用公开的 `renderFolioStaticTreeNav(context, doc)`、`renderFolioStaticToc(headings, { title })` 与 `renderFolioStaticPageNav(context, doc)`（来自 `@uichat-mira/folio/vite`），而不是另写一套树逻辑。
- 只替换静态首页时用 `staticRoutes.home`；它只改变 `/`，其余路由、`404.html`、`sitemap.xml` 与 `robots.txt` 保持默认。详见[静态发布](/guide/static-publishing)。

## 兼容旧 URL

需要保留历史 URL 时，用 Vite plugin 的 `route`：

```ts
folio({
  contentDir: "content",
  config,
  route: (_sourcePath, doc) =>
    doc.path.replace(/^\/legacy(?=\/|$)/, "") || "/",
});
```

`route()` 改变的是 URL 真相源：路由、导航归属与静态输出路径会一起变。URL 兼容属于消费站的迁移策略，不要求 Folio 核心知道某个旧站的目录结构。

## 发布状态与 dev 标签

本文的顶栏条目与树形导航能力与 npm `0.1.1` 有明确差距：

- `0.1.1` 已有 `collection`／`section`／`group` 侧栏分组（`buildFolioDocStructure`），但顶栏 `navigation` 只接受 `label` / `href`。
- `collection` 简写、`children`／`panel`、`activeMatch`、`buildFolioNavigationTree`、`FolioTreeNav` 与静态树 helper 均为 `dev` 源码能力。
- 官方站已经按本文方式使用它们；发表文章引用时请标明 `dev`，不要表述成已发布契约。

差异以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。

## 相关文档

- [站点配置与扩展](/guide/configuration)：`navigation` 所在的站点字段与 Header／Footer 配置。
- [用 FolioApp 与 slots 组合 React 页面](/guide/runtime-composition)：用 `slots.navigation` 覆写侧栏渲染。
- [Core、UI、Build 与站点边界](/guide/architecture)：导航树为什么属于 Core，静态输出为什么在 Build。
- [FolioTreeNav](/reference/components/tree-nav)：Props、展开状态与 Core 树的完整参考。
- [静态发布](/guide/static-publishing)：静态侧栏、目录与分页的产物。
