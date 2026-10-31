# FOL-007 · Folio 默认样式表对独立宿主的全局影响

- Issue: [#51](https://github.com/uichat-mira/folio/issues/51)
- 基线: `origin/dev` @ `de368cb`（`docs: correct npm publication and consumer migration status (FOL-006 #50)`）
- 分支: `research/fol-007-css-host-boundary`
- 浏览器: Headless Chrome 156.0.8078.79（Windows x64，900×720，DPR 1）
- 复现命令: `node docs/research/fol-007/run.mjs`
- 结论: **可以暂缓改 CSS 入口**；首发前补一条消费者契约（见第 6 节），若出现嵌入消费者则升级为「需要修」

## 1. 结论摘要

`@uichat-mira/folio/styles.css` 里只有 5 条规则真正作用于文档级元素，其余 153 条规则都带有 `.folio-*` / `[data-folio-*]` / `.markdown-mermaid*` 作用域。这 5 条规则在**整站模式（FolioApp）下是自身基线**，在**嵌入模式（FolioMarkdown）下是真实的宿主污染**。

浏览器实测确认：

- **与加载顺序无关的宿主影响有三项**（前提是宿主没有自行声明竞争属性，见 4.6）——
  1. `* { box-sizing: border-box }`：实测把一个 200px + padding + border 的盒子从 `222px` 压到 `200px`；
  2. `body { min-width: 320px }`：`0px → 320px`；
  3. `:root { font-synthesis: none; text-rendering: optimizeLegibility }`：两条都是**继承属性**，实测宿主正文 `<p>` 在**两个加载顺序下都**从 `font-synthesis: weight style small-caps` / `text-rendering: auto` 变成 `none` / `optimizelegibility`，而同一次测量里 `font-family` 仍保留宿主的 Georgia。`font-synthesis: none` 会关掉浏览器的合成粗体/斜体，`text-rendering: optimizeLegibility` 会改变字距与连字。
- **与加载顺序相关的影响有三组** —— `body` 的 margin/背景/文字色、`a` 的颜色与下划线、`button, input { font: inherit }` 的控件字体。宿主自己在同特异性下声明了这些属性时，只有 Folio 样式表**后加载**才会被覆盖。
- `:root` 上的 `font-family`/`color`/`background` 只落在 `<html>` 上，宿主在 `body` 声明过时**视觉上不产生变化**（实测 `host-folio-first` 的 body 全部保留宿主值）。这条"惰性"结论**不适用于**同为 `:root` 声明的 `font-synthesis`/`text-rendering`——它们是继承属性，会直接穿透到宿主正文。
- `--folio-*` 变量、`.markdown-mermaid*`、媒体查询、`[data-folio-theme]` 都**不会**影响宿主。

当前仓库内没有任何嵌入模式（模式 B）的真实消费者：`apps/site` 是整站模式，Pearl 与 `uichat-mira-docs` 都还没迁移。因此不存在已发生的生产故障，本报告不把实测风险描述成事故。

## 2. 方法

只为回答一个问题：**独立宿主引入 `@uichat-mira/folio/styles.css` 后，究竟有哪些自身样式发生非预期变化。**

### 2.1 只使用真实产物

| 输入 | 来源 | 校验 |
| --- | --- | --- |
| 样式表 | `npm pack` 打出的 tarball 内 `package/dist/styles.css` | 与 `packages/folio/dist/styles.css`、`packages/folio/src/styles.css` 三者 sha256 完全一致：`58d5e7094187684e633bfd3f83ba32935dd3e3a9f15511b0732804ec32493718` |
| 嵌入内容 | 同一构建的 `packages/folio/dist/index.js` 的 `renderFolioMarkdown()` | 与 `FolioMarkdown` 组件产出的 DOM 一致：`<article class="folio-markdown">` + 该函数返回的 innerHTML（组件只额外挂 ref 与 mermaid effect，不改变标记） |
| 模式 A 页面 | `apps/site` 的真实构建产物 | 官方站就是 `FolioApp` 的参考实现 |

tarball: `uichat-mira-folio-0.1.0.tgz`，sha256 `ebc5abe101ac9efc8d567ac0397c8e1a29efaba5611adecfaa456e80810ce6fa`。

没有通过阅读选择器去推断影响：所有结论都来自浏览器里的 `getComputedStyle` 与 `offsetWidth`。

### 2.2 三个对照页

同一个宿主页（[`host.html`](fol-007/host.html)），只改 Folio 样式表在文档里的位置：

| 变体 | 说明 |
| --- | --- |
| `host-before` | 只有宿主 CSS，没有 Folio 样式表（基线） |
| `host-folio-after` | Folio 样式表在宿主 CSS **之后**（应用入口里后 import 的常见顺序） |
| `host-folio-first` | Folio 样式表在宿主 CSS **之前** |

宿主页刻意覆盖研究要观察的每一类表面：`body` 的 margin/背景/文字色/字体、`a` 的颜色与下划线、`button`/`input` 的字体与字号、一个 `width:200px + padding:10px + border:1px` 的定宽盒子、宿主私有变量 `--host-ink`/`--host-accent`、以及一个使用这些变量的局部组件类 `.host-card`。

后两个变体同时通过 `<!--FOLIO_EMBED-->` 注入真实的 `.folio-markdown` 文章，用来模拟模式 B。

### 2.3 抓取方式

`run.mjs` 启动 headless Chrome，通过 DevTools Protocol（`Target.attachToTarget` + `Runtime.evaluate`）读取 `getComputedStyle`，并用 `Page.captureScreenshot` 抓图。不使用任何第三方浏览器库。

原始数据：[`results/measurements.json`](fol-007/results/measurements.json)。截图：[`results/screenshots/`](fol-007/results/screenshots)。

> 局限（如实说明）：本 agent 无法渲染图片输入，截图由 harness 自动抓取、随本 PR 提交给人类复核；下文所有视觉判断都以 computed styles 的数值为准，没有一条是"看图得出"。

## 3. 样式表里真正的全局规则

`packages/folio/src/styles.css` 共 1057 行、158 条规则。其中不带 Folio 命名空间的只有：

| 行 | 规则 | 影响面 |
| --- | --- | --- |
| 1 | `:root { … --folio-*; font-family; color; background; font-synthesis; text-rendering }` | `<html>`，以及全部 `--folio-*` 变量的定义点 |
| 67 | `* { box-sizing: border-box; }` | 文档内**所有元素** |
| 68 | `body { margin: 0; min-width: 320px; background: var(--folio-canvas); color: var(--folio-ink); }` | `<body>` |
| 69 | `a { color: inherit; text-decoration: none; }` | 文档内**所有链接** |
| 70 | `button, input { font: inherit; }` | 文档内**所有按钮与输入框** |

其余规则的分布：`.folio-*`（壳层与组件）、`.folio-markdown*` / `.md-*`（内容排版）、`.markdown-mermaid*`（类作用域）、`[data-folio-theme="dark"]`（挂在 `<html>` 的属性选择器，只在被显式设置时生效）、2 个 `@media` 块（内部仍是 `.folio-*`）。

## 4. 观察结果

### 4.1 模式 B：Folio 样式表在宿主 CSS 之后

| 探测点 | 宿主声明 | Folio 之后 | 变化 | 来源规则 |
| --- | --- | --- | --- | --- |
| `html` background | 未声明 | `rgb(250,249,245)` | 新增 | `:root` (L1) |
| `html` color | 未声明 | `rgb(20,20,19)` | 新增 | `:root` (L1) |
| `html` font-family | 未声明 | `"Public Sans", -apple-system, …` | 新增 | `:root` (L1) |
| `p` font-synthesis | 继承 `weight style small-caps` | `none` | **被替换** | `:root` (L1)，继承 |
| `p` text-rendering | `auto` | `optimizelegibility` | **被替换** | `:root` (L1)，继承 |
| `body` margin-top | `32px` | `0px` | **丢失** | `body` (68) |
| `body` min-width | `0px` | `320px` | 新增 | `body` (68) |
| `body` background | `rgb(240,244,248)` | `rgb(250,249,245)` | **被替换** | `body` (68) |
| `body` color | `rgb(16,42,67)` | `rgb(20,20,19)` | **被替换** | `body` (68) |
| `a` color | `rgb(180,83,9)` | `rgb(20,20,19)` | **被替换** | `a` (69) |
| `a` text-decoration | `underline` | `none` | **被移除** | `a` (69) |
| `button` font-family | `"Courier New", monospace` | `Georgia, "Times New Roman", serif` | **被替换** | `button, input` (70) |
| `button` font-size | `17px` | `18px` | **被替换** | `button, input` (70) |
| `input` 同上 | `"Courier New"` / `17px` | `Georgia` / `18px` | **被替换** | 同上 |
| `div` box-sizing | `content-box` | `border-box` | **被替换** | `*` (67) |
| 该盒子 `offsetWidth` | `222px` | `200px` | **布局尺寸变化** | `*` (67) |

`button`/`input` 得到 `Georgia` 而不是 `Public Sans`，是因为 `font: inherit` 的简写只继承**父级当时计算的**字体，而宿主的 `body` 规则（Georgia）在同特异性下仍然生效。这也说明 `font: inherit` 是一个整体简写：它同时抹掉了宿主对 `font-size` 的声明（17px → 18px）。

### 4.2 模式 B：Folio 样式表在宿主 CSS 之前

| 探测点 | host-before | host-folio-first | 是否变化 |
| --- | --- | --- | --- |
| `body` margin-top | `32px` | `32px` | 否（宿主后加载胜出） |
| `body` background | `rgb(240,244,248)` | `rgb(240,244,248)` | 否 |
| `body` color | `rgb(16,42,67)` | `rgb(16,42,67)` | 否 |
| `a` color / decoration | `rgb(180,83,9)` / `underline` | `rgb(180,83,9)` / `underline` | 否 |
| `button`,`input` font | `"Courier New"` / `17px` | `"Courier New"` / `17px` | 否 |
| `p` font-synthesis | `weight style small-caps` | `none` | **是**（`:root` 继承属性，宿主未声明） |
| `p` text-rendering | `auto` | `optimizelegibility` | **是**（同上） |
| `body` min-width | `0px` | `320px` | **是**（宿主没有声明，无竞争） |
| `div` box-sizing | `content-box` | `border-box` | **是**（`*` 特异性最低但对"未声明"仍然生效） |
| 该盒子 `offsetWidth` | `222px` | `200px` | **是** |

这张表是本次研究最关键的一张：**把 Folio 样式表放到宿主 CSS 之前，可以消掉 5 条元素选择器规则的影响，但消不掉 `*`、`body{min-width}` 和 `:root` 的两条继承属性。**

原因是 CSS 级联顺序而非特异性：`body`、`a`、`button,input` 在宿主与 Folio 之间特异性相同（都是元素选择器），后加载者胜出；而 `*` 的特异性为 0，宿主只要**没有**给该元素声明 `box-sizing`，`*` 就会生效——绝大多数宿主不会给每个元素都声明 `box-sizing`，只会用 `*` 或不做。`font-synthesis`/`text-rendering` 由 `:root` 声明在 `<html>` 上，作为继承属性落到每一个未自行声明的宿主元素，与样式表顺序无关。

### 4.3 模式 A：官方 FolioApp 站点（真实构建产物）

| 探测点 | 实测值 | 说明 |
| --- | --- | --- |
| `body` margin-top | `0px` | 来自 Folio `body`（`site.css` 未声明 margin） |
| `body` background | `rgb(250,249,245)` | `site.css` 写 `var(--site-canvas)` → `var(--folio-canvas)` |
| `body` color | `rgb(20,20,19)` | 同上，经 `--folio-ink` |
| `body` font-family | `"Public Sans", …` | `site.css` 经 `--site-sans` → `--folio-font-sans` |
| 首个链接 color / decoration | `rgb(20,20,19)` / `none` | **完全来自 Folio 的 `a` 规则** |
| `button` font | `"Public Sans", …` / `16px` | **完全来自 Folio 的 `button,input` 规则** |
| `.folio-shell` box-sizing | `border-box` | 来自 `*` |
| `main.showcase-home` box-sizing | `border-box` | 来自 `*` |
| `--folio-canvas` / `--folio-font-sans` | 已解析 | 来自 `:root` |

判定依据：`apps/site/src/*.css` 里**没有**任何 `a`、`button`、`input` 规则，全局 `box-sizing` 只有一条 `.claude-visual *{…}`（子作用域），而 `site.css` 的 `:root` 直接把 `--site-*` 全部别名到 `--folio-*`。也就是说，整站模式**依赖**这 5 条全局规则，删掉会直接掉版。

### 4.4 没有受到影响的部分

| 项目 | 实测 |
| --- | --- |
| 宿主私有变量 `--host-ink` / `--host-accent` | 三个变体都保持 `#102a43` / `#b45309`，未被覆盖 |
| 宿主局部组件 `.host-card` | 颜色/背景/边框在三个变体中完全一致 |
| `.markdown-mermaid*` | 类作用域，未命中宿主元素 |
| 媒体查询 | 内部选择器均为 `.folio-*` |
| `[data-folio-theme="dark"]` | 属性选择器挂在 `<html>`，未设置时不生效 |

### 4.5 嵌入内容的自身表现（不是宿主污染，但属于契约）

注入 `.folio-markdown` 之后：

| 探测点 | 实测 | 含义 |
| --- | --- | --- |
| 文章 `color` | `rgb(61,61,58)` | `.folio-markdown { color: var(--folio-body) }`，用的是 Folio 调色板而非宿主 `--host-ink` |
| 文章 `font-family` | `Georgia, …` | 继承宿主（`.folio-markdown` 不声明字体） |
| 标题 `font-family` | `"Cormorant Garamond", …` | 标题字体来自 `--folio-font-display` |
| 正文链接 `color` / decoration | `rgb(169,88,62)` / `underline` | `.folio-markdown a` 的强调色 |
| 标题锚点 `.md-anchor` | `rgba(0,0,0,0)` | `color: transparent !important`，设计如此 |

即：嵌入模式默认是"Folio 的配色 + 宿主的字体骨架"，宿主若想完全品牌化，必须覆盖 `--folio-*`，而不是继承宿主自己的变量。这一点目前没有任何文档说明。

### 4.6 结论的适用条件

"与加载顺序无关"有两个前提，不能外推成"对任意宿主都必然发生"：

1. **宿主没有声明竞争属性**。宿主若自己写 `* { box-sizing: content-box }`、`body { min-width: 0 }`，或 `:root { font-synthesis: auto; text-rendering: auto }`，对应的三项影响都会消失（这些规则需在 Folio 之后加载或使用更高特异性）。
2. **`:root` 的视觉性属性是否显露，取决于宿主有没有在 `body` 上声明同名属性**。本实验的宿主声明了 `body` 的字体/颜色/背景，所以那三项只落在 `<html>` 上、视觉惰性；而继承属性（`font-synthesis`/`text-rendering`）不受此保护，会穿透到正文。

因此本报告的措辞是"在本实验宿主上必然发生"，而非"对任何宿主都必然发生"。

## 5. 判断

### 5.1 已证实的宿主污染（模式 B）

| 影响 | 是否跨加载顺序 | 严重度 | 依据 |
| --- | --- | --- | --- |
| `* { box-sizing: border-box }` 改变宿主既定布局的盒子尺寸 | **是** | 高：静默、全局、改的是布局而非配色 | 4.1 / 4.2 的 `offsetWidth 222 → 200` |
| `body { min-width: 320px }` | **是** | 低：只影响极窄容器或绝对定位页面 | 4.1 / 4.2 |
| `:root { font-synthesis: none }` 继承到宿主正文 | **是** | 中：宿主字体缺少粗体/斜体字面时，原本由浏览器合成的粗/斜体会消失，文字层级会塌 | 4.1 / 4.2 的 `p` 采样 |
| `:root { text-rendering: optimizeLegibility }` 继承到宿主正文 | **是** | 低到中：改变字距与连字，非拉丁字体、等宽排版可能出现细节差异 | 同上 |
| `body` margin/背景/文字色被替换 | 否（宿主后加载可胜出） | 中：默认 import 顺序下整页换肤 | 4.1 |
| 全站链接变 `color: inherit` + 无下划线 | 否 | 中：可读性/品牌一致性 | 4.1 |
| `button`/`input` 字体与字号被 `font: inherit` 重置 | 否 | 中：表单控件视觉不一致 | 4.1 |

### 5.2 合理的全站默认（模式 A）

`FolioApp` 拥有整个文档时，上述 5 条规则就是站点基线：`apps/site` 的 `site.css` 不重复声明它们，并把自己的 token 全部别名到 `--folio-*`。这部分**不应该改**，也不应该用"作用域化"一刀切处理。

### 5.3 需要修复的局部组件副作用（模式 B 的设计缺口）

嵌入 `FolioMarkdown` 时，宿主文档并不归 Folio 所有，`*`/`body`/`:root` 三条规则本不应生效。这是真实的设计缺口，不是理论风险——但当前**没有消费者**进入这个场景。

### 5.4 暂时不需要处理

- `--folio-*` 变量（命名空间已隔离，不覆盖宿主变量）
- `.markdown-mermaid*`、`@media`、`[data-folio-theme]`
- `:root` 上的 `font-family`/`color`/`background`：宿主在 `body` 有声明时视觉无变化；只有在完全没有 body 规则的页面上才显露。**注意 `font-synthesis`/`text-rendering` 不属于此列**——它们是继承属性，见 5.1
- 嵌入内容的 Folio 配色（属于预期行为，缺的是文档，不是代码）

## 6. 两个最小方案

### 方案 A：消费者契约（0 行 CSS，推荐先做）

在 `packages/folio/README.md` 的 Real package entrypoints 一节增加一段「Style contract」：

1. `@uichat-mira/folio/styles.css` 是**整站入口**，隐含"本文档归 Folio 所有"。
2. 嵌入到已有品牌页面时，宿主必须知道有**三项**影响与加载顺序无关：`* { box-sizing }`、`body { min-width: 320px }`、`:root` 的 `font-synthesis: none` + `text-rendering: optimizeLegibility`（两条继承属性会落到宿主正文）。其余元素选择器影响可通过在 Folio 之后加载宿主 CSS 消除；上述三项则必须由宿主显式声明竞争属性才能覆盖。
3. 品牌化方式是覆盖 `--folio-*`，组件不会自动继承宿主变量。

- 兼容影响：无
- 需要验证：无代码验证；文档表述以本报告实测为准
- 是否阻断 0.1.0：不阻断

### 方案 B：入口拆分（真正消除污染，但可以晚做）

新增 `@uichat-mira/folio/styles/embed.css`，只包含 `.folio-markdown*`、`.md-anchor`、`.markdown-mermaid*` 等组件级规则；`styles.css` 保持现状（整站入口），可选地用 `@import` 复用 embed 部分。

- 兼容影响：纯新增子路径，不改现有入口与公开 API；需要 `package.json` 的 `files`/`exports` 增加一项，tarball 增大几 KB
- 需要验证：
  - 静态 HTML：`pack` 后 `dist` 内新文件存在、`npm pack --dry-run` 审计通过、静态构建产物（`static.ts` 输出的 `.folio-markdown` 片段）在只引 `embed.css` 时排版完整
  - React：`FolioMarkdown` 单独引入 `embed.css` 时标题/链接/代码块/表格/引用块全部正常；`FolioApp` 仍引 `styles.css`，`apps/site` 构建与 `pack:consumer` 不回归
  - Windows 包检查（`windows-package-check`）与 `release:check` 全绿
- 是否阻断 0.1.0：不阻断；但如果 0.1.0 的对外文案声称"可直接嵌入任意品牌页面"，则必须先落方案 A（或直接用 B）

## 7. 后续施工可以切成的单一目标

如果将来要落地方案 B，建议切成两个互不依赖、各自可回滚的提交：

1. `feat(package): add scoped embed stylesheet entry` —— 只新增 `styles/embed.css` + `exports`/`files` + 一个消费者验证；回滚 = 删除文件与 exports 项，`styles.css` 不动。
2. `docs: document the Folio style contract` —— 纯文档；回滚 = 还原 markdown。

两者都不触碰默认入口的现有规则，因此对整站模式零影响。

## 8. 结论

**可以暂缓**修改 CSS 入口。

- 现状对唯一真实消费者（`apps/site`，模式 A）是正确的，且这些全局规则是它赖以成立的基础。
- 模式 B 的污染是**已实测**的，但**无消费者**，不构成 0.1.0 的阻断项。
- 首发前应补的最小动作是**方案 A（文档契约）**，因为 `FolioMarkdown` 已是公开导出，缺的是把边界讲清楚。
- 触发升级为「需要修」的条件只有一个：出现第一个以嵌入模式接入的真实消费者，或对外宣传"可直接嵌入已有品牌页面"。

## 9. 证据清单

| 证据 | 位置 |
| --- | --- |
| 复现脚本 | [`docs/research/fol-007/run.mjs`](fol-007/run.mjs) |
| 宿主对照页 | [`docs/research/fol-007/host.html`](fol-007/host.html) |
| 原始测量数据（含基线 SHA、tarball/CSS sha256、浏览器版本） | [`docs/research/fol-007/results/measurements.json`](fol-007/results/measurements.json) |
| 截图 | `docs/research/fol-007/results/screenshots/{host-before,host-folio-after,host-folio-first,folio-site}.png` |
| 全局规则定位 | `packages/folio/src/styles.css` L1、L67–L70 |
| 整站依赖证据 | `apps/site/src/main.tsx`（`import "@uichat-mira/folio/styles.css"`）、`apps/site/src/site.css` L1–L26 |

复现：

```bash
npm ci --no-audit --no-fund
node docs/research/fol-007/run.mjs
# 生成 docs/research/fol-007/results/ 下的 measurements.json 与截图，
# 并在 stdout 打印 after/first 相对 before 的逐项差异表
```

harness 只读仓库，不修改任何生产文件；它会执行 `npm run build -w @uichat-mira/folio`、`npm pack`、`npm run build -w @uichat-mira/folio-site`，产物落在临时目录。
