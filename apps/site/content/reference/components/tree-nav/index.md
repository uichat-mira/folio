---
title: FolioTreeNav
description: 统一文档侧栏的公开 Props、Core 导航树、父子推导、展开状态与静态输出边界。
type: doc
collection: 参考
section: API
order: 50
status: published
tags: [Navigation, Tree, Core, API, React]
---

`FolioTreeNav` 是 Folio **唯一的左侧内容导航渲染器**。它接收 Core 生成的内容树，渲染文档分类、内容父页和子页面；右侧 [FolioToc](/reference/components/toc) 负责文章内部标题，两者职责不同。

## 版本与发布状态

本页描述当前 `dev` 源码中的公开接口。npm 最新发布版 `0.1.1`（Git tag `folio-v0.1.1`）**未导出** `FolioTreeNav`、`buildFolioNavigationTree`、`buildFolioContentTree` 等能力，。安装 `0.1.1` 时不能按下面的示例导入这些符号；这些说明适用于包含上述导出的当前 `dev` 或后续发布版本。 `status: published` 仅表示文档内容已审校，不表示此组件已包含在 npm 0.1.1 中。

## 导入与最小用法

~~~tsx
import {
  buildFolioNavigationTree,
  FolioTreeNav,
} from "@uichat-mira/folio";

// docs 是构建层解析后的 FolioDoc[]，currentDoc 是正在阅读的那一篇。
const tree = buildFolioNavigationTree(docs, currentDoc);

<FolioTreeNav tree={tree} currentPath={currentDoc.path} />;
~~~

独立渲染时必须位于 React Router 内，因为导航项使用 `react-router-dom` 的 `Link`。`basename` 来自外层 Router，而不是 `FolioTreeNav` 的 Prop；组件本身只接收下面的字段。

在 `FolioApp` 中不需要手动构造 `tree`：默认阅读布局已经接线，桌面侧栏和移动抽屉共用同一个渲染器。需要替换整套侧栏时使用 [FolioApp 的导航插槽](/reference/components/app)，并把收到的 `onNavigate` 继续传下去，以便移动抽屉在跳转后关闭。

## 公开 Props

~~~ts
type FolioTreeNavProps = FolioTreeExpansionProps & {
  tree: FolioContentTree;
  currentPath: string;
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
};

type FolioTreeExpansionProps = {
  collapsible?: boolean; // 默认 true
  defaultExpanded?: boolean; // 默认 false
  expandedPaths?: readonly string[]; // 完全受控
  onExpandChange?: (path: string, expanded: boolean) => void;
};
~~~

- `tree` 必填。通常传入 `buildFolioNavigationTree()` 的结果，也可以直接传入 `buildFolioContentTree()` 的纯内容树；后者不会出现文档分节标题。
- `currentPath` 必填，用于计算当前页、祖先展开和 `aria-current="page"`。路径不在树中时只是没有当前项，不会报错。
- `className` 追加到根 `<nav>`；组件还会自动附加 `folio-tree-nav--sections`（当树根包含文档分节时）。
- `ariaLabel` 覆盖导航名称。默认值：树根包含 `kind: "section"` 时为 `文档目录`，否则沿用历史名称 `项目目录`。
- `onNavigate` 只在页面链接被点击时调用，不用于展开按钮。抽屉式移动菜单依赖它关闭。
- `onExpandChange` 只由 `+ / −` 展开按钮触发，参数是节点路径与目标状态；点击父页标题不会触发。
- `scopeId`（在 `tree` 上）是展开状态的命名空间，默认由文档集合或显式路由范围决定，不需要消费者设置。

当 `tree.roots` 为空时组件返回 `null`，不会渲染空 `<nav>`。

## 内容导航与展开行为

