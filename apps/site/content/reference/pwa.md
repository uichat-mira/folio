---
title: 可选 PWA
description: 用 @uichat-mira/folio/pwa 为 Folio 静态站启用 manifest、Service Worker 与更新提示，并明确 HTML 缓存边界。
group: API
collection: 参考
order: 44
type: doc
status: published
tags:
  - PWA
  - Service Worker
  - Offline
---

`@uichat-mira/folio/pwa` 是**显式可选**的 PWA 集成：不导入它，站点不会生成 manifest、Service Worker 或注册脚本，也不会安装 Workbox。

## 版本状态

这两个入口在当前 `dev` 源码中实现，**尚未发布到 npm**。已发布的 `@uichat-mira/folio@0.1.1` 没有 `./pwa` 与 `./pwa/react` exports，也没有 `vite-plugin-pwa` / `workbox-window` 的可选 peer 声明；在 `0.1.1` 上按本页示例导入会无法解析子路径。本轮核对基线为 `origin/dev` 的 `f49557c`。

| 项目 | npm 0.1.1 | dev 源码 |
| --- | --- | --- |
| `@uichat-mira/folio/pwa`（`folioPwa()`、`computeFolioContentVersion()`） | 无 | 有 |
| `@uichat-mira/folio/pwa/react`（`useFolioPwaUpdate()`、`FolioPwaUpdatePrompt`） | 无 | 有 |
| `vite-plugin-pwa` / `workbox-window` 可选 peer | 无 | 有 |

## 它是什么，不是什么

Folio 没有实现第二套 Service Worker 引擎、缓存层、消息总线或更新状态机。`folioPwa()` 是上游 `vite-plugin-pwa`（`generateSW` + Workbox）的一层薄组合，Folio 负责的是**多页面静态发布**下上游默认值不适用的部分：

- 不设置 `navigateFallback`：未知文章 URL 必须到达真实 `404.html`，不能被首页接管；
- 不对生成的 HTML 做 precache：文章正文不能因为旧缓存而在发布后继续可见；
- 内容发布必须可被发现：当站点把 Markdown 放进静态输出、客户端 bundle 不含正文时，只改 Markdown 不会改变任何 JS/CSS hash，Folio 用一个内容版本条目让 worker 字节发生变化；
- 在真实产物上校验上述边界，而不是只校验传入的 options。

上游 Workbox 与 `virtual:pwa-register/react` 仍然负责安装、waiting、激活与 reload 生命周期。

## 安装

```bash
npm install -D vite-plugin-pwa@^2 workbox-window@^7.4.1
```

它们是 `peerDependenciesMeta.optional` 声明的可选 peer：不启用 PWA 的 `folio()` 消费者不需要安装；启用时要自己装。

## 最小示例

`public/` 里放两张**正方形**图标（192 与 512），例如 `public/icon-192.png`、`public/icon-512.png`。manifest 从部署 base 提供，图标 `src` 必须是 base 相对路径，不能写 `/icon-192.png`。

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { folio } from "@uichat-mira/folio/vite";
import { folioPwa } from "@uichat-mira/folio/pwa";
import config from "./folio.config";

const base = "/"; // GitHub Pages 项目路径示例："/folio/"

export default defineConfig({
  base,
  plugins: [
    react(),
    folio({
      contentDir: "content",
      config,
      staticRoutes: true,
    }),
    ...folioPwa({
      config,
      icons: [
        { src: "icon-192.png", sizes: "192x192" },
        { src: "icon-512.png", sizes: "512x512" },
      ],
    }),
  ],
});
```

- `config` 必须是传给 `folio()` 的同一个配置；`title` 成为 manifest 的 `name` / `short_name`，`description` 成为 manifest 描述。
- `icons` 是唯一入口，`manifest.icons` 不允许覆盖；构建会校验正方形尺寸、真实 PNG 文件头与文件中的实际像素（SVG 则校验正方形 viewBox 或宽高），以及每个 `src` 是否真的出现在产物里。
- 可选：`themeColor`、`backgroundColor`、`lang`、`startUrl`、`scope`、`updateMode`、`versionFile`、`includeAssets`、`disable`。
- `scope` 必须等于 Vite `base`；`startUrl` 必须落在 scope 内，默认就是 scope；`manifest` 覆盖里不允许出现 `scope`、`start_url`、`id`、`icons`。

客户端注册与更新 UI：

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FolioApp } from "@uichat-mira/folio";
import { FolioPwaUpdatePrompt } from "@uichat-mira/folio/pwa/react";
import "@uichat-mira/folio/styles.css";
import docs from "virtual:folio/content";
import config from "../folio.config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <FolioApp config={config} docs={docs} basePath={import.meta.env.BASE_URL} />
      <FolioPwaUpdatePrompt />
    </>
  </StrictMode>,
);
```

