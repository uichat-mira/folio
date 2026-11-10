---
title: 部署到 GitHub Pages
description: 使用 Folio、Vite 与 GitHub Actions 发布项目路径站点，并区分 0.1.1 与 dev 源码的能力。
group: 部署
collection: 参考
order: 50
type: doc
status: published
tags:
  - GitHub Pages
  - Deployment
---

Folio 把 GitHub Pages 项目路径当作一等部署场景。

官方站当前运行在：

```text
https://uichat-mira.github.io/folio/
```

## 首次启用

新仓第一次使用 Pages 时：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

这是仓库级设置。默认 workflow `GITHUB_TOKEN` 的 `pages: write` 权限不能替代首次启用 Pages site。

## 仓库 workflow 的真实行为

`.github/workflows/pages.yml`：

```text
checkout（fetch-depth: 0）
→ setup Node
→ npm ci
→ npm run build（根目录，构建包与官方站）
→ configure-pages（仅 prod 且非 PR）
→ upload-pages-artifact（仅 prod 且非 PR）
→ deploy-pages（仅 prod 且非 PR）
```

- 在 `dev`、`test`、`prod` 的 PR 上都会构建，用来验证静态产物；
- 只有 `prod` 的 push，或在 `prod` 上手动运行（`workflow_dispatch`）才会上传并部署；
- 上传目录是 `apps/site/dist`，不是仓库根 `dist`；
- build job 只读内容，deploy job 额外获得 `pages: write` 与 `id-token: write`；
- checkout 使用 `fetch-depth: 0`：静态构建需要 Git 历史推导日期，浅克隆无法证明“首个提交”。Pages 与 `dev` 预览这两个构建 workflow 都拉全历史；`validate` 的 Linux / Windows job 保持默认浅克隆。

线上站点由 `prod` 构建。`dev` 上合并的文档或 dev-only 能力，要经过 `dev → test → prod` 晋级后才会出现在生产 Pages；仓库内的预览部署不能替代这一步。

## base path

```ts
import { resolveGithubPagesBase } from "@uichat-mira/folio";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
```

`resolveGithubPagesBase("uichat-mira/folio")` 返回 `/folio/`；`*.github.io` 仓库返回 `/`；没有环境变量时返回 `/`。官方站允许 `FOLIO_SITE_BASE` 覆盖它，Cloudflare 预览就用 `FOLIO_SITE_BASE=/` 构建。

Folio 的 route、canonical、`sitemap.xml`、`robots.txt`、feed 与 asset URL 都使用同一个 Vite base。项目路径下应得到：

```text
https://uichat-mira.github.io/folio/
https://uichat-mira.github.io/folio/guide/introduction/
https://uichat-mira.github.io/folio/sitemap.xml
```

静态目录 URL 带尾斜杠；GitHub Pages 会把无斜杠请求 301 到斜杠形式。React Router 路由不带尾斜杠，这只是两种表示的差异。

## 静态产物

无论 `0.1.1` 还是 `dev` 源码，Pages 部署的都是一组普通文件：

```text
index.html
<route>/index.html
404.html
sitemap.xml        # 需要 config.siteUrl 且 sitemap !== false
robots.txt         # 需要 config.siteUrl 且 robots !== false
assets/…
```

GitHub Pages 在未命中路径时返回 `404.html`，因此 Folio 的多页面语义成立：未知文章 URL 到达真实 404，而不是被首页兜底。不要给 Pages 增加 SPA fallback，也不要把它当成单页应用部署。

按版本区分的站点级能力：

| 产物 | npm 0.1.1 | dev 源码 |
| --- | --- | --- |
| route HTML、`404.html`、`sitemap.xml`、`robots.txt` | 有 | 有 |
| sitemap `<lastmod>` | 无 | 有 |
| `siteIndexing: "noindex"` | 无 | 有 |
| `rss.xml` / `atom.xml`（`feeds`） | 无 | 有（需配置） |
| Article 归档页（`collections[].archive`） | 无 | 有（需配置） |
| PWA manifest / Service Worker（`folioPwa()`） | 无 | 有（需显式启用） |

官方站当前没有配置 `feeds`、`siteIndexing` 或 `folioPwa()`；静态 HTML 中的 `public/site.webmanifest` 是站点自己的静态 manifest，不是 PWA 集成产物。

## 本地验证子路径

在推送前验证 GitHub Pages base：

```bash
GITHUB_REPOSITORY=uichat-mira/folio npm run build -w @uichat-mira/folio-site
```

或显式指定：

```bash
FOLIO_SITE_BASE=/folio/ npm run build -w @uichat-mira/folio-site
```

站点构建包含 `node scripts/verify-site-routes.mjs`，会按同一个 base 检查生成的 route、内部链接、sitemap、归档页与 404 noindex。只跑 `vite dev` 或只截图 localhost 不能证明子路径发布正确。

## 边界

- Pages 是**部署目标**，不是 Folio 的 runtime 依赖；构建产物不读取 Pages 环境。
- 生产发布只允许来自 `prod` 历史；`dev` 预览或 PR 构建不能作为 npm 已发布、也不能作为生产已上线的证据。
- 仓库的 Pages 工作流与部署权限属于仓库治理，不在单篇文档或 consumer 站点内改写。

## 相关文档

- [静态发布](/guide/static-publishing)：构建产物与 base path 的完整视图。
- [静态构建与 SEO](/reference/seo)：metadata、sitemap、robots 与 Feed 契约。
- [下游案例：Cloudflare Pages](/reference/cloudflare-pages)：另一类静态托管与仓库 `dev` 预览。
