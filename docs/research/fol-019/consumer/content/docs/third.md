---
title: 定制与边界
description: 消费者能在默认 UI 上覆盖什么，以及当前版本没有提供什么。
collection: 消费者验收指南
section: 进阶
order: 3
---

第三篇文档用来验证集合内的排序、分页与跨 section 的导航。它属于“进阶”分组，因此在
侧栏里应当与前面两篇出现在不同的分组标题下。

## 可定制的表面

默认 UI 暴露的定制点集中在配置与插槽上：

| 定制点 | 形式 | 是否影响默认排版 |
| --- | --- | --- |
| 站点标题与描述 | `FolioConfig` | 否 |
| 顶部导航 | `FolioConfig.navigation` | 否 |
| 首页内容 | `slots.home` | 只影响首页 |
| 文章尾部 | `slots.articleFooter` | 否 |
| 主题默认值 | `ui.defaultTheme` | 否 |
| 功能开关 | `ui.search` / `ui.theme` / `ui.docsShell` | 是，按开关隐藏 |

## 没有提供的能力

当前版本没有 Theme Engine，也没有按组件拆分的样式入口：`styles.css` 是整站入口，
覆盖品牌的方式是改写 `--folio-*` 变量，而不是替换组件结构。这一点在 FOL-007 的宿主
影响研究里已经实测。

### 因此本卡不做什么

- 不新增主题引擎或 CSS Modules；
- 不拆分 Folio 组件；
- 不改官方站 `apps/site` 的品牌设计；
- 不改公开 API，也不扩大消费者契约。

## 回到验收

如果这一篇在分页里能被“上一篇”正确指回《默认文档界面》，说明集合内排序与相邻文档
计算在独立消费者里是有效的。
