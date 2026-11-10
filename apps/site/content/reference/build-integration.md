---
title: Vite 构建集成
description: 使用 @uichat-mira/folio/vite 接管内容发现、热更新、静态输出与可选安装，并区分 0.1.1 与 dev 源码。
group: API
collection: 参考
order: 42
type: doc
status: published
tags:
  - Vite
  - Build
---

Folio 的 Vite 入口是 `@uichat-mira/folio/vite`。它把 Markdown 内容发现、`virtual:folio/content` 与静态页面写出放进同一个 Vite 插件，而不是再引入一个独立构建器。

## 版本状态

已发布的 `@uichat-mira/folio@0.1.1` 支持 `folio()` 与 `staticRoutes` 的基础形态。`dev` 源码在此之上增加了首页覆写、站点索引策略、Feed 与可选 PWA 入口；它们**尚未发布到 npm**。本轮核对基线为 `origin/dev` 的 `f49557c`。

| 项目 | npm 0.1.1 | dev 源码 |
| --- | --- | --- |
| `folio()`、内容发现、`virtual:folio/content` | 有 | 有 |
| `staticRoutes: false \| true \| FolioStaticBuildOptions` | 有 | 有 |
| `staticRoutes.home`、`siteIndexing`、`feeds` | 无 | 有 |
| `FolioStaticHomeOverride`、`FolioStaticFeedOptions` 类型 | 无 | 有 |
| `/vite` 的 `renderFolioStaticHome()` 等静态 helper | 无 | 有 |
| `@uichat-mira/folio/pwa`、`/pwa/react` | 无 | 有（未发布） |
| `config.collections` 与 Article 归档 | 无 | 有（未发布） |

## 基本接入

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
      exclude: (sourcePath) => /(^|\/)README\.md$/i.test(sourcePath),
      route: (_sourcePath, doc) => doc.path,
      staticRoutes: true,
    }),
  ],
});
```

`FolioPluginOptions`：

- `contentDir`：内容根目录，默认 `content`；
- `config`：同一份 `FolioConfig`，同时供 runtime 与静态构建使用；
- `exclude`：在解析后排除文件；
- `route`：把源文件映射为 route（默认使用 Frontmatter / 路径规则）；
- `staticRoutes`：`false` 关闭静态写出，`true` 使用默认路由集，传入对象则自定义。

## 内容发现链

```text
读取 Markdown
→ parseFolioDoc
→ exclude
→ route
→ normalize path
→ compareFolioDocs
```

结果通过虚拟模块提供：

```ts
import docs, { roots } from "virtual:folio/content";
```

`docs` 是 `FolioDoc[]`，`roots` 是 `string[]`。已发布的 `0.1.1` 已包含虚拟模块的 TypeScript 声明，并通过真实 Registry 独立消费者验收；普通 TS 工程不需要自己写 `declare module`。只有当一个 TS 工程**仅**导入虚拟模块、从不导入任一 Folio 包入口时，才需要在 `compilerOptions.types` 注册已安装的 `@uichat-mira/folio`：

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@uichat-mira/folio"]
  }
}
```

## 静态写出发生在 build

插件在 Vite `writeBundle` 阶段读取最终 manifest，并把 route HTML、`404.html`、`sitemap.xml`、`robots.txt`（以及 dev 源码的 feed 文件）写入 `build.outDir`。

因此：

- `vite dev` 只提供开发服务器与热更新，不产出可部署的静态文件；
- 静态验证必须跑真实的 `vite build`（官方站为 `npm run build -w @uichat-mira/folio-site`）；
- `staticRoutes` 省略时的行为等同启用默认静态构建，只有显式 `false` 才完全关闭。

## staticRoutes

```ts
staticRoutes: false                    // 不生成静态 route
staticRoutes: true                     // 使用默认静态构建
staticRoutes: { /* 自定义 */ }          // consumer 接管 route 集
```

