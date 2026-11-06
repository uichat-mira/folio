---
title: 组件
description: Folio 当前公开 React 组件、配置入口与能力边界；同时演示 Markdown 目录自动推导父子导航。
type: project
group: API
order: 1
status: draft
tags:
  - API
  - React
  - Component
  - Tree
---

这里记录的是 **当前本地开发分支中已经存在的公开组件**，不是规划清单。组件只从 `@uichat-mira/folio` 导入；本页不展示未实现的主题编辑器、可视化搭建器或后台管理界面。

## 这个父子关系从哪里来

当前页面在 `reference/components/index.md`，下面的每一篇在子目录的 `index.md`。Folio 根据生成后的路由建立父子关系，**没有额外的导航 JSON，也没有填写父级 ID**。

~~~text
reference/components/
  index.md                       # 组件（父级）
  app/index.md                   # FolioApp
  header/index.md                # FolioHeader
  footer/index.md                # FolioFooter
  docs-shell/index.md            # FolioDocsShell
  navigation/
    index.md                     # 导航组件（第二级父级）
    doc-nav/index.md             # FolioDocNav（第三级）
    tree-nav/index.md            # FolioTreeNav（第三级）
    toc/index.md                 # FolioToc（第三级）
  markdown/index.md              # FolioMarkdown
  utility-popover/index.md       # FolioUtilityPopover
  share-button/index.md          # FolioShareButton
~~~

这里明确设置了 `type: project`，因为当前 Folio 的**约定式树形阅读布局**接在项目类型上；它虽然位于「参考」路径下，但不是普通 `type: doc` 文档集合导航。你会看到组件树，而不是原来按 `collection / section` 分组的「参考」侧栏。

## 组件索引

| 组件 | 已有能力 |
| --- | --- |
| [FolioApp](/reference/components/app) | 路由、应用外壳、UI 开关和 slots |
| [FolioHeader](/reference/components/header) | 全局导航、移动菜单、搜索和主题操作 |
| [FolioFooter](/reference/components/footer) | 字符串兼容、结构化品牌与链接、法律信息 |
| [FolioDocsShell](/reference/components/docs-shell) | 文档阅读布局、左右导航与分页 |
| [导航组件](/reference/components/navigation) | 文档导航、目录树、页内目录 |
| [FolioMarkdown](/reference/components/markdown) | Markdown 渲染及 Mermaid 增强 |
| [FolioUtilityPopover](/reference/components/utility-popover) | 可关闭的轻量信息浮层 |
| [FolioShareButton](/reference/components/share-button) | Web Share / 复制页面链接 |

## 这次刻意保留的能力边界

- **已支持**：层级从路由推导；父级有 `index.md` 时可点击；多层子目录；当前页高亮；同一顶层分组内的上一篇／下一篇；静态 HTML 输出同一棵目录树。
- **尚未统一**：普通 `type: doc` 仍使用 `collection / section` 分组。它不会仅凭放入子目录就自动切换成树形 DocNav。
- **Footer 按内容类型控制**：这批示例用的是 `type: project`，所以仍会展示站点 Footer；`ui.footerOnDocs: false` 目前只影响 `type: doc`，不会自动覆盖项目型参考页面。
- **不是独立包入口**：公共组件从 `@uichat-mira/folio` 导出，默认样式来自 `@uichat-mira/folio/styles.css`；组件级 CSS 文件不作为独立公开入口。
- **当前版本说明**：此处以 `feat/tomz-1105` 本地源码为准，包含尚未发布到 npm `0.1.1` 的开发能力；不能把本地示例误认为已发布版本具备相同契约。

想对照另一套分组导航，可直接访问 [原有参考索引](/reference/overview)。