- `collection / section` 是不可点击、不可折叠的分类标签，渲染为 `<h2>`，不会生成假的页面链接。
- 有真实概览页的内容父节点：标题是路由链接，右侧 `+ / −` 是独立的展开按钮，两者共用整行悬停背景。
- 没有真实概览的隐式目录：只显示目录标题，不创建会产生 404 的链接；如果它有子页面且 `collapsible` 为真，仍然提供独立的展开按钮。
- 当前页使用 `aria-current="page"`，当前页高亮优先于悬停高亮；当前页及其祖先会自动展开，当前页自身有子页面时也会展开。
- 隐式目录默认展开；有真实文档的节点默认收起，除非它是当前页祖先或设置了 `defaultExpanded`。
- 折叠后子链接仍在 DOM 中，但容器带有 `aria-hidden="true"` 与 `inert`，不能获得焦点；CSS 高度动画只改变呈现，不改变树数据。系统设置“减少动态效果”时动画关闭。
- 展开状态属于展示状态：在 `FolioApp` 中由阅读路由之外的 Provider 保存，切换文章后用户手动展开的子树会保留；直接独立使用时组件使用本地状态。
- 传入 `expandedPaths` 后进入**完全受控**模式：组件不再根据路由、`defaultExpanded` 或隐式目录自动展开，也不会自行修改集合；调用方必须在 `onExpandChange` 中更新数组。`onExpandChange` 仍会触发。
- `collapsible: false` 时不渲染任何 `+ / −` 按钮，所有子页面始终可见且可聚焦；此时折叠状态与高度动画均不参与。
- 组件不提供 roving tabindex、方向键树控件或 `role="tree"` 语义；键盘行为是普通链接与按钮的原生 Tab 顺序，焦点环由样式提供。

移动端没有单独的 `FolioTreeNav` 变体：`FolioDocsShell` 把同一个组件同时用于桌面侧栏和移动抽屉，抽屉的遮罩、Escape、背景滚动锁定由 Shell 负责。自定义导航必须保留 `onNavigate` 转发，否则点击链接后抽屉不会关闭。

## 统一模型：buildFolioNavigationTree

~~~ts
import {
  buildFolioNavigationTree,
  type FolioNavigationTree,
  type FolioNavigationTreeOptions,
} from "@uichat-mira/folio";

const tree: FolioNavigationTree = buildFolioNavigationTree(docs, currentDoc);

const options: FolioNavigationTreeOptions = { scopePath: "/reference" };
const shared = buildFolioNavigationTree(docs, currentDoc, options);
~~~

签名：`buildFolioNavigationTree(docs, current, options?: { scopePath?: string })`。

它是 React-free 的 Core 函数，只处理 `type: "doc"` 的内容：

- `buildFolioDocStructure()` 先按 Frontmatter 的 `collection` 与 `section` 分组；`collection` 缺省为“文档”，`section` 缺省为 `group`，再缺省为“文档”。
- 当前文档必须属于某个文档集合，或调用方显式提供 `scopePath`；`type` 为 `article`、`page`、`custom` 的当前页会得到空树，不会获得文档侧栏。
- 默认只取当前文档所属集合，`rootPath` 是该集合共享的目录范围；不同集合不会仅因路由祖先为 `/` 而混入同一导航。
- `scopePath` 是显式的组合范围：包含该路径内所有文档集合的节点。它用于跨区域组合导航，不是权限系统，也不创建后台可编辑菜单。即使显式组合，同名章节仍以 `collection + section` 的身份区分，不会跨集合合并。
- 树根是文档分节节点，路径形如 `folio:section:...`，只用于展示与展开状态，不是可访问路由。
- 运行时导航与静态输出使用同一份 Core 树。

## 纯目录模型：buildFolioContentTree

只需要某一段路由目录时，可以独立构造纯内容树：

~~~ts
import {
  buildFolioContentTree,
  getFolioTreeNeighbors,
  type FolioContentTree,
  type FolioContentTreeNode,
} from "@uichat-mira/folio";

const contentTree = buildFolioContentTree(
  docs.filter((doc) => doc.type === "doc"),
  { rootPath: "/reference" },
);

const { previous, next } = getFolioTreeNeighbors(
  contentTree,
  "/reference/components/share-button",
);
~~~

主要数据契约如下：

~~~ts
type FolioContentTree = {
  rootPath: string;
  roots: FolioContentTreeNode[];
  scopeId?: string; // 可选的导航作用域身份
};

type FolioContentTreeNode = {
  path: string;
  title: string;
  kind?: "section" | "page" | "directory";
  doc?: FolioDoc; // 没有概览页时为 undefined
  children: FolioContentTreeNode[];
};

type FolioContentTreeOptions = {
  rootPath?: string; // 默认 "/"
};
~~~

`buildFolioContentTree` 只负责路由目录，不读取 `type`、`collection` 或 `section`：传入什么文档就构建什么树。需要文档导航语义时应使用 `buildFolioNavigationTree`，或由调用方先过滤 `type: "doc"`。

