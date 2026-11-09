# FOL-039 PWA 更新提示浏览器验收

[`browser-prompt.mjs`](browser-prompt.mjs) 用来在一个**真实 tarball 消费者站**上，用真实
headless Chrome 证明可选 PWA 集成给出的是「提示式」更新体验。它不是静态文件检查，也
不 mock Service Worker：两次真实构建、两次真实部署、真实 Workbox worker，交互通过
DevTools Protocol 驱动。

```bash
node docs/research/fol-039/browser-prompt.mjs        # 结果写入 results/acceptance.json
node docs/research/fol-039/browser-prompt.mjs --keep # 保留临时目录，便于复查产物
```

失败时以非零退出码结束，并打印分阶段的 `[stage] FAIL ...` 信息。

## 它实际做了什么

1. `npm run build -w @uichat-mira/folio` + `npm pack --ignore-scripts`，把 `.tgz`
   装进仓库**外**的临时 Vite + React 消费者。消费者只用公开入口：`@uichat-mira/folio/vite`
   的 `folio()`、`@uichat-mira/folio/pwa` 的 `folioPwa()`、`@uichat-mira/folio/pwa/react`
   的 `useFolioPwaUpdate()` 与 `<FolioPwaUpdatePrompt />`。没有 workspace alias、没有
   `file:` 依赖、没有仓库源码路径。
2. `staticRoutes: true` 连续构建两次：v1 与「只改 Markdown 正文」的 v2，分别输出到
   `dist-v1` / `dist-v2`。两次的 `folio-version.json` 必须不同，同时
   `assets/*.js|css` 的文件名**与字节**必须完全相同——否则脚本直接失败并说明原因，
   不会降级成一个名不副实的通过。
3. 一个可切换根目录的小 Node HTTP 服务器先服务 v1：HTML、`sw.js`、
   `manifest.webmanifest`、`folio-version.json` 都发 `Cache-Control: no-cache`；
   `/docs/hello/` → `docs/hello/index.html`，未发布路径返回真实的 `404.html` + 404。
4. Chrome 用一次性 `--user-data-dir`、`--headless=new`，注册 v1 的 worker；随后把
   服务器根切到 v2，调用 fixture 暴露在 `window.__folioPwaCheck` 的
   `checkForUpdate()`，在限定时间内等待 `[data-folio-pwa-update-prompt]` 出现。
5. 全程用 `performance.getEntriesByType('navigation').length`、`performance.timeOrigin`
   和每次导航唯一的 `window.__folioBootId` 判断「页面有没有真的刷新」，而不是靠
   「看起来没变」。
6. 失败路径（第 7 项）用**服务器返回 404 的 `/sw.js`** 制造真实的注册失败，并把浏览器
   放进全新 browser context：此时消费者 `onRegisterError` 必须把错误暴露到
   `window.__folioPwaRegisterError`，页面正文仍然渲染。这是可观察的失败，不是静默挂起。

## 覆盖的检查

| 状态 | id | 耗时 | 说明 |
| --- | --- | --- | --- |
| PASS | `package-packed-from-source` | ~3.6s | `npm run build` + `npm pack` 产出 tarball，记录 sha256 与源码 commit |
| PASS | `install-independent-tarball` | ~6s–60s | 装到仓库外临时目录，确认不是 symlink，记录各依赖版本（耗时取决于 npm 缓存） |
| PASS | `build-v1-static-html` | ~2.6s | `staticRoutes:true` 写出真实 HTML；`docs/hello/index.html` 含 v1 标记 |
| PASS | `build-v2-static-html` | ~1.5s | 第二次构建含 v2 标记，内容版本不同 |
| PASS | `content-only-condition` | — | 两次构建 `assets/*` 文件名与字节完全一致，只有内容版本变化 |
| PASS | `worker-changed-by-content-version` | — | `sw.js` 因内容版本变化而重写，预缓存 `folio-version.json`、不含 HTML |
| PASS | `serve-v1-multipage` | — | 目录式路由、真实 404、元数据文件 `no-cache` |
| PASS | `v1-load-registers-worker` | ~0.7s | 首次部署渲染 v1 正文，worker 激活，且此时不应有提示 |
| PASS | `v1-controlled-baseline` | ~0.4s | 第二次导航被 worker 接管（prompt 模式不 `clientsClaim`），记录基线 bootId |
| PASS | `v2-content-only-update-detected` | ~1.1s | 切换 v2 后提示在限定时间内出现，存在 waiting worker |
| PASS | `no-reload-while-prompt-visible` | ~1ms | 提示可见时 `navigationEntries === 1`、bootId/timeOrigin 不变、正文仍是 v1 |
| PASS | `dismiss-keeps-page` | ~6ms | 点击 `[data-folio-pwa-update-dismiss]` 后提示消失且页面未刷新 |
| PASS | `confirm-reloads-onto-new-content` | ~1.5s | 重新显示提示后点击 confirm，页面刷新且显示 v2 的新 Markdown |
| PASS | `precache-cleaned-and-current` | ~4ms | `caches.keys()` 只剩当前 `workbox-precache`，其中 `folio-version.json` 就是 v2 哈希 |
| PASS | `subpath-v1-registers-worker` | ~1.5s | 子路径 `/folio-smoke/`：worker script URL、worker scope 都是 `/folio-smoke/`，manifest link 为 `/folio-smoke/manifest.webmanifest` |
| PASS | `subpath-update-prompt-without-reload` | ~1.2s | 子路径切到 v2 后提示出现，且页面仍未刷新、仍由子路径 worker 控制 |
| PASS | `subpath-confirm-reloads-onto-new-content` | ~1.6s | 子路径确认后刷新到 `/folio-smoke/docs/hello/` 的 v2 正文，缓存只剩 1 份且版本等于 v2 |
| PASS | `auto-v1-controlled-first-visit` | ~0.6s | `updateMode:"auto"` 首次访问即被 worker 接管（prompt 模式不会） |
| PASS | `auto-update-activates-without-prompt` | ~1.4s | auto 模式无需确认即刷新到 v2，全程无提示元素，旧缓存被替换 |
| PASS | `registration-failure-observable` | ~0.7s | `/sw.js` 404 时 `onRegisterError` 被调用、`registrationState === "failed"`，正文仍渲染 |

