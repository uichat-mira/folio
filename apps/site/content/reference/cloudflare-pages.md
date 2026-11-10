---
title: 下游案例：Cloudflare Pages
description: 把 Folio 静态产物发布到 Cloudflare Pages 的边界、仓库 dev 预览与常见静态托管要求。
group: 部署
collection: 参考
order: 51
type: doc
status: reference
tags:
  - Cloudflare Pages
  - Consumer
  - Case Study
---

> 这是 **下游 consumer / 仓库预览的部署案例**，不是 Folio 核心要求。Folio 官方 reference site 本身使用 GitHub Pages。

Cloudflare Pages 与 GitHub Pages 的差别只在托管层：Folio 仍然只产出静态文件，平台配置不进入 Folio runtime。

## 下游 consumer 的典型形态

Mira 的站点沿用 `feat/* → dev → test → prod` 分支模型。一个典型 consumer 可以保持：

```text
Source branch: prod
Build command: npm run build
Build output: dist
Publisher: GitHub Actions + Wrangler Direct Upload
```

Folio 只负责产出可部署文件：route 目录 `index.html`、`404.html`、`sitemap.xml`、`robots.txt`、canonical / social metadata / JSON-LD，以及在启用时由 dev 源码生成的 RSS/Atom 与 PWA 文件。

Cloudflare project、DNS、production branch、访问策略、smoke 与回滚规则属于 consumer 的部署治理，不在 Folio 的公开契约里。

## 仓库自己的 dev 预览

本仓库有一个独立的预览工作流 `.github/workflows/dev-preview.yml`：

```text
触发：push 到 dev（或手动运行）
构建：FOLIO_SITE_BASE=/ npm run build
上传：apps/site/dist
项目：folio-dev-preview
地址：https://folio-dev-preview.pages.dev
```

它用根路径构建，因此预览域名的 route 与内部链接都以 `/` 为 base，与生产 GitHub Pages 的 `/folio/` 子路径不同。canonical 仍取自配置的 `siteUrl`（`https://uichat-mira.github.io`），不会自动改写成预览域名；这正是“预览部署不是生产发布”的另一个表现。

这条流水线只证明“dev 源码的静态产物能在该平台托管”，**不证明 npm 已发布，也不是生产发布**。生产站仍只从 `prod` 部署到 GitHub Pages。

## 最小接入要求

```text
Build command: npm run build
Output directory: apps/site/dist      # 你的站点输出目录
环境变量：按域名形态设置 FOLIO_SITE_BASE
```

- **base 必须匹配域名形态**：根域用 `/`，子路径（例如 `https://example.com/docs/`）用 `/docs/`。base 不匹配时，链接与资源会整体漂移。
- **保留 `404.html`**：Folio 是多页面发布，未知 URL 应到达真实 404；不要把托管平台配置成 SPA fallback 或把 `index.html` 当所有路径的兜底。
- **MIME 正确**：`sitemap.xml` / feed 的 `.xml` 必须以 XML 类型返回，`manifest.webmanifest`、`sw.js` 与 hashed JS/CSS 也应由平台的静态文件规则处理，不要统一回成 `text/html`。
- **HTTPS**：启用 PWA 时 Service Worker 需要安全上下文（`localhost` 例外）。Cloudflare Pages 默认提供 HTTPS。
- **不要假设 Functions / Worker**：Folio 不需要服务端函数；OG 图片 worker 是官方站自己的附加设施，与 Folio 静态构建无关。

启用 dev 源码的可选 PWA 时，`folioPwa()` 会在输出根目录写出 `manifest.webmanifest`、`sw.js` 与 `folio-version.json`；worker scope 由 Vite `base` 推导，因此预览/生产的 base 必须与部署路径一致。缓存与更新边界见[可选 PWA](/reference/pwa)。

## 版本状态

| 能力 | npm 0.1.1 | dev 源码 |
| --- | --- | --- |
| 静态 route / 404 / sitemap / robots / metadata | 有 | 有 |
| `feeds`（RSS/Atom） | 无 | 有 |
| `siteIndexing`（预览 noindex） | 无 | 有 |
| Article 归档页 | 无 | 有 |
| `folioPwa()` | 无 | 有 |

`dev` 分支的预览可能已经展示这些未发布能力；这与“npm 0.1.1 支持它们”是两件事。

## 边界

- Cloudflare Pages 不是 Folio 的依赖，也不是官方生产部署的替代证明。
- 示例中的项目名、分支、构建目录是当前仓库事实；consumer 应按自己的治理修改。
- Folio 不提供 Wrangler 配置、部署凭据或回滚策略。

## 相关文档

- [部署到 GitHub Pages](/reference/github-pages)：官方站的生产部署与项目子路径。
- [静态发布](/guide/static-publishing)：构建产物、base path 与平台边界。
- [静态构建与 SEO](/reference/seo)：feed 与索引策略的启用条件。
