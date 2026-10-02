---
title: Folio 是什么
description: 一个由 Git 管理、可被 Skill 操作、能发布为公开站点的内容与静态构建运行时。
group: 开始
order: 1
type: doc
status: published
tags:
  - Folio
  - Git-native
  - Vite
---

Folio 是一个面向 Vite 与 React 的 **Git-native 内容、发布与项目门户运行时**。

它把仓库中的结构化 Markdown 转换成统一内容模型、导航与路由数据，以及可部署的静态页面产物。内容仍由 Git 管理和审阅，站点仍可以保留自己的视觉与交互，自动化则通过稳定协议工作，而不是直接修改页面实现。

## 当前身份

Folio 的 canonical identity 已经统一为：

```text
repository     uichat-mira/folio
package        @uichat-mira/folio
vite module    virtual:folio/content
runtime        FolioApp
```

新的 npm package line 从 `0.1.0` 开始。当前仓库已经完成包名、API、目录与发布链迁移；npm 首发是独立的 release 步骤，不把“代码已经准备好”和“registry 已经发布”混成一件事。

发布后消费者使用：

```bash
npm install @uichat-mira/folio
```

## 它负责什么

Folio 提供：

- Markdown 与 YAML Frontmatter 内容模型；
- `doc`、`article`、`project`、`page` 等统一条目；
- Vite 内容发现与 `virtual:folio/content`；
- 路由、导航根节点和标题目录提取；
- 可组合的 React runtime；
- 静态 HTML、canonical、Open Graph、Twitter 与 JSON-LD；
- `404.html`、`sitemap.xml` 与 `robots.txt`；
- GitHub Pages 项目路径和根路径部署支持；
- 可复用 Markdown renderer。

## 它不负责什么

Folio 不是托管 CMS，不重新封装 GitHub API，也不强迫消费者使用同一套主题。

它负责 **内容协议与构建契约**；品牌、页面组合、作者模型和产品交互仍然由具体站点决定。

这个官方站就是边界证明：同一个 runtime，本体保持很薄，consumer 仍然可以做出完整产品面。

## 下一步阅读

先看 [内容协议](./content-contract)，再看 [只用公开 API 如何组合站点](./runtime-composition) 与 [静态发布契约](./static-publishing)。
