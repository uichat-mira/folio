---
title: 快速开始
description: 选择消费已发布的 npm 0.1.1，或在 Folio 仓库中开发 dev 源码，并跑起第一个可访问页面。
group: 开始
collection: 指南
order: 2
type: doc
status: published
tags:
  - Folio
  - Vite
  - React
---

这一页只负责选路：先消费已发布的 npm 包，还是进入 Folio 仓库修改源码。两条路径的前置条件、依赖版本和可用 API 不同，请只跟着其中一条走，不要交叉复制示例。

| 你的目标 | 走哪条路径 | 入口 |
| --- | --- | --- |
| 在自己的 Vite + React 项目里建站，不修改 Folio 源码 | 路径 A：消费 `0.1.1` | 安装 npm 包 |
| 修改 Folio package、官方站或文档，验证未发布改动 | 路径 B：开发 `dev` 源码 | 克隆仓库 |

如果只是想判断 Folio 是否适合你的场景，先读[Folio 是什么](/guide/introduction)。

## 环境要求

- **Node.js** `20.19+` 或 `22.12+`。Folio 声明 `engines.node >= 20`，但它依赖的 Vite 7 要求这些补丁版本；用 `node -v` 确认。
- **npm**。仓库使用 npm workspaces，安装、构建与校验命令都以 npm 为准。
- **路径 A 的 peer 依赖**：Vite `^7`、React `^19`、React DOM `^19`、React Router DOM `^7`。版本不匹配时 npm 会给出 peer 警告，构建也可能失败。
- **路径 B 额外需要** Git。

## 路径 A：消费已发布的 0.1.1

适合：已有或新建的 Vite 7 + React 19 项目，只使用 npm 上的公开包。

```bash
npm install @uichat-mira/folio@0.1.1 react-router-dom@^7
```

安装后只使用三个公开入口：

| 入口 | 提供什么 |
| --- | --- |
| `@uichat-mira/folio` | `FolioApp`、`defineFolioConfig`、内容解析与导航等 Core 函数 |
| `@uichat-mira/folio/vite` | `folio()` Vite 插件、`virtual:folio/content` 与静态构建 helper |
| `@uichat-mira/folio/styles.css` | 整站默认样式表 |

最小接入分四步：创建 `content/` 下的 Markdown、写 `folio.config.ts`、在 `vite.config.ts` 注册 `folio()`、在 React 入口挂载 `FolioApp`。完整文件内容、`base`/`basePath` 与 CSS 导入见[首个可运行站点](/guide/first-site)。

`0.1.1` 不包含当前 `dev` 的候选能力，包括但不限于：

- Frontmatter 的 `publishedAt`、`updatedAt`、`dateSources`；
- `config.collections`、`config.home`、collection archive；
- 结构化导航的 `children`/`panel`/`activeMatch`，以及 `headerBrand`/`docToc` 等扩展 slots；
- 可选 PWA 集成。

这些能力只在源码 `dev` 中存在。写 `0.1.1` 项目时不要从其他页面复制它们；公开边界以[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)为准。

## 路径 B：在 Folio 仓库开发 dev 源码

适合：修改 `packages/folio`、官方站 `apps/site` 或文档，验证尚未发布的改动。

```bash
git clone --branch dev https://github.com/uichat-mira/folio.git
cd folio
npm ci --no-audit --no-fund
npm run dev
```

`npm run dev` 会先构建 package，再启动官方站开发服务器；默认地址是 `http://localhost:5173/`。打开根路径是官方站首页，`/guide/introduction` 进入指南。

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 构建 package 并启动官方站开发服务器 |
| `npm run build` | 构建 package 与静态站点 |
| `npm run typecheck` | package 类型检查与构建，再检查官方站类型 |
| `npm run validate` | 类型检查、package 测试、OG worker 测试与站点构建 |
| `npm run release:check` | 完整发布校验，额外包含打包审计与隔离 consumer 验证 |

源码路径的边界：`dev` 分支会包含已合并但尚未发布的候选契约。官方站会直接使用这些能力，因此页面示例可能标注「dev 候选」。如果你在准备 `0.1.1` consumer 文档，必须回到已发布包与消费者契约核对，不能把源码行为写成已发布行为。两条路径的版本差异也记录在[内容协议](/guide/content-contract#版本边界)中。

## 下一步

- [首个可运行站点](/guide/first-site)：按路径 A 从空项目走到可访问页面与静态 HTML。
- [内容协议](/guide/content-contract)：Markdown、Frontmatter 与 `FolioDoc` 的最小约定。
- [编写内容](/guide/authoring)：创建文档、文章与自定义页面。
- [站点配置与扩展](/guide/configuration)：配置导航、首页与 Vite plugin。
- [静态发布](/guide/static-publishing)：生成静态 HTML、SEO 与部署产物。