需要自定义提示时改用 `useFolioPwaUpdate()`：它返回 `supported`、`registrationState`（`unsupported` / `registering` / `registered` / `failed`）、`registered`、`needRefresh`、`offlineReady`、`confirmUpdate()`、`dismissUpdate()`、`checkForUpdate()`，并接受 `onRegisteredSW` / `onRegisterError` 回调选项。不要另外写一套 Service Worker 状态机。

## 产物与静态路径

构建后在输出根目录（即部署 base）写出：

```text
dist/
├── manifest.webmanifest
├── sw.js
├── folio-version.json
└── workbox-*.js
```

不同部署 base 下的访问路径：

| 文件 | base `/` | base `/folio/` |
| --- | --- | --- |
| manifest | `/manifest.webmanifest` | `/folio/manifest.webmanifest` |
| Service Worker | `/sw.js` | `/folio/sw.js` |
| 内容版本 | `/folio-version.json` | `/folio/folio-version.json` |

`manifest.scope`、`start_url` 与 `id` 都由 base 推导；`sw.js` 位于 base 根目录，默认 scope 就是该目录，因此根域与项目子路径使用同一套配置。Service Worker 需要 HTTPS（`localhost` 例外）。

注册只发生在客户端 bundle：`injectRegister: false`，Folio 不会把注册脚本注入每个静态页面（那会在每次路由访问时重复注册，并绕过更新提示契约）。开发服务器不启用 PWA（`devOptions.enabled: false`），要验证真实行为必须 `vite build` 后用 HTTPS/localhost 的静态预览。

## HTML 缓存安全边界

这是本页最重要的约束，也是 Folio 与上游默认值的主要差异。

**不缓存生成的 HTML。** precache 只包含 hashed JS/CSS 与 consumer 显式列出的品牌资源；`globPatterns` 固定为 `**/*.{js,css}`，`globIgnores` 固定排除 `**/*.html`、`sw.js` 与 `workbox-*.js`。文章、文档、集合索引、归档页与 `404.html` 都不进入离线壳。`workbox.runtimeCaching` 默认是空数组；如果 consumer 显式添加运行时缓存路由，就由该配置自己承担缓存语义，Folio 不会把它当成安全默认值。

**不改变导航。** 不设置 `navigateFallback`，也不允许 consumer 设置 `navigateFallback` / `navigateFallbackAllowlist` / `navigateFallbackDenylist`；生成的 worker 里出现 navigation fallback 会让构建失败。未知 URL 仍然由静态主机返回 `404.html`，不会被首页或任何缓存页面接管。

**所有可注入的 precache 条目都在真实产物上校验。** `includeAssets`、`workbox.additionalManifestEntries`、`workbox.templatedURLs`、`workbox.manifestTransforms` 与最终 worker 的 manifest 都会做百分号解码、去 query/fragment、解析 `.` / `..`、按 base 解析，再对照真实构建输出。指向生成页面的条目——`index.html`、`docs/hello/`、`docs/index`、`docs%2Fhello%2F`、带 query 的页面 URL——一律失败；跨域 URL、越出 base 的 URL、不存在的文件也失败。manifest 读不出来时构建失败，而不是假设“没有东西要检查”。

