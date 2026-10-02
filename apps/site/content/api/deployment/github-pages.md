---
title: 部署到 GitHub Pages
path: /api/deployment/github-pages
description: 使用 Folio、Vite 与 GitHub Actions 发布项目路径站点。
group: Folio API · 部署
order: 40
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

## Workflow

```text
checkout
→ setup Node
→ npm ci
→ build
→ configure-pages
→ upload-pages-artifact
→ deploy-pages
```

权限：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

## base path

```ts
import { resolveGithubPagesBase } from "@uichat-mira/folio";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
```

Folio 的 route、canonical、sitemap、robots 与 asset URL 都应使用同一个 Vite base。
