---
title: 官方站点内容维护约定
description: 官方站点文档的页面类型、Frontmatter、链接、事实核对规则与 26 篇既有内容审阅清单。
group: 维护
collection: 参考
order: 90
type: doc
status: published
tags:
  - Documentation
  - Maintenance
---

本页只约束 `apps/site/content/**`。组织工程政策、Issue 合同和发布流程不在站点文档中重复维护；Folio package 与 runtime 的实现规则属于 `packages/folio`。

## 内容边界

- **开始**：第一次了解 Folio、内容协议和推荐阅读顺序。
- **指南 · 入门**：安装、编写、Markdown 渲染。
- **指南 · 概念**：内容模型、配置、导航、仓库边界。
- **指南 · 组合**：React runtime 组合与静态发布。
- **参考 · API**：按任务索引的 API、Frontmatter、Vite 与 SEO 契约。
- **参考 · 部署 / 迁移 / 附录**：部署方式、迁移快照和独立附录。
- **案例 / 博客 / 项目**：真实 consumer、设计研究和项目状态，不作为入门步骤。
- **维护**：本页，供后续贡献者检查文档。

新增页面时先判断它属于哪一层；不要在入门页复制 API Reference，也不要把案例写成当前能力承诺。

## 页面类型

| `type` | 用途 | 是否进入文档 sidebar |
| --- | --- | --- |
| `doc` | 文档、指南、参考 | 是 |
| `article` | 博客与按日期排序的文章 | 否 |
| `project` | 项目门户条目 | 否 |
| `page` | 独立案例、附录或自定义页面 | 否 |

独立页面必须从至少一个 `doc` 页面链接到，避免成为只靠搜索才能到达的死路。

## Frontmatter 约定

- `title`、`description` 必填；description 描述实际内容，不写营销口号。
- `type` 使用上表的值；跨目录引用时不要复制正文。
- `group` 决定 sidebar 分组；新增文档应复用现有 group，不要为单页制造新分组。
- `order` 决定组内顺序，保持稳定并留有间隔；文章优先按 `date` 排序。
- `path` 只在需要固定 URL 时显式设置；默认由文件路径生成，修改文件位置前先检查旧链接。
- `status` 统一使用 `published`（当前维护的正式内容）、`reference`（导入或参考材料）、`active`（进行中的项目）之一。
- `tags` 使用稳定主题词；新增前先复用已有标签。
- 未识别的字段进入 `doc.data`。若 consumer 依赖该字段，必须在本页或对应 consumer 文档说明用途。

字段默认值和日期规则见 [Frontmatter 参考](/reference/frontmatter)。

## 内容规则

1. **先核对事实**：以当前 `dev` 的 `README.md`、`packages/folio/src`、公开导出、`apps/site/folio.config.ts`、`apps/site/vite.config.ts` 和真实构建结果为准。
2. **区分源码与发布**：已发布 `0.1.1` 与 `dev` 候选契约必须明确标注。不要因为源码已实现就写成 npm 已发布能力。
3. **不把规划写成事实**：未实现能力、路线图和第三方研究必须标注状态与来源。
4. **内部链接用真实路由**：跨分区链接使用 `/guide/...`、`/reference/...` 等以 `/` 开头的站点 route；官方站会在渲染时映射到 GitHub Pages base，不要写死 `/folio/`。避免依赖目录相对链接，因为静态尾斜杠与 React 路由解析不同。移动页面时同步更新所有引用。
5. **代码示例可执行**：命令、字段和导出必须对应当前源码；已发布与未发布示例分开说明。
6. **不重复维护政策**：Organization 政策、Issue 合同和发布流程链接到其所有者，不在站点内容中复制。
7. **更新责任**：改变公开行为、配置字段或构建输出的 PR，必须同时更新对应文档和本页清单；只改文案的 PR 不需要扩张范围。

## 提交前检查

- 新增或修改页面有明确读者、目的和入口。
- Frontmatter 的 type/group/order/status 与所在分区一致。
- 所有新增或受影响的内部链接指向真实 route。
- 关键命令、字段、路径和 API 名称已对照当前源码。
- 已发布能力与 `dev` 候选能力没有混写。
- 运行 `npm run typecheck -w @uichat-mira/folio-site` 与 `npm run build -w @uichat-mira/folio-site`，并检查构建输出中的 route/链接。

## 26 篇既有内容审阅清单

本次治理只调整内容、信息架构和元数据，不搬动无必要的文件。