具体数值、耗时、tarball sha256、commit SHA、两次内容版本与 console 记录都在
[`results/acceptance.json`](results/acceptance.json)。

> 该文件里的 `meta.commit` 是运行时的 `git rev-parse HEAD`；tarball 来自**工作区**构建，
> 所以 `meta.packagedSourcesClean` 与 `meta.dirtyPackagedSources` 一起说明「这个 commit
> 本身能否唯一标识被测 tarball」。
>
> 第一轮记录的验收是在 commit `8a40780` 的 **detached worktree** 里跑的
> （`meta.runFromCleanCheckout: true`，`packages/`、`apps/`、`schemas/`、`scripts/` 无未提交
> 改动），因此那一份 tarball（sha256 `e92ba9fe…`）可由该 commit 复现。
>
> **第二轮（P1/P2/P3 返修）的 20 项记录来自带未提交改动的工作区**，因为返修本身就是未提交
> 改动：`meta.packagedSourcesClean` 为 `false` 并逐条列出那些路径，`meta.commit` 只是运行时
> HEAD（`780e6b3`，返修前基线）。这一轮的可复现标识是 tarball sha256（记为
> `meta.packageEvidence.sha256`），不是 commit。返修提交后会在干净 worktree 里重跑一次以刷新
> 该记录。

## 设计上的两点取舍

- **正文来自预渲染 HTML，而不是 `virtual:folio/content`。** 如果 fixture 把 Markdown
  打进 JS bundle，改 Markdown 就会改 `assets/*.js`，"内容-only 发布" 这个前提自动失效。
  所以 fixture 只从 `#root .folio-markdown` 读取正文，保证两次构建的 JS/CSS 逐字节相同。
- **「再次显示提示」用的是公开组件重挂载。** 真实读者关掉提示后会进入下一次会话，而
  公共组件本身没有「重新打开」按钮。fixture 因此挂载一个自己的按钮来重挂载
  未经修改的 `<FolioPwaUpdatePrompt />`；没有触碰 Folio 内部状态，也没有伪造提示。

## 负控（脚本真的会失败吗）

一个只会 PASS 的验收脚本不是证据。四个一次性负控（都在 `/tmp` 的副本里跑，仓库内脚本
未改动，跑完即删）确认失败会被抓到：

| 负控 | 改动 | 结果 |
| --- | --- | --- |
| 内容没变 | 第二次构建写回 v1 标记 | `[build-v2] FAIL`（正文不含 v2 标记） |
| 内容版本没变 | 强行把 v2 的 `folio-version.json` 改回 v1 哈希 | `[content-only-condition] FAIL`（内容-only 前提不成立） |
| 没有新部署 | 服务器根始终停在 v1 | `[browser] FAIL timed out ... [data-folio-pwa-update-prompt]` |
| 提示期间偷偷刷新 | 提示可见时强制 `Page.navigate` | `[FAIL] no-reload-while-prompt-visible`（bootId/timeOrigin 变化） |

## 三个部署阶段（第二轮新增）

同一个 fixture 通过环境变量切换部署形态，三次都是真实浏览器交互：

| 阶段 | base | 更新模式 | 验证内容 |
| --- | --- | --- | --- |
| 根路径 | `/` | `prompt` | 提示不刷新 / 稍后 / 确认刷新 / 旧缓存清理 / 注册失败可观察 |
| 子路径 | `/folio-smoke/` | `prompt` | worker script URL、worker scope、manifest link 都在 base 下；提示同样不刷新；确认后刷新到 `/folio-smoke/` 的新正文 |
| 自动更新 | `/` | `auto` | 首次访问即被接管；新部署无需人工确认即激活并加载新正文；全程无提示元素；旧缓存被替换 |

子路径阶段使用独立的 browser context（`Target.createBrowserContext`），避免根路径的
注册与缓存互相干扰；服务器按 base 前缀剥离路径，base 之外的 URL 返回真实 `404.html`。

## 已知边界（未验证，不得当作通过）

- 只覆盖 Chromium（本机 Chrome 156）。Firefox / Safari 的 Service Worker 行为未验证。
- 只覆盖一种子路径深度（`/folio-smoke/`，单段）；多段 base（如 `/a/b/`）未单独验证。
- 只用 `generateSW` + 默认 Workbox 策略；`injectManifest`、自定义 runtimeCaching 未覆盖。
- auto 模式未覆盖多标签页竞争与"标签页在后台时是否延迟激活"。
- 未覆盖离线访问、真实 CDN/托管平台的缓存头差异、iOS/Android 安装流程。
- 第 7 项用「`/sw.js` 返回 404」代表注册失败。它证明了 `onRegisterError` /
  `registrationState === "failed"` 通路，但不覆盖 DNS、TLS、被扩展拦截等失败形态。
