---
title: Folio 是什么
description: 一个由 Git 管理、可被 Skill 操作、能发布为公开站点的内容与静态构建运行时。
group: 开始
order: 1
type: doc
---

Folio 是一个面向 Vite 与 React 的 **Git-native 文档、发布与项目门户运行时**。

它把仓库中的结构化 Markdown 转换成统一内容模型、导航与路由数据，以及可部署的静态页面产物。内容仍由 Git 管理和审阅，站点仍可以保留自己的视觉与交互，自动化则通过稳定协议工作，而不是直接修改页面实现。

Folio 继承了 MiraDocs 已验证的运行时能力，但从品牌、npm 包名、公共 API 和 Vite 契约开始使用新的独立身份。

## 当前包线

Folio 的 npm 包线从这里开始：

```bash
npm install @uichat-mira/folio
```

首个 Folio 版本为 `0.1.0`。旧 `@uichat-mira/docs` 是迁移前的 predecessor package，只为现有消费者保留，不再作为 Folio 的公共 API 名称继续演进。

## 它负责什么

Folio 提供：

- Markdown 与 YAML Frontmatter 内容模型；
- `doc`、`article`、`project`、`page` 等统一条目；
- Vite 内容发现与 `virtual:folio/content`；
- 路由、导航根节点和标题目录提取；
- 静态 HTML、canonical、Open Graph、Twitter 与 JSON-LD；
- `404.html`、`sitemap.xml` 与 `robots.txt`；
- GitHub Pages 项目路径和根路径部署支持；
- 可直接使用、也可被替换的轻量 React 运行时。

## 它不负责什么

Folio 不是托管 CMS，不重新封装 GitHub API，也不强迫消费者使用同一套主题。它负责内容协议和静态构建契约；品牌、页面组合、作者模型与产品交互仍由具体站点决定。

## 为什么从 Git 开始

Git 已经提供版本、审阅、回滚、分支和协作。Folio 不重新发明这些能力，而是补齐内容模型、构建产物和发布边界，让文档站能够像软件项目一样演进。

## Skill 如何参与

Canonical Skill 由 UIChat Mira Organization 维护。Folio 仓库只拥有运行时、schema、官方站与 release pipeline，不再保存第二份 Skill 备份。
