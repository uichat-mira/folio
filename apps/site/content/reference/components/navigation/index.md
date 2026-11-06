---
title: 导航组件
description: 文档分组导航、内容目录树和页内目录的当前公共 API。
type: project
order: 50
status: draft
tags: [Navigation, Tree, TOC]
---

这里特意再放一个 **有真实概览页的第二级父节点**。下面三个子组件由目录路径自动归属到这个节点，无需在子文档里设置 `parent`。

## 三种导航各做什么

| 组件 | 对应模型 | 典型使用 |
| --- | --- | --- |
| [FolioDocNav](/reference/components/navigation/doc-nav) | `collection / section / order` | 技术文档的平铺分组导航 |
| [FolioTreeNav](/reference/components/navigation/tree-nav) | `buildFolioContentTree()` | 项目概览、父子文章与多级目录 |
| [FolioToc](/reference/components/navigation/toc) | `FolioHeading[]` | 当前页面的标题锚点与高亮 |

## 当前能力边界

`FolioDocNav` **不是** `FolioTreeNav` 的一个皮肤：两者有不同的数据契约。默认 `type: doc` 仍使用平铺分组；需要目录父子关系的页面当前走 `type: project`。页面右侧的 `FolioToc` 在两种阅读模式中都可复用。

当前页面与子组件构成三层示例：**组件 → 导航组件 → 单个组件**。注意这里只验证现有结构，不引入新的 UI 控件。
