---
title: 快速开始
description: 在 Folio 仓库中运行官方站，或把 Folio 接入现有 Vite 与 React 项目。
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

这一页只做一件事：让 Folio 在你的环境里跑起来。你可以先在仓库中运行官方站，也可以直接把 package 接入现有项目。

## 前置条件

- Node.js `20.19+` 或 `22.12+`。Folio 声明 `engines.node >= 20`，但依赖的 Vite 7 要求更高的补丁版本。
- npm。仓库使用 npm workspaces，安装与校验命令都以 npm 为准。
- 一个支持 Markdown 与 YAML Frontmatter 的编辑器。

## 在仓库中运行

```bash
npm ci --no-audit --no-fund
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。打开根路径可以看到官方站首页，从 `/guide/introduction` 进入文档。

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 构建 package 并启动官方站开发服务器 |
| `npm run build` | 构建 package 与静态站点 |
| `npm run validate` | 类型检查、测试、OG worker 测试与站点构建 |
| `npm run release:check` | 完整发布校验，包含打包与 consumer 验证 |

## 接入现有项目

### 安装

```bash
npm install @uichat-mira/folio
```

当前公开版本是 `0.1.1`，通过 GitHub Release 与 npm Trusted Publishing 发布。`dev` 源码可能包含尚未发布的候选契约，接口边界以消费者契约为准。

### 注册 Vite 插件

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

export default defineConfig({
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config,
      staticRoutes: true,
    }),
  ],
});
```

`config` 是站点级 `FolioConfig`，最小只需要 `title` 与 `description`；导航、集合索引与页脚都可以按需增加。完整字段见 [站点配置与扩展](/guide/configuration)。

### 挂载 React runtime

```tsx
// src/main.tsx
import { createRoot } from "react-dom/client";
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";

createRoot(document.getElementById("root")!).render(
  <FolioApp config={config} docs={docs} />,
);
```

`virtual:folio/content` 由插件提供，包含构建期发现并排序后的全部内容。普通 consumer 不需要自己扫描 Markdown 文件。

提示：如果某个 TypeScript 项目只导入 `virtual:folio/content`、完全不导入任一 Folio package entry，需在 `compilerOptions.types` 中注册已安装的 `@uichat-mira/folio`。已经导入 `@uichat-mira/folio` 的项目不需要额外配置。

### 写第一篇内容

```md
---
title: 你好，Folio
description: 站点里的第一篇文档。
---

正文从这里开始。
```

把文件放到 `content/` 下即可生成对应路由。`content/introduction.md` 对应 `/introduction`，`content/guide/start.md` 对应 `/guide/start`；命名为 `index.md` 时映射到目录本身。

## 项目结构

```text
my-site/
├─ content/
│  ├─ introduction.md
│  └─ guide/
│     └─ start.md
├─ folio.config.ts
├─ vite.config.ts
└─ package.json
```

`content/` 是内容根目录，Markdown 文件的位置决定路由，Frontmatter 决定标题、类型、分组与排序。站点配置、Vite 插件与 React runtime 分别对应上面三步。

## 启动并验证

```bash
npm run dev
```

修改 Markdown 后，内容清单会失效并触发开发服务器刷新。确认页面可以访问后，执行生产构建：

```bash
npm run build
```

静态 HTML 会按每条内容路由输出到 Vite 的 `build.outDir`，默认为 `dist/`。构建结果同时包含 `404.html`、`sitemap.xml` 与 `robots.txt`。

## 下一步

- [内容协议](/guide/content-contract)：理解 Markdown、Frontmatter 与 `FolioDoc` 的最小约定。
- [编写内容](/guide/authoring)：创建文档、文章、项目和自定义页面。
- [内容模型](/guide/content-model)：理解路径、类型推断与内容层级。
- [站点配置与扩展](/guide/configuration)：配置导航、首页与 Vite plugin。
- [静态发布](/guide/static-publishing)：生成静态 HTML、SEO 与部署产物。