`rootPath` 是树的**容器路径**：位于该路径本身的文档会被排除，返回的是它的后代。例如 `{ rootPath: "/reference" }` 返回 `/reference/components`、`/reference/seo` 等后代，不包含 `/reference` 的概览页。路径会先做斜杠归一化，`/reference/` 与 `/reference` 等价。

其余行为：

- 没有文档的中间路径会成为隐式目录，`doc` 为 `undefined`，标题由路径片段解码后把 `-`、`_` 替换为空格。
- 有文档的节点使用文档标题。重复的最终路由会抛出错误，不会静默覆盖。
- 节点按 `order` 排序；隐式目录没有自己的 `order`，取子节点最小值。值大于 99 的文档不会被截断。相同排序值按路由路径的 `localeCompare` 确定稳定顺序。
- `resolveFolioProjectTree(docs, current)` 是保留的 **deprecated** 兼容函数，只处理旧版 `type: "project"` 文档；新站点应直接通过 `buildFolioContentTree(docs, { rootPath })` 显式指定范围，不要再用它推导项目。
- `getFolioTreeNeighbors(tree, path)` 返回完整的 `{ previous?: FolioDoc; next?: FolioDoc }`，先序遍历范围限制在包含当前路径的**单个顶级根节点**内，不会跨到相邻根节点；路径不在树中时返回 `{}`。

## 父级推导与缺失概览

Folio 从解析后的**最终路由路径**推导父子关系，不需要手工填写 `parent` 或 `parentId`。例如：

~~~text
reference/
  components/
    index.md          # /reference/components，父级可点击
    tree-nav/
      index.md        # /reference/components/tree-nav，子页面
  legacy/
    guide/
      index.md        # /reference/legacy/guide；/reference/legacy 是隐式目录
~~~

`sourcePathToRoute()` 把 `index.md` 映射为目录自身的路由。由于 `reference/legacy/index.md` 不存在，`/reference/legacy` 仍会作为树上的**隐式目录**，但没有 `doc`，因此不会生成虚假链接。

还要留意以下约束：

- Frontmatter 显式覆写 `path` 时，以最终路由为准，而不是原始文件夹位置。
- 路由按路径段匹配，`/reference/com` 不会错误包含 `/reference/com-design`。
- 重复的最终路由在构建树时抛错，不会静默覆盖文档。

## 排序与上一篇／下一篇

- 有真实 `doc` 的节点按 Frontmatter `order` 排序；缺省由 `parseFolioDoc` 设为 `99`。
- 隐式目录没有自身的 `order`，使用子节点最小的排序值，**不会再把值大于 99 的子节点强行截断**。
- 排序值相同，按路由路径字典序确定稳定顺序。
- `getFolioNavigationNeighbors()` 是默认阅读分页的顺序来源：按左侧统一树先序遍历有效文档，跨越同一文档导航中的分节与子页面。
- `getFolioTreeNeighbors()` 是通用内容树的邻居查询，在当前顶级树节点范围内按先序遍历，不跨到相邻根节点。

这些规则适用于任意深度的真实内容树，但**不意味着文档中心本身必须保留五层页面**。

## React 与无 JS 静态边界

无 JavaScript 的静态 HTML 使用同一套树数据。`@uichat-mira/folio/vite` 导出静态侧栏：

~~~ts
import { renderFolioStaticTreeNav } from "@uichat-mira/folio/vite";

const navigationHtml = renderFolioStaticTreeNav(context, currentDoc);
~~~

静态渲染保留所有有效子页面链接、层级、`aria-current="page"` 和部署 `base` 对应的路径，但**不会**输出 `+ / −` 按钮、`aria-expanded`、`inert` 或 React 的手动展开状态；所有子页面一开始就可见。静态移动端由阅读 Shell 使用原生 `<details>` 折叠，不需要交互脚本。

静态侧栏的 `<nav>` 固定使用名称“文档目录”，且该辅助函数不接受自定义 `ariaLabel`；需要不同名称时应在消费站自己的静态模板中渲染。静态输出同样不处理权限、内容审核或发布审批。

`FolioTreeNav` 只负责展示和导航；导航树数据、排序与路由推导属于 Core，全站应用插槽见 [FolioApp](/reference/components/app)，阅读布局的移动抽屉与分页见 [FolioDocsShell](/reference/components/docs-shell)。
