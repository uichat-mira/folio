---
title: 首个可运行站点
description: 用已发布的 0.1.1，从空项目到可访问文档页与静态 HTML：内容文件、Frontmatter、Vite plugin、React 入口与构建产物。
group: 开始
collection: 指南
order: 3
type: doc
status: published
tags:
  - 快速开始
  - Vite
  - React
  - 静态构建
---

这一页只走**已发布 npm 包 `0.1.1`** 的路径：在一个新的 Vite 7 + React 19 项目里，从空白开始建出第一篇文档，并完成静态构建。所有示例都只使用 `0.1.1` 的公开接口。

如果你要修改 Folio 源码本身，请看[快速开始](/guide/getting-started)的路径 B；要把 Folio 接进已有品牌页面，先读[消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md)中关于整站样式表的说明。

## 完成后的结果

- 开发服务器上可以打开 `/guide/hello`，看到带侧栏、页内目录与主题切换的文档页；
- 首页 `/` 由 Folio 内置首页渲染；
- `npm run build` 为每条 route 写出静态 HTML 和 `404.html`，配置 `siteUrl` 时还会生成 `sitemap.xml` 与 `robots.txt`；
- 部署到根域或 GitHub Pages 子路径时，资源与路由都使用同一个 base。

## 前置条件

- Node.js `20.19+` 或 `22.12+`；
- npm；
- 可以访问 npm Registry。

## 1. 创建项目并安装依赖

```bash
npm create vite@7 my-docs -- --template react-ts
cd my-docs
npm install
npm install @uichat-mira/folio@0.1.1 react-router-dom@^7
```

这里固定 `create-vite@7`，得到 Vite 7 + React 19 的模板；`react-router-dom` 是 Folio 的 peer 依赖，需要显式安装。已有 Vite 7 + React 19 项目可以跳过脚手架，只执行最后一条安装命令。

## 2. 写第一篇 Markdown

新建 `content/guide/hello.md`：

```md
---
title: 你好，Folio
description: 站点里的第一篇文档。
type: doc
group: 开始
order: 1
---

## 第一段正文

这个页面由 `content/guide/hello.md` 生成。

- 文件位置决定路由
- Frontmatter 决定标题、类型与侧栏分组
```

- `content/` 是默认内容根目录，由下一步的 `contentDir` 指定；
- `content/guide/hello.md` 对应 `/guide/hello`；
- `title` 与 `description` 是页面与 metadata 的必填信息，`type: doc` 使用文档阅读壳。

字段的完整默认值见[Frontmatter 与元数据](/guide/frontmatter-fields)，写作流程见[编写内容](/guide/authoring)。

## 3. 创建站点配置

新建 `folio.config.ts`：

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "My Docs",
  description: "用 Folio 构建的第一个文档站。",
  // 换成真实站点地址。canonical、sitemap.xml 与 robots.txt 依赖它。
  siteUrl: "https://docs.example.com",
  navigation: [{ label: "文档", href: "/guide/hello" }],
});
```

`title` 与 `description` 必填；`navigation` 覆盖默认顶部导航，`siteUrl` 用于生成绝对 URL。`0.1.1` 的 `navigation` 条目只接受 `label` 与 `href`，不要使用 `dev` 文档中的 `children`、`panel` 或 `activeMatch`。

## 4. 注册 Vite 插件

把 `vite.config.ts` 替换为：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import config from "./folio.config";

// 部署到域名根目录时保持 "/"。
// 部署到 https://<user>.github.io/my-docs/ 这类项目子路径时改为 "/my-docs/"。
const base = "/";

export default defineConfig({
  base,
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

- `contentDir` 相对项目根目录，决定 Markdown 的扫描范围；
- `config` 与 React 入口共用同一份 `FolioConfig`；
- `staticRoutes: true` 让插件在构建结束时为每条 route 写出静态 HTML 与 `404.html`；
- Vite 的 `base` 是静态资源与路由 URL 的唯一来源，必须与最终部署路径一致。

## 5. 挂载 React 入口

把 `src/main.tsx` 替换为：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FolioApp
      config={config}
      docs={docs}
      basePath={import.meta.env.BASE_URL}
    />
  </StrictMode>,
);
```

