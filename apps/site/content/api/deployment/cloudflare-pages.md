---
title: 下游案例：Cloudflare Pages
path: /api/deployment/cloudflare-pages
description: UIChat Mira 旧文档站如何把 Folio/MiraDocs 类静态产物发布到 Cloudflare Pages。
group: Folio API · 部署
order: 41
type: doc
status: reference
tags:
  - Cloudflare Pages
  - Consumer
  - Case Study
---

> 这是 **下游 consumer 的部署案例**，不是 Folio 核心要求。Folio 官方 reference site 本身使用 GitHub Pages。

UIChat Mira 文档站的生产发布合同长期采用：

```text
feat/* → dev → test → prod
```

一个典型 consumer 可以保持：

```text
Source branch: prod
Build command: npm run build
Build output: dist
Publisher: GitHub Actions + Wrangler Direct Upload
```

Folio 只负责产出可部署静态文件，例如 route 目录 `index.html`、`404.html`、`sitemap.xml`、`robots.txt` 以及 canonical / social metadata / JSON-LD。

Cloudflare project、DNS、production branch、smoke 与回滚规则属于 consumer 的部署治理。

这正是 Folio 的边界：**同一套静态构建契约可以进入不同平台，而部署平台不反向进入 runtime。**
