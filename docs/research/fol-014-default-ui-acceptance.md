# FOL-014 · 从真实 tarball 验收 Folio 默认 UI 与类型消费

- Issue: [#84](https://github.com/uichat-mira/folio/issues/84)
- 基线: `origin/dev` @ `e0475295e1e8609453273c88932955d9d8d1716d`（`docs(research): verify static and React docs navigation parity (FOL-008 #52)`）
- 分支: `feat/fol-014-default-ui-acceptance`
- 浏览器: Headless Chrome 156.0.8078.79（Windows x64，`--headless=new`，DPR 1，`--hide-scrollbars`）
- 复现: `node docs/research/fol-014/run.mjs`
- 结论: **默认文档 UI 在独立 tarball 消费者上可用**（22 项 PASS / 1 项 FAIL / 1 项观察）；唯一 FAIL 是 `virtual:folio/content` 没有随包发布类型声明，属已知缺口的实测确认，**不阻断运行时首发**，但需要一条最小动作（见第 6 节）。

## 1. 结论摘要

一个全新的 Vite + React 消费者，只安装 `npm pack` 打出的 `.tgz`、只引用三个公开入口
（`@uichat-mira/folio`、`@uichat-mira/folio/vite`、`@uichat-mira/folio/styles.css`）和
`virtual:folio/content`，就能构建并运行 Folio 的默认文档站：侧栏、页内目录、正文排版、
上一篇/下一篇、移动端抽屉与页内导航面板、亮/暗主题都实际可用，页面没有异常水平溢出、
没有内容遮挡，控制台没有错误。

本卡证明的事实分三层，互不替代：

1. **包证据**：tarball `uichat-mira-folio-0.1.0.tgz`，sha256
   `ebc5abe101ac9efc8d567ac0397c8e1a29efaba5611adecfaa456e80810ce6fa`。它在本分支
   `471c605` 上构建，该提交相对基线 `e047529` 只新增了 `docs/research/fol-014/`，
   `packages/` 字节未变（`packageSourceDirty=false`、`dirtyWorkingTree=false`），
   sha256 与 FOL-007 实测的 tarball 完全一致，说明包内容自 FOL-007 起未变。消费者目录里
   `node_modules/@uichat-mira/folio` 不是符号链接（`lstat.isSymbolicLink() === false`）。
2. **浏览器证据**：1440×900 与 375×812 两档视口、亮/暗两种主题共 6 张真实截图，
   外加 `acceptance.json` 里的 DOM 尺寸、computed styles、点击结果与 console 记录。
3. **类型证据**：5 次真实 `tsc`。根入口与 `/vite` 入口 PASS；`virtual:folio/content`
   在“只装 tarball”的消费者里 **FAIL（TS2307）**；补上消费者侧 7 行声明后 PASS。

**本 agent 无法读取图片输入**（模型不支持图像输入），因此本报告没有任何“看图得出”的
外观判断。截图的最终视觉判定交给 Mira；这里能证明的是 DOM 结构、几何尺寸、computed
styles、对比度数值与真实点击后的状态变化。

## 2. 方法：只使用真实产物

| 输入 | 来源 | 校验 |
| --- | --- | --- |
| 包 | `npm run build -w @uichat-mira/folio` + `npm pack --ignore-scripts` | sha256 记录在 `results/acceptance.json` 的 `packageEvidence`；`packages/` 相对 `e047529` 无改动 |
| 样式 | tarball 内 `dist/styles.css` | sha256 `58d5e7094187684e633bfd3f83ba32935dd3e3a9f15511b0732804ec32493718`（与 FOL-007 一致） |
| 默认 UI | `FolioApp`（根入口）、`folio()`（`/vite`）、`virtual:folio/content` | 构建产物内出现三篇文档标题 |
| 消费页 | [`docs/research/fol-014/consumer/`](fol-014/consumer) | 3 篇 Markdown + 入口文件，无仓库内部路径 |
| 浏览器 | 系统 Chrome | 版本与 UA 记录在 `browser.engine` / `browser.userAgent` |

消费者刻意**不**引用 `apps/site/src/site.css`、`showcase.css`、`legacy-claude-visual.css`，
也不使用 workspace 别名。构建后唯一的 CSS 资产是 `index-DqpBTcOP.css`（18 851 字节），
内含 `.site-article-proof` / `.showcase-home` / `.claude-visual` 选择器的检查结果为
`false`，即视觉完全来自 tarball 的默认样式表。

`staticRoutes` 显式设为 `false`：静态 HTML 已由 FOL-009 覆盖，本卡要验的是 React 运行时，
所以服务的是一个纯 SPA 壳，任何点击都不可能是预渲染页面代答。

### 2.1 独立安装

```bash
npm run build -w @uichat-mira/folio                 # 仓库内构建
npm pack --ignore-scripts --pack-destination <tmp>  # 真实 tarball
npm install --no-audit --no-fund ./uichat-mira-folio-0.1.0.tgz \
  @vitejs/plugin-react@^5 typescript@^5.9.3 \
  @types/react@^19 @types/react-dom@^19 @types/node@^24
node node_modules/vite/bin/vite.js build
```

安装结果（`packageEvidence.installedVersions`）：`@uichat-mira/folio@0.1.0`、
`react@19.3.1`、`react-dom@19.3.1`、`react-router-dom@7.18.5`、`vite@7.3.7`、
`typescript@5.9.3`。`react` / `react-dom` / `react-router-dom` / `vite` 全部由 peer
依赖解析进入，消费者没有显式安装它们。

### 2.2 抓取方式

`run.mjs` 用 Node 内置 WebSocket 直连 Chrome DevTools Protocol（`Target.attachToTarget`
+ `Runtime.evaluate` + `Page.captureScreenshot` + `Emulation.setDeviceMetricsOverride`），
不引入 Playwright/Puppeteer。三个页面会话：

- `desktop-1440x900`：亮色测量 → 截图 → 点击 TOC/侧栏/分页 → 点主题切换 → 暗色测量 → 截图；
- `mobile-375x812`（`mobile: true`）：亮色测量 → 截图 → 打开抽屉/关闭/选择文档 → 打开
  页内导航/选择标题/关闭 → 从移动面板切主题 → 暗色测量 → 截图；
- `desktop-system-dark`：清空 `localStorage` + `prefers-color-scheme: dark`，只验证系统
  偏好默认路径（无截图，渲染状态与桌面暗色截图相同）。

暗色不是预置状态：两档视口都是先以亮色加载，再通过界面上的真实主题控件切到暗色。

## 3. 浏览器验收

### 3.1 场景与截图

| 场景 | 视口 | 截图 | 结论 |
| --- | --- | --- | --- |
| 桌面亮色 | 1440×900 | [`desktop-1440-light.png`](fol-014/results/screenshots/desktop-1440-light.png) | PASS |
| 桌面暗色 | 1440×900 | [`desktop-1440-dark.png`](fol-014/results/screenshots/desktop-1440-dark.png) | PASS |
| 手机亮色 | 375×812 | [`mobile-375-light.png`](fol-014/results/screenshots/mobile-375-light.png) | PASS |
| 手机暗色 | 375×812 | [`mobile-375-dark.png`](fol-014/results/screenshots/mobile-375-dark.png) | PASS |
| 手机目录抽屉 | 375×812 | [`mobile-375-drawer-open.png`](fol-014/results/screenshots/mobile-375-drawer-open.png) | PASS |
| 手机页内导航面板 | 375×812 | [`mobile-375-toc-open.png`](fol-014/results/screenshots/mobile-375-toc-open.png) | PASS |

### 3.2 布局几何（`getBoundingClientRect` / computed styles）

| 观测点 | 1440×900 | 375×812 |
| --- | --- | --- |
| 侧栏 `.folio-docnav` | 可见，250×836 @ x=80 | 隐藏（0×0），由抽屉替代 |
| 正文 `.folio-doc-main` | 820×2077 @ x=330 | 343×2619 @ x=16 |
| 页内目录 `.folio-toc` | 可见，210×248 @ x=1150 | 隐藏（0×0） |
| 移动工具条 `.folio-docs-mobile-bar` | 隐藏 | 可见，375×42 @ y=64 |
| 分页 `.folio-page-nav` | 可见，724×90 | 可见，343×83 |
| H1 起始位置 | 距 header 底部 92px | 距 header 底部 122px |
| 页面滚动宽度 / 视口宽 | 1440 / 1440 | 375 / 375 |
| 页面滚动高度 | 2217 | 2801 |
| 遮挡检测（header∩h1、sidebar∩main、toc∩main） | false / false / false | false / false / false |
| 无滚动容器的越界元素 | 0 | 0 |
| 被静默裁切的文本元素 | 0 | 0 |

手机端唯一“越界”元素是代码块高亮 `span`：它们位于 `pre`（`overflow-x: auto`，
scrollWidth 627 / clientWidth 343）内部，属于设计内的横向滚动，页面本身不横向滚动
（`document.scrollWidth === 375`）。这一点被单独分类记录，不当作页面溢出。

### 3.3 交互结果（真实点击 → 状态变化）

| 步骤 | 点击目标 | 结果 |
| --- | --- | --- |
| 桌面 TOC | `#页面结构` | hash 变为 `#页面结构`，`scrollY` 314，TOC 高亮同步切换到 `#页面结构` |
| 桌面侧栏 | `/docs/intro` | SPA 路由到 `/docs/intro`，H1 变“安装真实 tarball”，侧栏 `aria-current` 跟随 |
| 桌面上/下篇 | `folio-page-nav__next` / `__previous` | 两个方向都在集合内正确跳转（`/docs/second` ↔ `/docs/intro`） |
| 桌面主题 | `.folio-theme-toggle` | `data-folio-theme: light → dark`，`localStorage['folio-theme']=dark`，`color-scheme: dark` |
| 手机抽屉打开 | 工具条“菜单” | 抽屉 323×812，遮罩 `rgba(15,14,13,0.42)` 覆盖 375×812，含 3 个文档链接 |
| 手机抽屉关闭 | 抽屉“关闭” | 抽屉移除且不发生路由跳转 |
| 手机抽屉选择 | “定制与边界” | 路由到 `/docs/third`，H1 更新，抽屉自动关闭 |
| 手机页内导航 | 工具条“页面导航” | 面板 351×217 @ y=106，含 4 个标题链接 |
| 手机页内导航选择 | “可定制的表面” | hash 更新，`scrollY` 393，面板自动关闭 |
| 手机页内导航关闭 | 面板“关闭” | 面板移除 |
| 手机主题 | 移动面板“暗色模式” | `data-folio-theme: light → dark`，面板随后关闭 |

系统偏好路径：清空 `localStorage` + `prefers-color-scheme: dark` → 首屏
`data-folio-theme=dark`，`body` 背景 `rgb(24,23,21)`。

### 3.4 可读性数值（不是视觉判断）

| 指标 | 桌面亮色 | 桌面暗色 | 手机亮色 | 手机暗色 |
| --- | --- | --- | --- | --- |
| 正文 字号 / 行高 | 16px / 28.48px（1.78） | 同 | 16px / 28.48px | 同 |
| 正文对比度（WCAG） | 10.34:1 | 14.43:1 | 10.34:1 | 14.43:1 |
| H1 字号 / 对比度 | 44px / 17.5:1 | 44px / 17:1 | 36px / 17.5:1 | 36px / 17:1 |
| 正文文字色 / 页面底色 | `rgb(61,61,58)` / `rgb(250,249,245)` | `rgb(235,230,223)` / `rgb(24,23,21)` | 同桌面 | 同桌面 |

正文字体为 `Public Sans, …`，标题为 `Cormorant Garamond, …`（来自 `--folio-*` 变量）。
对比度全部高于 WCAG AA 的 4.5:1（正文）与 3:1（大字标题）。

### 3.5 控制台

三个页面会话、两档视口、亮暗各一次，`Runtime.consoleAPICalled`
（error/warning/assert）、`Runtime.exceptionThrown`、`Log.entryAdded`（level=error）
合计 **0 条**。构建期 Vite 只提示了 mermaid 相关 chunk 大于 500 kB 的分包建议，属警告。

### 3.6 DOM 证据

- [`dom-desktop-1440-light.html`](fol-014/results/dom-desktop-1440-light.html)：`#root`
  的完整渲染结果（`.folio-shell` / `.folio-header` / `.folio-docnav` / `.folio-doc-main`
  / `.folio-toc` / `.folio-page-nav` 均在）。
- [`dom-mobile-375-drawer-open.html`](fol-014/results/dom-mobile-375-drawer-open.html)：
  抽屉打开时的 DOM（`.folio-docs-overlay` + `.folio-docs-drawer`）。
- 说明：React 渲染出的 DOM 与视口无关（只有 CSS media query 变化），所以没有为手机再存
  一份同构 DOM。

## 4. TypeScript 独立消费

全部在临时消费者目录里跑真实 `tsc`（`typescript@5.9.3`），配置为
`strict: true`、`skipLibCheck: false`、`noUnusedLocals: true`，**没有** `any` 强转、
没有忽略错误、没有删除导入。

| # | 检查 | 命令 | 结果 |
| --- | --- | --- | --- |
| 1 | 消费者 app 工程（`src/main.tsx` + `vite.config.ts` + 消费者声明） | `tsc -p tsconfig.json` | **PASS**（exit 0） |
| 2 | 根入口 `@uichat-mira/folio` 只有它 | `tsc -p tsconfig.types-root.json` | **PASS**（exit 0） |
| 3 | 插件入口 `@uichat-mira/folio/vite` 只有它 | `tsc -p tsconfig.types-vite.json` | **PASS**（exit 0） |
| 4 | `virtual:folio/content`，**不**加消费者声明（即“只装 tarball”） | `tsc -p tsconfig.types-baseline.json` | **FAIL**（exit 2） |
| 5 | 同上，加消费者侧 7 行 `declare module` | `tsc -p tsconfig.types-declared.json` | **PASS**（exit 0） |

第 4 步的完整错误（`types.raw` 原样记录）：

```text
types/consumer-entry.ts(23,29): error TS2307: Cannot find module 'virtual:folio/content' or its corresponding type declarations.
```

诊断集合只有这一条（`baselineOnlyVirtualModule: true`），说明缺口确实只在虚拟模块，
根入口与 `/vite` 的声明是完整可用的。tarball 的 `dist/vite.d.ts` 里只有
`declare const folioVirtualModule = "virtual:folio/content";`（一个字符串常量），
**没有** `declare module "virtual:folio/content"` 的环境声明，`dist/index.d.ts` 也没有
引用任何这样的文件。

### 4.1 消费者 workaround（已实测可用）

```ts
// types/virtual-folio.d.ts —— 消费者自己写
declare module "virtual:folio/content" {
  import type { FolioDoc } from "@uichat-mira/folio";
  const docs: FolioDoc[];
  export default docs;
  export const roots: string[];
}
```

这和官方站 `apps/site/src/vite-env.d.ts` 的做法一致（官网那份没有声明 `roots`，
需要具名导出时还得自己补）。加上这份声明后，第 1、5 项 `tsc` 全绿。

### 4.2 最小修复建议（本卡未实施，需独立授权）

在包里随声明一起发布环境声明，而不是让每个消费者自己抄：

1. 新增 `dist/virtual.d.ts`：
   ```ts
   declare module "virtual:folio/content" {
     import type { FolioDoc } from "./index";
     const docs: FolioDoc[];
     export default docs;
     export const roots: string[];
   }
   ```
2. 在 `dist/index.d.ts`（以及 `dist/vite.d.ts`）顶部加
   `/// <reference path="./virtual.d.ts" />`，使消费者只要 import 了任一公开入口就能拿到
   虚拟模块类型。
3. 验证方式与成本：把本卡 harness 的第 4 项当作回归断言（去掉消费者声明后 `tsc` 应
   exit 0），并保持 `pack:consumer` 现有检查不变。

替代方案（不写代码）：由 FOL-012 的消费者契约文档给出上面那段 `declare module` 片段。
两者都需要显式授权，且都不应在本卡里改动公共 API。

## 5. 验收矩阵

| # | 测试点 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 独立安装真实 `.tgz`，非 workspace link、非源码 alias | **PASS** | `install-independent`；`isSymbolicLink=false` |
| 2 | tarball 与 commit 可追溯（文件名 + sha256 + 源 SHA） | **PASS** | `packageEvidence` |
| 3 | 没有引入 `apps/site` 品牌样式 | **PASS** | `build-no-official-site-css`，CSS 资产 18 851 字节 |
| 4 | 三篇文档进入客户端 bundle | **PASS** | `build-default-ui`（三个标题均在） |
| 5 | 桌面 1440×900 侧栏/正文/页内目录同时可见 | **PASS** | §3.2 |
| 6 | 桌面分页可见且双向可点 | **PASS** | §3.3 |
| 7 | 手机 375×812 目录抽屉可打开/选择/关闭 | **PASS** | §3.3、`mobile-drawer` |
| 8 | 手机页内导航面板可打开/选择/关闭 | **PASS** | §3.3、`mobile-toc` |
| 9 | 页面无异常水平溢出 | **PASS** | scrollWidth == 视口宽；越界元素 0 |
| 10 | 无内容遮挡或错位 | **PASS** | 三组矩形不相交；H1 在 header 下方 92/122px |
| 11 | 默认亮色可用 | **PASS** | 对比度 10.34:1 / 17.5:1 |
| 12 | 暗色可通过界面切换并生效 | **PASS** | `data-folio-theme`、`localStorage`、`color-scheme` 三者同步 |
| 13 | 系统偏好 `prefers-color-scheme` 默认路径 | **PASS** | `system-theme-default` |
| 14 | 控制台无运行错误 | **PASS** | `console-errors`（0 条） |
| 15 | `@uichat-mira/folio` 类型可独立消费 | **PASS** | `types-root-entry` |
| 16 | `@uichat-mira/folio/vite` 类型可独立消费 | **PASS** | `types-vite-entry` |
| 17 | `virtual:folio/content` 类型可独立消费 | **FAIL** | TS2307，见 §4 |
| 18 | 补消费者声明后虚拟模块类型可用 | **PASS** | `types-virtual-module-with-consumer-declaration` |
| 19 | 移动工具条按钮触控目标尺寸 | **观察（WARN）** | 38×21 / 64×21 / 抽屉“关闭”38×21，见 §6.2 |
| 20 | 搜索浮层、分享按钮、404 页、文章/项目类型 | **NOT TESTED** | 本卡聚焦默认文档阅读路径 |
| 21 | 子路径部署（`basePath` / `base`）下的 React 运行时 | **NOT TESTED** | FOL-009 覆盖静态 base；运行时 base 未测 |
| 22 | 多 collection 混合、超长表格/图片/脚注 | **NOT TESTED** | 本卡只用 1 个 collection、3 篇文档 |
| 23 | Safari/Firefox、真机 iOS/Android、屏幕阅读器 | **NOT TESTED** | 仅 headless Chrome 两档视口 |
| 24 | 截图观感（配色、留白、字体质感等） | **NOT TESTED** | 本 agent 无法读图，交 Mira 判定 |

配对产物：`results/acceptance.json` 是上述每一项的原始数据（含 rect、computed styles、
点击结果、console）。

## 6. 缺陷、判断与最小建议

### 6.1 `virtual:folio/content` 缺少随包类型声明（P2，不阻断运行时首发）

- 现象：只装 tarball 的独立 TS 消费者在 import 虚拟模块时得到 `TS2307`。
- 影响面：所有用 TypeScript 写消费端的项目；运行时完全正常（Vite 插件能解析），
  所以问题只在类型层。
- 现状缓解：写上 7 行 `declare module` 即可（§4.1），官方站自己也是这么做的。
- 是否阻断 0.1.0：**不阻断运行时发布，但建议在 0.1.0 前落一条最小动作**。二者择一：
  - (a) 包内随 `dist` 发布 §4.2 的环境声明（约 10 行 + 一次构建配置改动，回滚成本极低）；
  - (b) 由 FOL-012 在消费者契约里给出声明片段，并在 README 明写“需要消费者自行声明”。
  若两者都不做，第一个 TS 消费者必然踩到这条错误，且容易误判成“包坏了”。
- 最小修复范围：只加声明文件与 `/// <reference>`，不改运行时、不改导出名、不改 CSS。

### 6.2 移动工具条触控目标偏小（观察，不阻断）

- 实测：`.folio-docs-mobile-bar` 的两个按钮为 38×21 / 64×21，抽屉“关闭”按钮 38×21。
- 判读：21px 高度低于 44×44 的舒适触控目标；WCAG 2.2 SC 2.5.8（AA）要求 24×24，
  但存在“间距例外”——两个按钮中心相距约 292px，24px 圆不相交，因此**未必**构成 AA 违规。
- 结论：不阻断 0.1.0，属 P3 打磨项。最小建议是给按钮补
  `min-height: 24px`（或 `padding: 6px 4px`），不必改结构。
- 归口：默认 UI 打磨，非本卡范围。

### 6.3 已确认没有问题的部分

- 默认 UI 的侧栏、页内目录、分页、移动抽屉/面板在独立消费者里全部工作；
- 亮/暗两套调色板都通过 `--folio-*` 生效，正文与标题对比度远高于 AA；
- 代码块在窄屏内自带横向滚动，不会把整页撑宽；
- 默认 `@uichat-mira/folio/styles.css` 单文件足以支撑整站阅读体验，不需要 `apps/site`
  的品牌层兜底。

## 7. 局限与适用范围

1. **视觉判断不在本卡能证明的范围**：截图是真实抓取并提交的，但本 agent 不能读图。
   任何“看起来好看/不好看”的结论必须由 Mira 完成。
2. **只测 headless Chrome**：没有 Firefox/Safari，也没有真机；触屏是被 CDP 的
   `mobile: true` 视口模拟的，不是真实手指。
3. **绑定提交**：所有结论对应本分支 `471c605` 上打出的 tarball（其 `packages/` 与
   `e0475295e1e8609453273c88932955d9d8d1716d` 一致，sha256 `ebc5abe…`）。若之后合并
   FOL-013 对 heading ID/锚点规则的调整，导航与 TOC 高亮结果需要在发布候选包上重跑本
   harness 复核。
4. **`staticRoutes: false`**：本站验收的是 React 运行时；静态产物的验收由 FOL-009 负责，
   两者不互相代替。
5. **`release:check` 与 CI 不覆盖本 harness**：本卡没有把浏览器验收加进 CI（headless
   Chrome 在 CI 上成本与稳定性都不划算），它保持为本地可复现研究脚本。

## 8. 复现与证据清单

```bash
npm ci --no-audit --no-fund
npm run release:check                                    # 包层证据（本地 exit 0）
node docs/research/fol-014/run.mjs                       # 全流程：pack → install → tsc ×5 → build → Chrome
node docs/research/fol-014/run.mjs --keep                # 保留临时消费者目录用于诊断
```

| 证据 | 位置 |
| --- | --- |
| 复现脚本 | [`docs/research/fol-014/run.mjs`](fol-014/run.mjs) |
| 独立消费者 fixture | [`docs/research/fol-014/consumer/`](fol-014/consumer) |
| 原始数据（包、类型、构建、几何、点击、console） | [`docs/research/fol-014/results/acceptance.json`](fol-014/results/acceptance.json) |
| 截图（6 张） | `docs/research/fol-014/results/screenshots/` |
| 渲染 DOM（桌面、抽屉打开态） | `docs/research/fol-014/results/dom-*.html` |
| 类型缺口定位 | `packages/folio/dist/vite.d.ts`（只有字符串常量）、`apps/site/src/vite-env.d.ts`（消费者自写声明） |

`npm run release:check` 本地结果（Windows x64，node 24.9.0）：`typecheck` 通过、
`41` 个包测试全绿、`pack:verify`（10 个文件 / 104 790 字节）与 `pack:consumer`（入口、
类型、Vite 构建、内容发现、静态产物）全部通过。CI 的 ubuntu / windows 两个 job 结果记录在
PR 描述里；**CI 绿灯不能代替第 3 节的浏览器证据**。