**内容版本是元数据，不是页面正文。** `folio-version.json` 的 `version` 是对**所有生成 HTML** 的相对路径与字节做 SHA-256 后取前 32 位十六进制字符；排序稳定、不含时间戳或绝对路径，所以相同内容重建不会伪造新版本。它被作为 revisioned 条目写入 precache manifest，只用于让“只改 Markdown”的发布产生新的 worker 字节，从而让读者看到更新提示。它不包含、也不替代任何页面正文。

因此：

- Folio 不会“意外缓存过期 HTML”，也不会“改变导航”；这些行为是被显式禁止并在构建期校验的。
- Folio **也不**让文章正文离线可用：离线状态只覆盖预缓存的 JS/CSS 与品牌资源。页面 HTML 仍从网络获取，并受托管平台的 HTTP 缓存/CDN 策略影响——那属于平台配置，不是这个 Service Worker 的 precache。
- 如果读者离线打开一篇未缓存的文章，正常结果是失败或平台错误页，而不是旧正文。

## 更新模式

- `updateMode: "prompt"`（默认）：新 worker 进入 waiting；只有读者确认后才激活并 reload。页面不会自动刷新，dismiss 只针对这一次更新。
- `updateMode: "auto"`：显式选择，新 worker 就绪后立即激活并 reload（`skipWaiting` + `clientsClaim`）。此模式下官方客户端不会报告 waiting，因此不会显示 prompt UI；不要把 `auto` 和提示 UI 混用。
- 更新检查：浏览器本身会在导航时检查 worker；`useFolioPwaUpdate()` 另在应用启动与前台恢复时调用 `registration.update()`，默认节流 60 秒（`checkIntervalMs` 可调，`0` 表示不节流）。
- `disable: true`：保留配置但不产出任何 PWA 文件，适合预览构建；不会移除已存在的 `public/` 静态文件。

注册失败时的回退：`registrationState` 变为 `"failed"` 并触发 `onRegisterError`，但站点继续按普通网页工作——没有离线壳，也没有更新提示，而不是白屏或阻断导航。

## 常见失败模式

构建会在以下情况失败，而不是降级：

- 图标缺失、非正方形、没有 192 与 512、声明尺寸与实际 PNG/SVG 不符、或 `src` 在产物中不存在；
- `manifest.icons` 被覆盖，或 `scope` 与 Vite `base` 不一致；
- `navigateFallback*`、HTML glob pattern、页面型 precache 条目；
- `manifest.webmanifest`、`sw.js` 或内容版本文件没有生成；
- worker 没有包含内容版本，或包含 navigation fallback；
- worker precache 了 `sw.js` / `registerSW.js`（旧 worker 不能自我固化）。

## 适用与不适用

适用：

- 需要可安装 manifest、离线静态资源与“新版本可用”提示的多页面 Folio 站；
- 根域与 GitHub Pages/Cloudflare Pages 子路径部署；
- 希望把更新决定交给读者的站点（默认 prompt）。

不适用：

- 需要离线阅读整站文章正文、离线写入、后台同步或 Web Push；
- 需要把未知 URL 交给首页的 SPA；
- 想用 Service Worker 代替 HTTP 缓存/CDN；
- 非安全上下文（无 HTTPS，且非 localhost）；
- 只需要一个可安装 manifest、不需要 Service Worker 的站点——官方站当前就是这种情况：它用 `public/site.webmanifest` 与图标提供 manifest，但没有调用 `folioPwa()`，也没有注册 Service Worker。

## 独立使用的 helper

`computeFolioContentVersion(outDir)` 与 `FOLIO_PWA_CONTENT_VERSION_FILE` 从 `/pwa` 公开：前者返回 `{ version, pages }`，目录不存在或没有 HTML 时抛错；有自己更新 UI 的 consumer 可以复用它，而不必启用 Folio 的预缓存策略。

## 相关文档

- [Vite 构建集成](/reference/build-integration)：`folioPwa()` 必须与 `folio()` 一起组合。
- [静态构建与 SEO](/reference/seo)：PWA 不改变 canonical、sitemap、robots 与 feed。
- [部署到 GitHub Pages](/reference/github-pages)：子路径部署下的 base 与 scope。
