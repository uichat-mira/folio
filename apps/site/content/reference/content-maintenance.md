---
title: 官方站点内容维护约定
description: 官方站页面分区、Frontmatter、编辑成熟度、版本核查与历史审阅记录的维护约定。
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
- **指南 · 入门**：产品定位、安装和首个可运行站点。
- **指南 · 写作**：内容类型、Frontmatter、组织与 Markdown 渲染。
- **指南 · 配置与组合**：导航、运行时、Core/UI/Build 边界。
- **指南 · 发布**：静态构建、SEO 和部署。
- **参考 · API**：Frontmatter、组件、Vite、PWA、Article 归档与静态 SEO。
- **参考 · 部署 / 迁移 / 附录**：部署方式、迁移快照和独立附录。
- **案例 / 博客 / 关于**：真实 consumer、设计研究和独立介绍页，不作为入门步骤。
- **维护**：本页，供后续贡献者检查文档。

新增页面时先判断它属于哪一层；不要在入门页复制 API Reference，也不要把案例写成当前能力承诺。

## 页面类型

| `type` | 用途 | 是否进入文档 sidebar |
| --- | --- | --- |
| `doc` | 文档、指南、参考 | 是 |
| `article` | 博客与按日期排序的文章 | 否 |
| `page` | 独立案例、附录或自定义页面 | 否 |

独立页面必须从至少一个 `doc` 页面链接到，避免成为只靠搜索才能到达的死路。

## Frontmatter 约定

- `title`、`description` 必填；description 描述实际内容，不写营销口号。
- `type` 使用上表的值；跨目录引用时不要复制正文。
- `group` 决定 sidebar 分组；新增文档应复用现有 group，不要为单页制造新分组。
- `order` 决定组内顺序，保持稳定并留有间隔；文章优先按 `date` 排序。
- `path` 只在需要固定 URL 时显式设置；默认由文件路径生成，修改文件位置前先检查旧链接。
- `status` 是本站**内容编辑成熟度**：`published` 表示已审校的正式文档（即使它描述的是 dev-only API）；`draft` 表示待完成/待审校；`reference` 表示历史/外部参考。现有示例文章使用的 `dev-sample` 和退役项目中的 `active` 属历史值，不作为新文档的建议值。npm 发布状态始终另行说明。
- `tags` 使用稳定主题词；新增前先复用已有标签。
- 未识别的字段进入 `doc.data`。若 consumer 依赖该字段，必须在本页或对应 consumer 文档说明用途。

字段默认值和日期规则见 [Frontmatter 参考](/reference/frontmatter)。

## 内容规则

1. **先核对事实**：以当前 `dev` 的 `README.md`、`packages/folio/src`、公开导出、`apps/site/folio.config.ts`、`apps/site/vite.config.ts` 和真实构建结果为准。
2. **区分源码与发布**：以 [消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md) 为单一权威，准确标注 npm 0.1.1 与 dev 能力差异；各页按需链接与简述，不复制第二份全量矩阵。`status: published` 不等于 npm API 已发布。
3. **不把规划写成事实**：未实现能力、路线图和第三方研究必须标注状态与来源。
4. **内部链接用真实路由**：跨分区链接使用 `/guide/...`、`/reference/...` 等以 `/` 开头的站点 route；官方站会在渲染时映射到 GitHub Pages base，不要写死 `/folio/`。避免依赖目录相对链接，因为静态尾斜杠与 React 路由解析不同。移动页面时同步更新所有引用。
5. **代码示例可执行**：命令、字段和导出必须对应当前源码；已发布与未发布示例分开说明。
6. **不重复维护政策**：Organization 政策、Issue 合同和发布流程链接到其所有者，不在站点内容中复制。
7. **更新责任**：公开行为、配置或构建产物变化时，同步维护权威消费者契约和对应 Guide/Reference；不在本页重复维护当前全部文件清单。

## 提交前检查

- 新增或修改页面有明确读者、目的和入口。
- Frontmatter 的 type/group/order/status 与所在分区一致。
- 所有新增或受影响的内部链接指向真实 route。
- 关键命令、字段、路径和 API 名称已对照当前源码。
- 已发布能力与 `dev` 候选能力没有混写。
- 运行 `npm run typecheck -w @uichat-mira/folio-site` 与 `npm run build -w @uichat-mira/folio-site`，并检查构建输出中的 route/链接。

## 历史审阅与当前覆盖

[FOL-036（Issue #144）](https://github.com/uichat-mira/folio/issues/144) 在 2026-11-03 审阅的**26 篇**属于当时的历史记录，并非当前文档总数；FOL-035 此后还退役了旧 `projects/*` 页面。

2026-11-10 合并 FOL-042～047 后，`dev` 的 `apps/site/content/**` 包含**48 篇 Markdown**：指南 15、参考 28、博客 4、关于 1。实际文档数量以 GitHub 内容树和构建路由为准，不再在本页手工维护会过时的逐篇清单。

重要新入口：[首个可运行站点](/guide/first-site)、[可选 PWA](/reference/pwa)、[Article 归档](/reference/article-archives)、[组件参考](/reference/components)。历史设计研究和 Typora 工具保留 URL，但不进入核心 API 学习路径。

## 已知保留项

- 4 篇设计研究、Typora 附录和博客保留原有正文与来源说明；本次只核对入口、状态和链接，不重写第三方研究。
- `reference/migration-status.md` 保留 2026-11-01 的发布快照；后续状态以 GitHub Releases、npm Registry 和当前源码为准。
- `collection` / `section` 已存在于 npm 0.1.1；`dev` 扩展的日期、首页、Feed、站点索引策略、归档与 PWA 需明确标注未进入已发布的 0.1.1。