默认路由集在当前 `dev` 源码中包含首页、`config.collections` 的索引页、Article 归档页与每篇文档/页面；在 `0.1.1` 中只有首页与每篇文档/页面，没有集合索引和归档。

传入 `routes` 会替换**全部** route，而不只是某个目录：consumer 自己负责首页、集合索引、归档、文档 shell、分页与所有正文链接；`404.html` 仍由 `notFound` 决定。若只想改首页而保留默认路由集，`dev` 源码提供 `home`；`0.1.1` 没有这个窄接口。

`staticRoutes: true` 时，库默认文档壳自带侧边栏、页内目录和上一篇/下一篇，且这些链接指向真实生成的 HTML，无 JavaScript 也能阅读。consumer 自定义 `routes` 后，正文标记由 consumer 负责。

## base path

静态写出、canonical、sitemap、robots、feed 与 PWA scope 都使用同一个 Vite `base`：

```ts
import { resolveGithubPagesBase } from "@uichat-mira/folio";

const base = resolveGithubPagesBase(process.env.GITHUB_REPOSITORY);
```

`resolveGithubPagesBase()` 在 `0.1.1` 中已公开。官方站允许用 `FOLIO_SITE_BASE` 覆盖它，用于根域预览；静态目录 URL 带尾斜杠，React Router 路由不带，这是两种表示的差异，不是缺陷。

## 公开 helper 的边界

`@uichat-mira/folio/vite` 在 `0.1.1` 导出：

```text
folio
folioVirtualModule
folioAbsoluteRouteUrl
folioAbsoluteAssetUrl
folioEscapeHtml
renderFolioStaticHtml
writeFolioStaticSite
类型：FolioPluginOptions / FolioContentManifest /
      FolioStaticBuildContext / FolioStaticBuildOptions /
      FolioStaticImageMetadata / FolioStaticRoute
```

`dev` 源码另增 `renderFolioStaticHome`、`renderFolioStaticDocMeta`、`renderFolioStaticDocumentBody`、`renderFolioStaticTreeNav`、`renderFolioStaticToc`、`renderFolioStaticPageNav`、`renderFolioStaticProjectShell`，以及 `FolioStaticFeedOptions` / `FolioStaticHomeOverride` 类型。使用 `0.1.1` 时不要从 `/vite` 导入这些名字。

## 可选 PWA 的组合方式

PWA 不是 `folio()` 的内置开关，而是另一个入口：

```ts
import { folio } from "@uichat-mira/folio/vite";
import { folioPwa } from "@uichat-mira/folio/pwa";

plugins: [
  folio({ /* ... */ }),
  ...folioPwa({ config, icons: [/* 192 与 512 */] }),
]
```

`folioPwa()` 返回插件数组，必须展开；它在 `folio()` 写出页面之后计算内容版本，并让 Workbox 在最后生成 Service Worker。未调用 `folioPwa()` 的站点不会产生 manifest、Service Worker 或注册脚本。完整契约与缓存边界见[可选 PWA](/reference/pwa)。

`/pwa` 与 `/pwa/react` 只存在于 `dev` 源码，`0.1.1` 没有这两个子路径，也没有 `vite-plugin-pwa` / `workbox-window` 的可选 peer 声明。

## 构建验证

官方站的最小验证链是：

```bash
npm run typecheck
npm run build -w @uichat-mira/folio-site
```

站点构建在 `vite build` 之后还会执行 `apps/site/scripts/verify-site-routes.mjs`，按构建时的 base（根路径 `/` 或 GitHub Pages 子路径 `/folio/`）检查 route、内部链接、sitemap、归档页与 404 noindex。它验证的是真实产物，不是开发服务器。

## 相关文档

- [静态构建与 SEO](/reference/seo)：metadata、JSON-LD、sitemap、robots 与 Feed。
- [静态发布](/guide/static-publishing)：构建产物、base path 与部署平台。
- [部署到 GitHub Pages](/reference/github-pages)：项目子路径与生产工作流。
- [Article 分类与标签归档](/reference/article-archives)：`collections[].archive` 的数据与静态路由。
