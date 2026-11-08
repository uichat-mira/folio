---
title: FolioTreeNav
description: 统一文档侧栏的 React 组件、导航树数据、父子路由推导与排序规则。
type: doc
collection: 参考
section: API
order: 50
status: draft
tags: [Navigation, Tree, Core, API]
---

`FolioTreeNav` 是 Folio **唯一的左侧文档导航组件**。它接收 Core 生成的导航树，渲染文档分类、内容父页和子页面；右侧 `FolioToc` 负责文章内部标题，两者职责不同。

## 使用方式

~~~tsx
import {
  buildFolioNavigationTree,
  FolioTreeNav,
} from "@uichat-mira/folio";

// 当前文章来自构建层解析后的 docs。
const tree = buildFolioNavigationTree(docs, currentDoc);

<FolioTreeNav tree={tree} currentPath={currentDoc.path} />;
~~~

独立使用时需位于 React Router 内，支持 `basename`、`className`、`ariaLabel` 和 `onNavigate`。在 `FolioApp` 中无需手动构造 `tree`：默认阅读布局已接线；如需替换整套侧栏，查看 [FolioApp 的导航插槽示例](/reference/components/app)。

## 内容导航与展开行为

- `collection / section` 是不可点击、不可折叠的分类标签，不生成虚假的页面链接。
- 有真实概览页的内容父节点：标题是路由链接，右侧 `+ / −` 是独立展开按钮，两者共用整行悬停背景。
- 没有真实概览的隐式目录：仅显示目录标题，不创建会产生 404 的链接。
- 当前页高亮强于悬停高亮；当前页的祖先自动展开。
- `FolioApp` 将展开状态保存在阅读路由之外，切换文章时仍然保留用户手动展开的子树。
- 展开、收起有内容高度动画；折叠的子链接不可聚焦，并尊重系统的减少动态效果设置。
- `FolioTreeExpansionProps` 支持 `defaultExpanded`、`expandedPaths`、`onExpandChange`。使用 `collapsible: false` 时不显示按钮，但全部子页面仍然可见、可聚焦。

## 统一模型：buildFolioNavigationTree

~~~ts
import {
  buildFolioNavigationTree,
  type FolioNavigationTree,
} from "@uichat-mira/folio";

const tree: FolioNavigationTree = buildFolioNavigationTree(docs, currentDoc);

// 明确要组合跨路由区域的内容时，才声明导航范围：
const shared = buildFolioNavigationTree(docs, currentDoc, {
  scopePath: "/reference",
});
~~~

它是 React-free 的 Core 函数，负责把 `type: doc` 的 `collection / section` 分组和同章节内有真实内容页的父子路由组织成一棵树。不同集合不会因为目录祖先恰好为 `/` 而混入同一导航；同名章节也不会跨集合合并。

`scopePath` 允许消费者明确扩大路由范围，但不等于创建权限系统或后台可编辑菜单。运行时导航与静态输出使用同一份 Core 树。

## 纯目录模型：buildFolioContentTree

只需要某一个项目目录时，可以独立构建纯内容树：

~~~ts
import {
  buildFolioContentTree,
  getFolioTreeNeighbors,
  type FolioContentTree,
  type FolioContentTreeNode,
} from "@uichat-mira/folio";

const projectTree = buildFolioContentTree(
  docs.filter((doc) => doc.type === "doc"),
  { rootPath: "/projects" },
);

const { previous, next } = getFolioTreeNeighbors(
  projectTree,
  "/projects/atlas/notes",
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
~~~

`rootPath` 是树的**容器路径**：如果把它设置成概览页本身的地址，返回的是其后代，不包含该概览页。`resolveFolioProjectTree()` 是保留的旧版项目范围推导兼容函数；新站点应直接通过 `buildFolioContentTree(docs, { rootPath })` 显式指定范围。

## 父级推导与缺失概览

Folio 从解析后的**最终路由路径**推导父子关系，不需要手工填写 `parent` 或 `parentId`。例如：

~~~text
projects/
  atlas/
    index.md          # /projects/atlas，父级可点击
    notes/
      index.md        # /projects/atlas/notes，子页面
  experiment/
    notes/
      index.md        # /projects/experiment/notes
~~~

`sourcePathToRoute()` 把 `index.md` 映射为目录自身的路由。由于 `projects/experiment/index.md` 不存在，`/projects/experiment` 仍会作为树上的**隐式目录**，但没有 `doc`，因此不会生成虚假链接。

还要留意以下约束：

- Frontmatter 显式覆写 `path` 时，以最终路由为准，而不是原始文件夹位置。
- 路由按路径段匹配，`/projects/com` 不会错误包含 `/projects/com-design`。
- 重复的最终路由在构建树时抛错，不会静默覆盖文档。

## 排序与上一篇／下一篇

- 有真实 `doc` 的节点按 Frontmatter `order` 排序；缺省由 `parseFolioDoc` 设为 `99`。
- 隐式目录没有自身的 `order`，使用子节点最小的排序值，**不会再把值大于 99 的子节点强行截断**。
- 排序值相同，按路由路径字典序确定稳定顺序。
- `getFolioNavigationNeighbors()` 是默认阅读分页的顺序来源：按左侧统一树先序遍历有效文档，跨越同一文档导航中的分类与子页面。
- `getFolioTreeNeighbors()` 是通用内容树的邻居查询，在当前顶级树节点范围内按先序遍历，不跨到相邻根节点。

这些规则适用于任意深度的真实内容树，但**不意味着文档中心本身必须保留五层页面**。

## 静态输出边界

无 JavaScript 的静态 HTML 使用同一套树数据，保留所有有效子页面链接和层级；它不会渲染无法操作的 `+ / −` 控件，也不会把 React 的手动展开状态持久化到静态文件。

`FolioTreeNav` 负责展示和导航，不处理权限、内容审核或发布审批。相关的全站应用插槽见 [FolioApp](/reference/components/app)。