- `virtual:folio/content` 由 `folio()` 插件提供，包含构建期发现并排序后的全部内容，不需要自己扫描 Markdown；
- `@uichat-mira/folio/styles.css` 是整站默认样式表，在入口导入一次；
- `basePath` 传入 Vite 的 `BASE_URL`，让 React Router 在子路径部署时使用正确的 basename；它必须与上一步的 `base` 一致。

模板自带的 `src/App.tsx`、`src/index.css` 不再被引用，可以删除，避免误以为还需要额外挂载。

## 6. 打开页面

```bash
npm run dev
```

打开 `http://localhost:5173/guide/hello`。如果第 4 步把 `base` 改成了子路径，开发地址也要带前缀，例如 `http://localhost:5173/my-docs/guide/hello`。

预期看到：

- 顶部是 `My Docs` 与「文档」导航；
- 左侧文档侧栏出现「开始」分组和这篇文档；
- 正文 `## 第一段正文` 出现在页内目录中；
- 首页 `/` 显示 Folio 内置首页，而不是文件系统目录列表。

## 7. 构建静态站点

```bash
npm run build
```

Vite 模板的 `build` 先执行 `tsc -b`，再执行 `vite build`；Folio 插件在构建结束时按 route 写出 HTML。产物结构应类似：

```text
dist/
├── index.html
├── guide/hello/index.html
├── 404.html
├── sitemap.xml          # 配置了 siteUrl 时
├── robots.txt           # 配置了 siteUrl 时
└── assets/…
```

检查构建结果：

```bash
npm run preview
```

打开 `http://localhost:4173/guide/hello`（子路径部署时带上 base）。静态 HTML 自带文档侧栏与页内目录，存在相邻文档时还会输出上一篇／下一篇，禁用 JavaScript 也能阅读；主题切换与搜索仍由 React runtime 提供。

## 部署到子路径

GitHub Pages 项目站点的地址形如 `https://<user>.github.io/my-docs/`，此时必须同时满足：

1. `vite.config.ts` 的 `base` 设为 `"/my-docs/"`；
2. React 入口继续使用 `basePath={import.meta.env.BASE_URL}`，不要写死；
3. `siteUrl` 只写 origin，例如 `https://<user>.github.io`，不要重复写 `/my-docs/`。

官方站从 CI 环境推导同样的 base，可参考[静态发布](/guide/static-publishing)与[部署到 GitHub Pages](/reference/github-pages)。如果只部署到根域，保持 `base: "/"` 即可。

## 常见问题

- **页面 404，但 `dist` 里有文件**：`base` 与部署路径不一致，或访问时漏了子路径前缀。
- **子路径下刷新后样式或路由丢失**：检查 `base`、`basePath` 是否都来自同一个部署路径。
- **新增的 Markdown 打不开**：确认文件位于 `contentDir` 下，路由按相对路径生成（`content/guide/hello.md` → `/guide/hello`），文件名大小写与访问路径一致。
- **没有 `sitemap.xml` / `robots.txt`**：确认 `folio.config.ts` 中设置了 `siteUrl`。
- **TypeScript 找不到 `virtual:folio/content`**：确认入口同时导入了 `@uichat-mira/folio`（本页示例已导入），并把 `vite/client` 加入项目的类型环境。

## 下一步

- [编写内容](/guide/authoring)：文档、文章与页面的写作流程。
- [内容协议](/guide/content-contract)：Frontmatter 与路由的稳定约定。
- [站点配置与扩展](/guide/configuration)：导航、Footer、Slots 与 plugin options。
- [静态发布](/guide/static-publishing)：静态 HTML、SEO 与部署产物。
- [快速开始](/guide/getting-started)：切回源码 `dev` 路径，或核对两条路径的差异。
