# FOL-019 · 独立消费者默认 UI 视觉基线

- Issue: [#110](https://github.com/uichat-mira/folio/issues/110)
- 基线源码: `origin/dev` @ `0396f61549838cb9622728ceeafee623f2e085b5`
  （`refactor(fol-018): separate core types from React UI props (#113)`）
- 分支: `feat/fol-019-visual-baseline`
- 包: `@uichat-mira/folio@0.1.1`，tarball `uichat-mira-folio-0.1.1.tgz`，
  sha256 `97b2eb9163878882ab34206e9570b7fae7b3598377515e8b9e79a9b98e4fa2c3`（27 427 字节）
- 采集时间: 2026-11-01 18:50:08 +08:00（`acceptance.json` 记录 `2026-11-01T10:50:08.754Z`）
- 浏览器: Headless Chrome `156.0.8078.79`（`--headless=new`，DPR 1，`--hide-scrollbars`）
- OS: Windows 11 Pro build 26100（`win32 x64`），Node `v24.9.0`，npm `11.6.0`
- 复现: `node docs/research/fol-019/run.mjs`
- 结果: **30 PASS / 0 FAIL / 1 WARN**（`results/acceptance.json`）
- PR: 待创建；链接与 evidence commit SHA 在随后一次仅文档提交中补齐（见第 10 节）

> 本文把「历史证据 / 本次实测 / 视觉主观判断 / 未执行项」分开写。所有数字来自
> `results/acceptance.json`；本 agent **无法读取图片输入**，因此没有任何“看图得出”的
> 审美结论，截图的最终视觉判定交给维护者。

## 1. 结论摘要

一个只安装真实 npm tarball 的独立 Vite + React 消费者，在当前 `dev`（`0396f615`）的
包候选上：

1. 只用三个公开入口（`@uichat-mira/folio`、`@uichat-mira/folio/vite`、
   `@uichat-mira/folio/styles.css`）与 `virtual:folio/content` 就能构建默认文档 UI；
2. 桌面 1440×900 与手机 375×812 的亮/暗基线都有真实截图与原始浏览器记录，
   导航、TOC、搜索入口、分页、移动抽屉/面板与主题切换都实际可用；
3. 无 JavaScript 的预渲染静态 HTML 单独验证：正文、导航/TOC、分页链接、类名与默认
   CSS 都真实生效；该验证**不是** `staticRoutes: false` 的 React SPA；
4. 已知缺口如实记录：无 JS 静态输出没有 `data-folio-theme`，系统暗色偏好下仍是亮色
   画布（WARN）；静态 HTML 只输出文档壳，不含站点 header/footer/搜索入口。

## 2. 方法：复用而不是重建

浏览器驱动只有一份：[`fol-014/run.mjs`](fol-014/run.mjs)。本卡把它的输出目录、
消费者 fixture 与场景参数化，`docs/research/fol-019/run.mjs` 只做场景包装：

```bash
node docs/research/fol-019/run.mjs
# 等价于：
node docs/research/fol-014/run.mjs \
  --out docs/research/fol-019/results \
  --fixture docs/research/fol-019/consumer \
  --scenario docs/research/fol-019/scenario.json
```

不传任何参数时 `fol-014/run.mjs` 的默认输出目录、fixture、预期标题、交互选择器与
产物路径保持不变（`fol-014/results` 不被覆盖）。FOL-019 只新增两段**场景开启**的
逻辑：搜索入口探测与无 JS 静态阶段；默认 FOL-014 运行不会执行它们。

一次运行、一次 tarball 安装、两次构建：

| 阶段 | 构建 | 用途 |
| --- | --- | --- |
| React 运行时 | `staticRoutes: false` | SPA 壳 + 真实 React 交互；桌面/手机、亮/暗、搜索、抽屉 |
| 无 JS 静态 | `FOLIO019_STATIC=1` → `staticRoutes: {}` | 包内公开 Vite 插件写出预渲染 HTML；禁用 JS 后测量阅读路径 |

消费者 fixture（[`fol-019/consumer/`](fol-019/consumer)）是 `fol-014/consumer` 的副本，
只改了三处：`vite.config.ts` 用环境变量切换 `staticRoutes`、新增长文样张
`content/docs/long-form.md`、站点标题/页脚改为 FOL-019 文案。**没有**修改
`fol-014/consumer` 的既有文档，历史 fixture 保持可比。

消费者不引用 workspace 内部源码路径、不使用 workspace 别名，也不加载
`apps/site` 的 `site.css` / `showcase.css` / `legacy-claude-visual.css`。构建后唯一的
CSS 资产是 `index-USddMZKB.css`（18 973 字节），检查 `.site-article-proof` /
`.showcase-home` / `.claude-visual` 三个选择器均为 `false`。

### 2.1 独立安装

```bash
npm run build -w @uichat-mira/folio                 # 仓库内构建
npm pack --ignore-scripts --pack-destination <tmp>  # 真实 tarball
npm install --no-audit --no-fund ./uichat-mira-folio-0.1.1.tgz \
  @vitejs/plugin-react@^5 typescript@^5.9.3 \
  @types/react@^19 @types/react-dom@^19 @types/node@^24
node node_modules/vite/bin/vite.js build            # React 阶段
FOLIO019_STATIC=1 node node_modules/vite/bin/vite.js build   # 静态阶段
```

安装结果（`packageEvidence.installedVersions`）：`@uichat-mira/folio@0.1.1`、
`react@19.3.1`、`react-dom@19.3.1`、`react-router-dom@7.18.5`、`vite@7.3.7`、
`typescript@5.9.3`。`react` / `react-dom` / `react-router-dom` / `vite` 全部由 peer
依赖解析进入；`node_modules/@uichat-mira/folio` 不是符号链接
（`isSymlink=false`）。

tarball 的默认样式表 `dist/styles.css` sha256
`2ad01dd2806e3ae0b29596a32f013cfcc42af3602e554e6793a11b25a1e8dd2b`。

## 3. React 运行时基线（本次实测）

### 3.1 截图（真实抓取，可复查）

| 场景 | 视口 | 截图 | sha256（前 16 位） |
| --- | --- | --- | --- |
| 桌面亮色 | 1440×900 | [`desktop-1440-light.png`](fol-019/results/screenshots/desktop-1440-light.png) | `d09bb0dcb8a9a006` |
| 桌面暗色 | 1440×900 | [`desktop-1440-dark.png`](fol-019/results/screenshots/desktop-1440-dark.png) | `2c2909e175bc0f19` |
| 手机亮色 | 375×812 | [`mobile-375-light.png`](fol-019/results/screenshots/mobile-375-light.png) | `bd6b42c6527b6c3d` |
| 手机暗色 | 375×812 | [`mobile-375-dark.png`](fol-019/results/screenshots/mobile-375-dark.png) | `be86256028610032` |
| 手机目录抽屉 | 375×812 | [`mobile-375-drawer-open.png`](fol-019/results/screenshots/mobile-375-drawer-open.png) | `a272a7412da4e781` |
| 手机页内导航面板 | 375×812 | [`mobile-375-toc-open.png`](fol-019/results/screenshots/mobile-375-toc-open.png) | `9f8c582e8d9d641d` |

暗色不是预置状态：两档视口都先以亮色加载，再通过界面上的真实主题控件切到暗色。
另有 `desktop-system-dark` 会话（清空 `localStorage` + `prefers-color-scheme: dark`）
验证系统偏好默认路径，不另存截图（结果状态与桌面暗色一致）。

### 3.2 布局几何（`getBoundingClientRect` / computed styles）

| 观测点 | 1440×900 | 375×812 |
| --- | --- | --- |
| 侧栏 `.folio-docnav` | 可见，250×836 @ x=80 | 隐藏（0×0），由抽屉替代 |
| 正文 `.folio-doc-main` | 820×2077 @ x=330 | 343×2619 @ x=16 |
| 页内目录 `.folio-toc` | 可见，210×248 @ x=1150 | 隐藏（0×0），由面板替代 |
| 移动工具条 `.folio-docs-mobile-bar` | 隐藏 | 可见，375×42 @ y=64 |
| 分页 `.folio-page-nav` | 可见，724×90 | 可见，343×83 |
| H1 起始位置 | 距 header 底部 92px | 距 header 底部 122px |
| 页面滚动宽度 / 视口宽 | 1440 / 1440 | 375 / 375 |
| 页面滚动高度 | 2217 | 2801 |
| 遮挡检测（header∩h1、sidebar∩main、toc∩main） | false / false / false | false / false / false |
| 无滚动容器的越界元素 | 0 | 0 |
| 被静默裁切的文本元素 | 0 | 0 |

手机端 6 个“越界”元素全部位于 `pre`（`overflow-x: auto`，scrollWidth 627 /
clientWidth 343）内部，属于设计内的代码块横向滚动，页面本身不横向滚动。

### 3.3 交互结果（真实点击 → 状态变化）

| 步骤 | 点击目标 | 结果 |
| --- | --- | --- |
| 桌面 TOC | `#页面结构` | hash 更新，TOC 高亮同步 |
| 桌面侧栏 | `/docs/intro` | SPA 路由到 `/docs/intro`，H1 变“安装真实 tarball” |
| 桌面上/下篇 | `.folio-page-nav__next` / `__previous` | 两个方向都在集合内正确跳转 |
| 桌面搜索 | `.folio-search-trigger` | 浮层可见、输入框聚焦；输入“安装”返回 2 条结果；Esc 关闭 |
| 桌面主题 | `.folio-theme-toggle` | `data-folio-theme: light → dark`，`localStorage=dark`，`color-scheme: dark` |
| 手机抽屉打开 | 工具条“菜单” | 抽屉 323×812，遮罩 `rgba(15,14,13,0.42)`，含 4 个文档链接 |
| 手机抽屉关闭 | 抽屉“关闭” | 抽屉移除且不跳转 |
| 手机抽屉选择 | “定制与边界” | 路由到 `/docs/third`，抽屉自动关闭 |
| 手机页内导航 | 工具条“页面导航” | 面板 351×217，含 4 个标题链接 |
| 手机页内导航选择 | “可定制的表面” | hash 更新，面板自动关闭 |
| 手机页内导航关闭 | 面板“关闭” | 面板移除 |
| 手机主题 | 移动面板“暗色模式” | `data-folio-theme: light → dark`，面板关闭 |

系统偏好路径：清空 `localStorage` + `prefers-color-scheme: dark` → 首屏
`data-folio-theme=dark`，`body` 背景 `rgb(24,23,21)`。

### 3.4 可读性数值（不是视觉判断）

| 指标 | 桌面亮色 | 桌面暗色 | 手机亮色 | 手机暗色 |
| --- | --- | --- | --- | --- |
| 正文字号 / 行高 | 16px / 28.48px | 同 | 16px / 28.48px | 同 |
| 正文对比度（WCAG） | 10.34:1 | 14.43:1 | 10.34:1 | 14.43:1 |
| H1 字号 / 对比度 | 44px / 17.5:1 | 44px / 17.5:1 | 36px / 17.5:1 | 36px / 17.5:1 |
| 正文文字色 / 页面底色 | `rgb(61,61,58)` / `rgb(250,249,245)` | `rgb(235,230,223)` / `rgb(24,23,21)` | 同桌面 | 同桌面 |

### 3.5 控制台

React 三个页面会话 + 无 JS 静态两档视口，`Runtime.consoleAPICalled`（error/warning/
assert）、`Runtime.exceptionThrown`、`Log.entryAdded`（level=error）合计 **0 条**。
构建期只有 Vite 的 chunk 体积提示（警告，不计入错误）。

### 3.6 DOM 证据

- [`dom-desktop-1440-light.html`](fol-019/results/dom-desktop-1440-light.html)：
  `.folio-shell` / `.folio-header` / `.folio-docnav` / `.folio-doc-main` / `.folio-toc` /
  `.folio-page-nav` 的完整渲染 DOM。
- [`dom-mobile-375-drawer-open.html`](fol-019/results/dom-mobile-375-drawer-open.html)：
  抽屉打开时的 DOM（`.folio-docs-overlay` + `.folio-docs-drawer`）。

## 4. 无 JS 静态 HTML 验收（独立证据）

这一节只使用 `FOLIO019_STATIC=1` 构建出的预渲染 HTML；与第 3 节的 React SPA 证据
互不替代。`staticRoutes: false` 的 SPA **不算**静态验收。

### 4.1 产物文件（磁盘证据）

`vite build`（`staticRoutes: {}`）写出：

| 路由 | 文件 | 字节 | `#root` 有预渲染内容 | 期望类名 | 缺失文本 |
| --- | --- | --- | --- | --- | --- |
| `/` | `index.html` | 1 619 | 是 | `folio-prerender` | 无 |
| `/docs/second/` | `docs/second/index.html` | 8 994 | 是 | 5 个文档壳类名 | 无 |
| `/docs/third/` | `docs/third/index.html` | 6 706 | 是 | 5 个文档壳类名 | 无 |
| `/docs/long-form/` | `docs/long-form/index.html` | 13 395 | 是 | 5 个文档壳类名 | 无 |

另有 `docs/intro/index.html`、`404.html`。分页链接直接写在 HTML 里，例如
`/docs/second/` 的 `href` 为 `/docs/intro/` 与 `/docs/third/`。

### 4.2 禁用 JavaScript 后的页面（浏览器证据）

用 CDP `Emulation.setScriptExecutionDisabled` 在首次导航前禁用脚本，再测量
`/docs/second/`：

| 观测点 | 1440×900 | 375×812 |
| --- | --- | --- |
| 脚本是否执行 | `consumerRoots=null`、`.folio-shell` 不存在、`data-folio-theme=null` | 同 |
| `#root` | 1 个子元素，非空壳 | 同 |
| 正文 | 6 个标题、11 段、1 表格、1 代码块、1 引用 | 同 |
| 导航 | `.folio-docnav` 250×836，4 个链接、2 个分组、当前项 `aria-current=page` | 桌面导航隐藏，改用原生 `<details>` 菜单（2 个） |
| 页内目录 | `.folio-toc` 210×248，6 个标题链接 | 同上（`<details>` 面板内） |
| 分页 | `.folio-page-nav` 724×90，前后两向链接 | 343×83 |
| 默认 CSS | 1 个样式表 `index-USddMZKB.css`（18 973 字节），含 `.folio-docnav` / `.folio-toc` / `.folio-page-nav` / `.folio-static-doc-menu` / `.folio-markdown`；H1 44px、正文 16px、画布 `rgb(250,249,245)`；对比度 17.5:1 / 10.34:1 | H1 36px，页面 scrollWidth=375 |
| 官方站私有样式 | 三个选择器均不存在 | 同 |

截图：
[`static-desktop-1440-light.png`](fol-019/results/screenshots/static-desktop-1440-light.png)、
[`static-mobile-375-light.png`](fol-019/results/screenshots/static-mobile-375-light.png)。

**执行证明**：页面里的 module script 仍会被浏览器抓取（`jsResourcesLoaded=1`），但
消费者入口设置的 `data-folio-consumer-roots` 标记不存在、React 的 `.folio-shell`
不存在、`#root` 保留预渲染内容。也就是说：脚本被禁用后没有执行，静态 HTML 自己完成
了渲染。

### 4.3 静态路径的已知缺口（WARN，不是 PASS）

- **无 JS 暗色缺失**：静态 HTML 没有 `data-folio-theme` 属性，默认样式表只在
  `[data-folio-theme="dark"]` 下切换暗色。因此禁用 JS 且
  `prefers-color-scheme: dark` 时画布仍是 `rgb(250,249,245)`；
  [`static-desktop-1440-system-dark.png`](fol-019/results/screenshots/static-desktop-1440-system-dark.png)
  与亮色截图 sha256 完全相同（`9bba1f0ad06700c9…`），这是可复核的负面证据。
  记录为 WARN，不伪装成通过。
- **静态输出没有站点 header/footer/搜索入口**：静态壳只渲染文档导航、正文、TOC 与
  分页；无 JS 读者可以完整阅读与跳转，但没有搜索入口。这是静态输出路径的现状，
  归属 FOL-009 的静态合同，本卡只如实记录，不修改产品代码。
- **链接形式不同**：静态导航/分页链接带尾斜杠（`/docs/intro/`），React SPA 用
  `/docs/intro`。两者都能工作，但属于两条输出路径的差异，后续复用基线时需注意。

## 5. 观察与现存缺陷

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 移动工具条触控目标 | 菜单 42×40、页面导航 68×40、抽屉关闭 42×40；最小高度 40px，高于 WCAG 2.2 的 24px，低于 44px 舒适目标；记为观察，不阻断 | `mobile-tap-target-size` |
| 无 JS 静态暗色 | WARN，见 §4.3 | `static-theme-no-js` |
| 静态壳无 header/搜索 | 观察，见 §4.3 | 静态 DOM / `static-navigation` |
| 代码块窄屏 | `pre` 内部横向滚动（627/343），页面不横向滚动 | `mobile-no-horizontal-overflow` |
| `virtual:folio/content` 类型 | 当前包已随 `dist/virtual.d.ts` 发布，独立消费者无需自写声明即通过严格 `tsc`；这与 FOL-014 的历史 FAIL 不同，属于本次实测 | `types-virtual-module` |

## 6. 历史证据 / 本次实测 / 视觉主观判断 / 未执行项

### 6.1 历史证据（不作为本次结论）

- [`fol-014-default-ui-acceptance.md`](fol-014-default-ui-acceptance.md) 与
  `fol-014/results/` 是 `e047529` 时代、40px 触控目标补丁之前的快照：其移动按钮为
  38×21，且 `virtual:folio/content` 在“只装 tarball”的消费者里是 TS2307 FAIL。
- 本次没有覆盖或改写 `fol-014/results/` 与 `fol-014/consumer/`；它们只作为方法与
  对照，**不**被当作当前基线。

### 6.2 本次实测（绑定 exact SHA）

- 源码 SHA：`0396f61549838cb9622728ceeafee623f2e085b5`。
- tarball 由该工作树构建；`packageSourceDirty=false`，即 `packages` / `apps` /
  `schemas` / `scripts` 相对 `0396f615` 无改动，tarball sha256 为
  `97b2eb9163878882ab34206e9570b7fae7b3598377515e8b9e79a9b98e4fa2c3`。
- 本 PR 只新增 `docs/research/fol-019/` 与最小 harness 参数化；产品样式、运行时与
  构建行为未变。

### 6.3 视觉主观判断

- 本 agent **不能读取图片输入**，没有做任何“好看/不好看”“配色是否高级”的判断。
- 第 3.4 节的对比度、字号、行高与矩形是数值证据，不是审美结论；截图的最终视觉判定
  交给维护者。

### 6.4 未执行项

| 项 | 原因 |
| --- | --- |
| Firefox / Safari、真机 iOS/Android、屏幕阅读器 | 本机只有 headless Chrome；触屏是 CDP 视口模拟 |
| 子路径部署（`basePath` / `base`）下的运行时与静态路径 | 本卡未覆盖；FOL-009 覆盖静态 base |
| 多 collection 混合、文章/项目类型、404 页、分享按钮 | 本卡聚焦默认文档阅读路径 |
| 无 JS 暗色 | 现状不支持，见 §4.3（记录为 WARN） |
| `npm run release:check` / CI | 本卡不把浏览器 harness 加进 CI；包层回归由 FOL-020 与现有流水线负责。本次未运行 `release:check`，不冒充通过 |
| 无参数 `node docs/research/fol-014/run.mjs` 的完整重跑 | 为避免覆盖历史 `fol-014/results/`，改用 `--out` 指向仓库外临时目录做默认行为检查：默认 fixture、默认 3 篇标题、无搜索/静态阶段，**23 PASS / 0 FAIL**（见第 8 节） |

## 7. 验收矩阵

| # | 测试点 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 只装真实 `.tgz`，非 workspace link / 源码 alias | **PASS** | `install-independent`，`isSymlink=false` |
| 2 | tarball 可追溯（文件名 + sha256 + 源 SHA） | **PASS** | §6.2、`packageEvidence` |
| 3 | 未引入 `apps/site` 品牌样式 | **PASS** | `build-no-official-site-css`，CSS 18 973 字节 |
| 4 | 4 篇文档进入客户端 bundle | **PASS** | `build-default-ui` |
| 5 | 桌面侧栏/正文/TOC 同时可见 | **PASS** | §3.2 |
| 6 | 桌面分页双向可点 | **PASS** | §3.3 |
| 7 | 桌面搜索入口打开、查询、Esc 关闭 | **PASS** | `desktop-search` |
| 8 | 手机目录抽屉打开/选择/关闭 | **PASS** | `mobile-drawer` |
| 9 | 手机页内导航面板打开/选择/关闭 | **PASS** | `mobile-toc` |
| 10 | 页面无异常水平溢出、无内容遮挡 | **PASS** | §3.2 |
| 11 | 亮色默认可用（对比度数值） | **PASS** | §3.4 |
| 12 | 暗色可经界面切换并生效 | **PASS** | `*-dark-theme-applied` |
| 13 | 系统偏好 `prefers-color-scheme` 默认路径 | **PASS** | `system-theme-default` |
| 14 | 控制台无运行错误 | **PASS** | `console-errors` |
| 15 | 根入口 / `/vite` / 虚拟模块 / app 四个严格 `tsc` | **PASS** | `types-*`（4/4） |
| 16 | 静态 HTML 文件真实写出且 `#root` 有预渲染内容 | **PASS** | `static-html-routes` |
| 17 | 禁用 JS 后正文/导航/TOC/分页/类名/CSS 生效 | **PASS** | `static-*`，§4.2 |
| 18 | 明确区分静态 HTML 与 `staticRoutes:false` SPA | **PASS** | §2、§4 |
| 19 | 无 JS 暗色 | **WARN** | `static-theme-no-js`，§4.3 |
| 20 | 视觉观感 | **NOT TESTED** | 本 agent 不能读图，交维护者 |

## 8. 复现与证据清单

```bash
npm ci --no-audit --no-fund
node docs/research/fol-019/run.mjs          # FOL-019 基线：pack → install → tsc ×4 → build ×2 → Chrome
node docs/research/fol-019/run.mjs --keep   # 保留仓库外临时消费者目录用于诊断

# 默认行为检查（不覆盖 fol-014/results；本次实际执行）：
node docs/research/fol-014/run.mjs --out C:\Users\Administrator\AppData\Local\Temp\folio014-default-check
# → 默认 fixture + 默认 3 篇标题 + 无搜索/静态阶段，23 PASS / 0 FAIL
```

| 证据 | 位置 |
| --- | --- |
| 场景包装 | [`fol-019/run.mjs`](fol-019/run.mjs) |
| 场景定义 | [`fol-019/scenario.json`](fol-019/scenario.json) |
| 独立消费者 fixture | [`fol-019/consumer/`](fol-019/consumer) |
| 原始数据（包、类型、构建、几何、交互、控制台、静态、无 JS） | [`fol-019/results/acceptance.json`](fol-019/results/acceptance.json) |
| 截图（6 张 React + 3 张静态） | `fol-019/results/screenshots/` |
| 渲染 DOM（桌面、抽屉打开态） | `fol-019/results/dom-*.html` |
| 复用/修补的 harness | [`fol-014/run.mjs`](fol-014/run.mjs) |

## 9. Harness 变更（最小必要）

`fol-014/run.mjs` 新增：

1. `--out` / `--fixture` / `--scenario` 三个参数；默认值仍是
   `docs/research/fol-014/results` 与 `docs/research/fol-014/consumer`。
2. 场景可覆盖起始路由、预期标题与交互选择器；默认选择器与 FOL-014 完全一致。
3. 场景开启的搜索入口探测与无 JS 静态阶段（第二次 `vite build` + CDP 禁用脚本）。
4. 两处输出文案修正：触控目标高度改为动态值（不再硬编码 21px）、控制台检查文案
   覆盖静态页面。

没有新增浏览器驱动、没有引入 Playwright/Puppeteer、没有改动包源码、样式或构建脚本。

## 10. PR 与 head SHA

- PR: [#116](https://github.com/uichat-mira/folio/pull/116)（`feat/fol-019-visual-baseline` → `dev`）
- 证据提交（evidence commit / 创建 PR 时的 head）:
  `995260751a6ec2ee2e1c815598bf2c9ecab10a65`
- 本报告首版与全部证据在该提交中；本提交只追加 PR 链接与 head SHA 记录，不改动
  证据数据。Ready 时的精确 head SHA 记录在 PR 描述与本任务的 captain 汇报中。
- 自检后转 Ready，并由 Folio OpenCode Review 复核。