| 内容 | 目的 / 读者 | 处理结果 |
| --- | --- | --- |
| `guide/introduction.md` | 认识 Folio、理解边界 | 修正：更新 `0.1.1` 发布状态，补推荐阅读路径与维护入口。 |
| `guide/content-contract.md` | 内容协议最小约定 | 修正：补核心字段、默认行为、扩展字段与相关文档。 |
| `guide/runtime-composition.md` | 组合 React runtime 的公开边界 | 保留正文；重分组并补配置、导航、静态发布链接。 |
| `guide/static-publishing.md` | 静态发布与无 JS 阅读边界 | 修正：说明代表路由与实际内容路由，补相关文档；重分组。 |
| `reference/overview.md` | 原产品介绍与 API 入口重复 | 改写为按任务组织的「参考索引」：只放查证型入口，按顺序读的内容指向指南。 |
| `guide/getting-started.md` | 仓库开发与 consumer 接入 | 修正：`0.1.1`、Node/CI 说明、虚拟模块类型说明、下一步路径。 |
| `guide/authoring.md` | 创建文档、文章、项目、页面 | 修正：字段表补 collection/section 与默认值，链接 Frontmatter 参考。 |
| `guide/content-model.md` | `FolioDoc` 与路径规则 | 修正：类型补 collection/section/publishedAt/updatedAt，标注候选契约。 |
| `guide/configuration.md` | `FolioConfig`、plugin、slots | 修正：补 `author`、静态选项状态与参考链接；重分组。 |
| `guide/navigation.md` | virtual manifest、group 与导航 | 保留正文；重分组，排序规则由内容协议统一说明。 |
| `guide/architecture.md` | 仓库、consumer 与 Skill 边界 | 修正：工作流路径改为 `.github/workflows`；重分组。 |
| `guide/markdown-runtime.md` | Markdown、Callout、Mermaid、锚点 | 修正：版本表述改为 `0.1.x`，补标题锚点与相关链接；重分组。 |
| `reference/migration-status.md` | MiraDocs → Folio 迁移事实 | 修正：明确为带日期的快照，指向 API 索引；重分组。 |
| `reference/github-pages.md` | GitHub Pages 项目路径部署 | 修正：按 job 说明 build/deploy 权限与 `prod` 部署条件；重分组。 |
| `reference/cloudflare-pages.md` | 下游 Cloudflare Pages 案例 | 保留正文；重分组，继续标注为非核心案例。 |
| `reference/frontmatter.md` | 字段、默认值、日期、扩展 | 修正：补默认值表、collection/section、日期与 author 说明。 |
| `reference/build-integration.md` | Vite plugin 与静态输出阶段 | 修正：发布版本更新为 `0.1.1`；重分组。 |
| `reference/seo.md` | 静态 route、metadata、sitemap、robots | 修正：补 dev 候选字段、作者/日期与索引/feed 说明；重分组。 |
| `reference/examples/apple.md` | Apple 设计研究参考 | 保留正文；核对站内入口与 `reference` 状态。 |
| `reference/examples/claude.md` | Claude 设计研究参考 | 保留正文；核对站内入口与 `reference` 状态。 |
| `reference/examples/product-design-system.md` | Claude 设计系统历史合并页 | 保留正文；核对锚点与 `reference` 状态。 |
| `reference/examples/supabase.md` | Supabase 设计研究参考 | 保留正文；核对站内入口与 `reference` 状态。 |
| `reference/typora-r2.md` | Typora 图片上传 R2 的写作工具附录 | 保留正文；重分组，保持独立 `page` 并由 API 索引链接。 |
| `blogs/why-folio.md` | 为什么先 dogfood 官方站 | 保留正文；保持 `article` 与日期排序。 |
| `reference/site.md` | 官方站作为公开 API 案例 | 修正：`status` 统一为 `published`，保持独立案例页。 |
| `projects/folio.md` | 项目状态与下一步 | 修正：移除已完成的首发待办，更新 `0.1.1` 与后续工作。 |

本次新增 `reference/content-maintenance.md`（即本页），不替代上述 26 篇的用户文档，只提供维护约定和审阅记录。表格中的路径已更新为「指南 / 参考」分区后的位置（`content/guide/`、`content/reference/`），页面移动时请一并更新本表。

## 已知保留项

- 4 篇设计研究、Typora 附录和博客保留原有正文与来源说明；本次只核对入口、状态和链接，不重写第三方研究。
- `reference/migration-status.md` 保留 2026-11-01 的发布快照；后续状态以 GitHub Releases、npm Registry 和当前源码为准。
- `dev` 候选能力（日期、collection/home、feed、indexing）在相关页面标注为未包含在已发布 `0.1.1` 中，不在本站宣称已发布。
