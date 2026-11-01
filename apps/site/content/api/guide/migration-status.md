---
title: MiraDocs → Folio 迁移状态
path: /api/guide/migration-status
description: MiraDocs 品牌、包名、API 与生产链迁移到 Folio 的当前事实。
group: Folio API · 迁移
order: 30
type: doc
status: published
tags:
  - Migration
  - MiraDocs
  - Folio
---

该页面是 MiraDocs → Folio 的**当前迁移事实投影**，以仓库代码、GitHub Release、发布流水线和消费者依赖为依据。最后核对日期：2026-11-01。

## 已完成

- 仓库已统一为 `uichat-mira/folio`，公开 npm 包为 `@uichat-mira/folio`，内容虚拟模块为 `virtual:folio/content`；官方站在 `apps/site`，通过 npm workspace 使用 Folio 的公开入口。
- `0.1.0` 已从接受的 `prod=40db582b` **手动首次发布**到公共 npm Registry，并通过[隔离 Registry 消费者验收](https://github.com/uichat-mira/folio/actions/runs/41247604056)。这次首次 bootstrap 不是 OIDC 发布。
- `0.1.1` 已由 [GitHub Release `folio-v0.1.1`](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1) 触发 [npm Trusted Publishing / OIDC 发布流水线](https://github.com/uichat-mira/folio/actions/runs/41282326983)。Tag 指向 `e4af1f7de3a8d6004f052fcb99f0b412405fcc3c`，属于 `prod` 历史；首次发布命令成功并写入签名 provenance，Registry 在 npm 处理窗口中暂时 404，重跑后确认版本存在并通过真实安装、SRI、严格 TypeScript、Vite 和静态生成验收。没有重复发布 0.1.1。
- 因此发布工作流已实证支持 Release → OIDC → npm Registry；发布后 Registry 等待窗口已通过 [PR #101–103](https://github.com/uichat-mira/folio/pull/103) 改为最多约 30 分钟并按 `dev → test → prod` 合入。当前 `prod=711c6c6` 的 Linux/Windows 包检查及 Pages 构建部署均成功；原发布 Tag 没有移动。
- 已完成真实 tarball 独立消费、Chrome 默认 UI 候选 23/23 检查、`virtual:folio/content` 类型声明修复和 FOL-013 标题 ID 回归。原始 [FOL-014 研究](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) 中的 `TS2307` 是修复前历史证据，不代表当前包仍缺类型。
- 官方 GitHub Pages 已完成生产部署，包含 Folio schema 和文档内容。

## 尚未完成或尚未独立验证

- **Mira 官网消费者迁移**：`uichat-mira/uichat-mira-docs@prod` 仍依赖 `@uichat-mira/docs@^0.1.1`，尚未使用 Folio。旧 npm 包是否弃用必须等已知消费者完成迁移后再决定。
- **外部 HTTP T5 smoke**：现有 Pages build/deploy 成功回执不替代针对真实公网网页的 HTTP/浏览器检查；此处没有额外宣称已验收。
- **npm 管理界面最终标记**：维护者曾通过截图核对 `uichat-mira/folio` + `publish.yml` 的 Trusted Publisher 配置和 `npm publish` 权限；OIDC 发布成功是运行证据，但当前私有 npm 控制台“已验证”徽标未在本次通过 GitHub 读回。
- **治理与下一阶段设计**：仓库 [PR #54](https://github.com/uichat-mira/folio/pull/54) 仍是尚未合并的工程治理草案，需要按 0.1.1 发布后现状修订。Organization Skill 的 Folio 化尚无本次已完成验收证据。

## 迁移原则

旧内容和消费者的历史兼容由迁移层消化。Folio 核心不为旧站的私有 `merge`、主题或 URL 结构重新引入 MiraDocs-era API。历史 MiraDocs `v0.1.0` Tag 不得挪用。
