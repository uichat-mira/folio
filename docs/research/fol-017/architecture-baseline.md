# FOL-017 · Folio 架构与公开契约基线

- Issue: [#107](https://github.com/uichat-mira/folio/issues/107)
- 基线: `origin/dev` @ `26d1c2a6834485b53857f414d951e4c81bd53409`
  （`Merge pull request #104 from uichat-mira/feat/folio-011-ledger-hygiene`）
- 分支: `feat/fol-017-architecture-baseline`
- 记录日期: 2026-11-01
- 环境: Windows x64、Node v24.9.0、npm 11.6.0
- 性质: **当前版本的基线快照，不是设计批准、施工授权或发布批准**。文中「建议/候选」字样均为设计输入，不代表已实现。

## 0. 结论先行

1. 当前 `packages/folio/src` 是 16 个 `.ts/.tsx` 实现文件 + 1 个环境声明 + 1 个样式表的**平铺目录**；Core / UI / Build 的职责在代码里已经基本分离，但目录、类型文件与入口导出把它们混在一起。
2. 公开 npm 契约是稳定的三入口：`@uichat-mira/folio`（19 个运行时导出 + 17 个类型）、`@uichat-mira/folio/vite`（7 个运行时导出 + 6 个类型）、`@uichat-mira/folio/styles.css`（单文件产物）。
3. `styles.css` 是**整站样式表**，只有 5 条非命名空间规则；`apps/site`（模式 A）依赖它们，嵌入模式（模式 B）的宿主影响已有 FOL-007 实测，但当前没有嵌入消费者。
4. **B1 可以开始**：它是纯类型拆分，不改运行时、不改导出名、不改 CSS；前置条件与验证路径见 §5.1。
5. **B2（PR #54 v0.3 拆为 B2a/B2b/B2c）应在 B1 之后**，且 `content.ts + heading-ids.ts + docs-structure.ts` 必须作为一个原子单元移动。
6. **C6a 必须先于任何组件 CSS 拆分**，且与 B1 无依赖；它依赖的是维护者接受 §4 的样式所有权边界，而不是代码拆分。

## 1. 基线快照与本次验证

### 1.1 基线与环境

| 项 | 值 |
| --- | --- |
| 仓库 | `uichat-mira/folio` |
| 基线分支 / SHA | `dev` / `26d1c2a6834485b53857f414d951e4c81bd53409` |
| 包版本 | `@uichat-mira/folio@0.1.1`（`packages/folio/package.json`） |
| 工作区 | `packages/*` + `apps/*`（npm workspaces） |
| 本机 | Windows x64、Node v24.9.0、npm 11.6.0 |

### 1.2 实际执行的验证（真实结果）

在干净工作树上执行 `npm run release:check`。本机存在两个互相冲突的临时目录限制，**无法用一次调用同时满足全部阶段**，因此下表按实际执行条件分项记录，不合并成一次「通过」：

| 阶段 | 结果 | 实际执行条件 |
| --- | --- | --- |
| `tsc --noEmit`（包） | PASS | `TEMP`/`TMP` 指向工作区内临时目录 |
| `tsup` 构建 | PASS | 同上；产物为 `dist/index.js`、`dist/vite.js`、`chunk-*.js`、`index.d.ts`、`vite.d.ts`、`types-*.d.ts` |
| 包测试 `node --test test/*.test.mjs` | PASS | 同上；**42 tests / 42 pass / 0 fail** |
| `apps/site` typecheck + `vite build` | PASS（2245 modules） | 同上；默认 `%LOCALAPPDATA%\Temp` 会因 esbuild 清理临时文件 `Access is denied` 中断 |
| `pack:verify` | PASS | 独立执行；**11 files / 108318 bytes unpacked** |
| `pack:consumer`（真实 tarball 独立消费） | PASS | `TEMP`/`TMP` 指向仓库外 `D:\folio-tmp`；tarball sha256 `ca0d7b8851fe73f9e0209096d3e39752d15fd3fb3aa1663ca3e60990f07e37ed` |

**未完成的单次调用**：`npm run release:check` 在 `TEMP` 位于工作区内时通过 `validate`，但 `pack:consumer` 被 `verify-entrypoints.mjs` 的「消费者不得位于仓库工作区」断言拒绝；`TEMP` 位于仓库外时，`apps/site` 的 esbuild 临时文件清理被拒绝。两者都是本机环境限制，不是本卡改动导致。**完整门禁以本 PR 的 CI（ubuntu + windows）为准；本机不声称单次 `release:check` 通过。**

## 2. 模块所有权与依赖方向（当前事实）

### 2.1 文件清单、行数与归属

「归属」是对**当前代码职责**的判定；「目标」是 PR #54 v0.3 的候选设计，二者不混同。

| 文件 | 行数 | 内部依赖 | 外部依赖 | 当前职责 | 归属 |
| --- | ---: | --- | --- | --- | --- |
| `heading-ids.ts` | 30 | — | — | 标题 ID 分配器（显式 ID 预留、重复后缀） | Core |
| `content.ts` | 257 | `types`, `heading-ids` | `yaml`, `marked` | Frontmatter、`FolioDoc` 解析、slug、路由、标题提取 | Core |
| `docs-structure.ts` | 127 | `content`, `types` | — | collection / section / neighbors 语义 | Core |
| `search.ts` | 41 | `types` | — | 纯搜索排序 | Core |
| `config.ts` | 17 | `types` | — | `defineFolioConfig`、base path 归一化 | Core |
| `markdown.ts` | 192 | `content`, `heading-ids` | `marked`, `highlight.js` | Markdown → HTML 字符串（Callout、代码、锚点） | Core |
| `types.ts` | 69 | — | `react`（仅 `ReactNode` 类型） | **Core 数据模型与 UI Props 混在同一文件** | 混合（B1 目标） |
| `icons.tsx` | 51 | — | —（JSX） | 内联 SVG 图标 | UI |
| `share.tsx` | 68 | — | `react` | 分享按钮 + Web Share / 剪贴板 | UI |
| `header.tsx` | 179 | `share`, `icons`, `types` | `react`, `react-router-dom` | Header、移动面板 | UI |
| `docs-shell.tsx` | 278 | `markdown-react`, `share`, `docs-structure`, `types` | `react`, `react-router-dom` | 文档侧栏 / TOC / 分页 / 移动抽屉 | UI |
| `markdown-react.tsx` | 132 | `markdown` | `react`, 动态 `mermaid` | Markdown React 容器 + Mermaid 渲染 | UI |
| `app.tsx` | 340 | `config`, `header`, `docs-shell`, `icons`, `share`, `markdown-react`, `search`, `types` | `react`, `react-router-dom` | `FolioApp`：Router、主题状态、Home/404/搜索浮层 | UI |
| `vite.ts` | 148 | `content`, `static`, `types` | `vite`, `node:fs`, `node:path` | Vite 插件、虚拟模块、静态写入入口 | Build |
| `static.ts` | 573 | `docs-structure`, `markdown`, `types` | `node:fs`, `node:path` | 静态路由安全/冲突、文件写入、静态文档壳、SEO、sitemap/robots | Build |
| `virtual.d.ts` | 9 | — | — | `virtual:folio/content` 环境声明 | 契约 |
| `styles.css` | 1065 | — | — | 默认整站样式与 `--folio-*` Token | 共享样式产物 |

### 2.2 实际依赖方向

```text
Core：heading-ids → content → docs-structure；content + heading-ids → markdown；search / config 仅依赖 types
UI：icons / share / header / docs-shell / markdown-react / app → Core
Build：vite → static；static → docs-structure / markdown → Core
apps/site → 公开入口（@uichat-mira/folio、/vite、/styles.css）+ virtual:folio/content
```

- 当前**没有** Core → UI/Build、UI → Build、Build → UI 的源码导入。UI 与 Build 只通过共享数据模块 `docs-structure.ts`、共享类名和同一份样式表关联。
- `types.ts` 是唯一被 Core 与 UI 同时导入的类型文件，也是 B1 的拆分点。
- `apps/site` 不导入包内 `src/`；它通过 workspace 依赖消费公开入口，并自行负责品牌样式、首页和自定义静态 routes。

### 2.3 已存在的跨层依赖（事实，不是推测）

1. **`types.ts` 同时承载 Core 与 UI 类型。** 它 `import type { ReactNode } from "react"`，并定义 `FolioSlots`、`FolioAppProps`、`FolioUiOptions`、`FolioThemePreference`；同时定义 `FolioDoc`、`FolioHeading`、`FolioEntryType`、`FolioNavigationItem`、`FolioConfig`。除 `heading-ids.ts` 与 `markdown.ts` 外，其余 Core/Build 模块（`content`、`docs-structure`、`search`、`config`、`static`、`vite`）都从 `./types` 取类型；只要该文件引用 React，「Core 不依赖 React」在类型层就不成立。
2. **根入口同时导出 Core 与 UI。** `src/index.ts` 把 19 个运行时值与 17 个类型从同一入口导出；`dist/index.js` 顶层 `import ... from "react"` 与 `react-router-dom`。即使消费者只用 `renderFolioMarkdown`，也必须满足 React / React DOM / React Router DOM 的 peer 依赖。
3. **Build 与 UI 共享类名，但不共享渲染器。** `static.ts` 生成 `.folio-docnav` / `.folio-toc` / `.folio-page-nav` / `.folio-markdown` 等结构，`docs-shell.tsx` 生成同类结构；两者只共享 `docs-structure.ts` 的数据语义。类名一致性目前由样式表和测试间接保证，没有显式合同测试。
4. **`static.ts` 混合四类职责**：路由安全与冲突检测（`routeOutputPath`、`assertRealTargetInsideOutDir`）、文件写入（`writeFileSync`）、静态 HTML 呈现（`renderStaticDocShell` 等）、SEO/meta/sitemap/robots。
5. **`app.tsx` 拥有宿主副作用**：创建 `BrowserRouter`，写入 `document.documentElement.dataset.folioTheme`、`style.colorScheme` 与 `localStorage['folio-theme']`；`markdown-react.tsx` 又反向读取 `document.documentElement.dataset.folioTheme` 决定 Mermaid 主题。
6. **Router 是 UI 组件的隐式上下文。** `header.tsx` 使用 `useLocation`/`Link`，`docs-shell.tsx` 使用 `Link`，因此 `FolioHeader` / `FolioDocsShell` 不能脱离 Router 单独使用。
7. **`/vite` 入口是 Node-only。** `vite.js` 顶层 `import ... from "path"`，根入口不导入它；两个入口的运行时边界是分开的。
8. **`apps/site` 覆盖包内类名。** `apps/site/src/site.css` 有 16 处选择器直接命中 `.folio-header`、`.folio-brand`、`.folio-doc-page`、`.folio-markdown*`、`.folio-footer` 等包内 DOM 类；`legacy-claude-visual.css` 还有 1 处 `.folio-markdown .claude-visual h2`。这些类名目前不是公开 API，但官网实际依赖它们。

### 2.4 `apps/site` 的实际职责

| 项 | 事实 |
| --- | --- |
| 依赖 | `@uichat-mira/folio: 0.1.1`（workspace）、React 19 |
| 入口 | `src/main.tsx` 导入根入口、`styles.css`、`virtual:folio/content`，再用 `site.css` / `showcase.css` / `legacy-claude-visual.css` 做站点品牌 |
| 静态 | `vite.config.ts` 通过 `/vite` 的 `folio()` + 自定义 `routes` 覆盖所有静态 body；因此无 JS 时只有正文，没有侧栏/TOC/分页（FOL-008） |
| 边界 | 官方站是消费者/示例，不是独立 tarball 证据（`.ai/review-profile.md`） |
| 覆盖 | `site.css` 直接覆盖 16 处包内 `.folio-*` 选择器（见 §2.3 第 8 条） |

### 2.5 建议与事实的区分

- **事实**：上面的平铺目录、导入图、入口导出、类名共享。
- **建议（PR #54 v0.3，未合并、未授权）**：`core/`、`ui/`、`build/` 目标目录，`/core`、`/ui` 候选子入口，组件 CSS 拆分顺序。
- 本基线**不**把建议目录写成现状，也**不**据此认为任何模块已经拆分。

## 3. 公开 npm 契约（当前冻结）

### 3.1 `packages/folio/package.json`

| 字段 | 当前值 |
| --- | --- |
| `name` / `version` | `@uichat-mira/folio` / `0.1.1` |
| `type` | `module`（ESM） |
| `main` / `types` | `./dist/index.js` / `./dist/index.d.ts` |
| `exports` | `.`、`./vite`（均为 `types` + `import` + `default`）、`./styles.css` |
| `sideEffects` | `["./dist/styles.css"]` |
| `files` | `dist`、`README.md`、`LICENSE` |
| `dependencies` | `marked ^15.0.12`、`yaml ^2.8.1`、`highlight.js ^11.11.1`、`mermaid ^11.16.0` |
| `peerDependencies` | `react ^19`、`react-dom ^19`、`react-router-dom ^7`、`vite ^7` |
| `engines.node` | `>=20` |
| `publishConfig` | `access: public`、`registry: https://registry.npmjs.org/` |
| 构建 | `tsup src/index.ts src/vite.ts --format esm --dts --clean && node scripts/copy-styles.mjs` |
| `prepack` | `npm run build` |
| 包检查 | `pack:verify`、`pack:consumer`、`registry:consumer` |

### 3.2 根入口 `@uichat-mira/folio`（`src/index.ts`）

- 运行时导出 **19 个**（构建后 `Object.keys(dist/index.js)` 实测）：
  `FolioApp`、`FolioDocsShell`、`FolioHeader`、`FolioMarkdown`、`FolioShareButton`、`buildFolioDocStructure`、`compareFolioDocs`、`defineFolioConfig`、`extractHeadings`、`findFolioDocCollection`、`getFolioDocNeighbors`、`normalizeBasePath`、`parseFolioDoc`、`parseFrontmatter`、`renderFolioMarkdown`、`resolveGithubPagesBase`、`searchFolioDocs`、`slugify`、`sourcePathToRoute`。
- 类型导出 **17 个**：`FolioAppProps`、`FolioConfig`、`FolioDoc`、`FolioDocCollection`、`FolioDocSection`、`FolioDocsShellProps`、`FolioDocStructure`、`FolioEntryType`、`FolioHeaderProps`、`FolioHeading`、`FolioMarkdownProps`、`FolioMarkdownRenderOptions`、`FolioNavigationItem`、`FolioShareButtonProps`、`FolioSlots`、`FolioThemePreference`、`FolioUiOptions`。
- 顶层外部依赖：`react`、`react-router-dom`（peer）。

### 3.3 插件入口 `@uichat-mira/folio/vite`（`src/vite.ts`）

- 运行时导出 **7 个**：`folio`、`folioVirtualModule`、`folioAbsoluteAssetUrl`、`folioAbsoluteRouteUrl`、`folioEscapeHtml`、`renderFolioStaticHtml`、`writeFolioStaticSite`。
- 类型导出 **6 个**：`FolioPluginOptions`、`FolioContentManifest`、`FolioStaticBuildContext`、`FolioStaticBuildOptions`、`FolioStaticImageMetadata`、`FolioStaticRoute`。
- 顶层外部依赖：`node:path`（`vite` 为 peer 类型）。

### 3.4 虚拟模块 `virtual:folio/content`

- 插件 ID 常量：`VIRTUAL_ID = "virtual:folio/content"`，解析为 `\0virtual:folio/content`。
- 生成的模块形状（`vite.ts` `load`）：
  ```ts
  const docs = [/* FolioDoc[] */];
  export const roots = [/* string[] */];
  export default docs;
  ```
- 环境声明：`src/virtual.d.ts` 声明 `default: FolioDoc[]` 与 `roots: string[]`；`scripts/copy-styles.mjs` 把它复制为 `dist/virtual.d.ts`，并在 `dist/index.d.ts`、`dist/vite.d.ts` 首行插入 `/// <reference path="./virtual.d.ts" />`。
- `pack:verify` 会断言：两个 `.d.ts` 都以该 reference 开头，且 `dist/virtual.d.ts` 含 `declare module "virtual:folio/content"`。

### 3.5 CSS 产物

- `src/styles.css` 被 `scripts/copy-styles.mjs` **原样复制**为 `dist/styles.css`（无 PostCSS、无压缩、无 `@import` 处理）。
- 当前 `dist/styles.css` 为 23,702 字节；导出子路径固定为 `./styles.css`，并被 `sideEffects` 标记。
- 消费者用法固定为 `import "@uichat-mira/folio/styles.css";`（`apps/site/src/main.tsx` 即此用法）。

### 3.6 发布方式（当前事实）

- npm 发布由 GitHub Release 触发：`publish.yml` 监听 `release: published`。
- 门禁：`release:check` → tag 必须等于 `folio-v<version>` → tag commit 必须是 `origin/prod` 祖先 → 已存在版本跳过 → `npm publish --access public`（npm 11 + OIDC Trusted Publishing）→ 回读 Registry 并跑 `registry:consumer`。
- 分支模型：`feat/* -> dev -> test -> prod`；`main` 仅历史兼容。
- `0.1.1` 已发布这一状态来自 README / `docs/consumer-contract.md` / FOL-016；本卡**没有**重新查询 npm Registry（见 §6）。

### 3.7 内部移动文件时必须保留的 T2/T3 检查

这里的 T2/T3 指 `verify-tarball-consumer.mjs` 注释中的契约层：T2 = 真实 tarball 的入口/类型契约，T3 = 真实 Vite/静态构建运行。

1. **构建入口不变**：`src/index.ts`、`src/vite.ts` 是 tsup 输入；若移动，必须同步改 `build` 脚本与 `exports`，且不能出现两个入口互相 import。
2. **导出名与类型名不变**：根 19 + 17、`/vite` 7 + 6（见 §3.2/3.3），只允许追加。
3. **虚拟模块不变**：ID、`default`/`roots` 形状、`dist/virtual.d.ts` 的 reference 链。
4. **CSS 路径不变**：`dist/styles.css` 仍是唯一聚合入口；移动源码时同步改 `copy-styles.mjs` 的源路径。
5. **包清单不变**：`files: ["dist", ...]`；不得打包 `src/` 或 `test/`（`verify-package.mjs` 会断言）。
6. **类型解析不变**：`pack:consumer` 覆盖 NodeNext（`skipLibCheck: false`）、Bundler 模式、以及 virtual-only + `compilerOptions.types` 三条路径。
7. **运行时不回归**：`pack:consumer` 真实安装 tarball，验证 Vite 构建、内容发现（正/负对照）、静态产物（index/docs/404/sitemap/robots、base 前缀、`staticRoutes: false` 反证）。
8. **Windows 包检查保持有效**：CI `windows-package-check` 跑 `pack:verify` + `pack:consumer`，不能因拆分弱化。
9. **测试入口不变**：包测试全部从 `../dist/index.js` / `../dist/vite.js` 导入，因此工作区 `npm test` 会先构建；拆分后不要改成直接 import `src/`，否则会绕过真实产物。

## 4. CSS 所有权、主题 Token 与宿主影响

### 4.1 非命名空间规则（当前行号）

| 行 | 规则 | 影响 |
| --- | --- | --- |
| L1–L44 | `:root`（37 个 `--folio-*` Token + `font-family`/`color`/`background`/`font-synthesis: none`/`text-rendering: optimizeLegibility`） | `<html>`；两条继承属性穿透全部后代 |
| L46–L65 | `[data-folio-theme="dark"]`（18 个 Token 覆盖） | 仅在 `<html>` 被显式设置时生效 |
| L67 | `* { box-sizing: border-box; }` | 文档内所有元素 |
| L68 | `body { margin: 0; min-width: 320px; background; color }` | `<body>` |
| L69 | `a { color: inherit; text-decoration: none; }` | 文档内所有链接 |
| L70 | `button, input { font: inherit; }` | 文档内所有按钮/输入框 |

其余规则全部限定在 `.folio-*`、`.folio-markdown*`、`.md-*`、`.markdown-mermaid*`、`[data-folio-theme]` 或 `@media` 内部。当前文件 1065 行；FOL-007 在 `de368cb` 记录的是 1057 行 / 158 条规则，但 5 条全局规则的位置与内容未变（本次按选择器逐条核对，未重新跑浏览器测量）。

### 4.2 组件与静态类的样式归属

| 选择器族 | 主要产出方 | 说明 |
| --- | --- | --- |
| `.folio-shell`、`.folio-content`、`.folio-footer` | `app.tsx` | 应用骨架 |
| `.folio-header*`、`.folio-brand*`、`.folio-desktop-nav`、`.folio-mobile-panel`、`.folio-icon-button`、`.folio-search-trigger`、`.folio-theme-toggle` | `header.tsx` | 头部与移动面板 |
| `.folio-docs-runtime`、`.folio-docs-shell`、`.folio-docnav*`、`.folio-doc-main`、`.folio-toc*`、`.folio-page-nav*`、`.folio-docs-mobile-bar`、`.folio-docs-overlay`、`.folio-docs-drawer*`、`.folio-mobile-toc*` | `docs-shell.tsx` **与** `static.ts` | 双渲染共享类名 |
| `.folio-markdown*`、`.md-*`、`.markdown-mermaid*` | `markdown.ts`（HTML 字符串） | React 与静态同源 |
| `.folio-search-*` | `app.tsx`（`SearchOverlay`） | 搜索浮层 |
| `.folio-share-button*` | `share.tsx` | 分享按钮 |
| `.folio-home`、`.folio-hero`、`.folio-card*`、`.folio-not-found`、`.folio-button*` | `app.tsx` | 首页 / 404 |
| `.folio-prerender*`、`.folio-static-doc-menu*`、`.folio-docs-runtime--static`、`.folio-docs-mobile-bar--static` | `static.ts` / `defaultRoutes` | **仅静态产物** |
| `:root`、`[data-folio-theme]`、`*`、`body`、`a`、`button,input` | 全局 | 整站基线 |

关键事实：`styles.css` 同时服务 React 与静态 HTML，**不是纯 UI 资产**。任何组件 CSS 拆分都必须同时满足两条渲染路径，否则静态页会掉样式。

### 4.3 宿主影响（引用 FOL-007，不重新测量）

FOL-007 在 `de368cb` 上用真实 tarball + Headless Chrome 实测：

- **与加载顺序无关的三项**：`* { box-sizing }`（定宽盒子 222px → 200px）、`body { min-width: 320px }`（0 → 320px）、`:root` 的 `font-synthesis: none` + `text-rendering: optimizeLegibility`（继承到宿主正文）。
- **与加载顺序有关的三组**：`body` 的 margin/背景/文字色、`a` 的颜色与下划线、`button,input { font: inherit }`。
- **模式 A（`FolioApp` 整站）依赖这 5 条规则**：`apps/site/src/site.css` 不重复声明，并把 `--site-*` 全部别名到 `--folio-*`。
- **模式 B（`FolioMarkdown` 嵌入）的污染已实测，但当前没有真实嵌入消费者**；`apps/site` 是唯一消费者且为模式 A。
- `--folio-*` 变量、`.markdown-mermaid*`、`@media`、`[data-folio-theme]` 不影响宿主。

因此本基线**不把模式 B 的风险写成生产事故**，也不建议在 C6a 之前改全局规则。

### 4.4 CSS 发布方式与聚合门禁（C6a 的事实前提）

- 当前发布方式：单文件复制 → `dist/styles.css` → `exports["./styles.css"]` → `sideEffects` 白名单。没有构建期聚合。
- 因此「把 `styles.css` 拆成多个组件 CSS 文件」如果不同时建立聚合构建，会直接导致 `dist/styles.css` 缺样式，而现有 `pack:verify` 只断言文件存在，**不会发现内容缺失**。
- C6a 门禁至少要证明：
  1. `dist/styles.css` 仍由聚合构建产生，且导出路径不变；
  2. 聚合内容包含每个组件的选择器块，且 Token 块在组件规则之前（级联顺序稳定）；
  3. 真实 tarball 消费者构建出的 CSS 资产包含默认组件规则（不只是文件存在）；
  4. 5 条全局规则与 `--folio-*` Token 名称不变；
  5. 静态 HTML 与 React 共用的类名仍被覆盖（C6b 做完整回归）。
- `apps/site` 目前直接覆盖 `.folio-*` 类名（§2.3 第 8 条），所以组件 CSS 迁移在 C7 之前不能改这些类名。

## 5. B1 / B2 / C6a 的真实约束与依赖

> 代号来自未合并的 PR #54 v0.3，仅作规划引用；本卡不据此建卡、不占用正式编号。

### 5.1 B1 · Core 数据类型与 UI Props/Slots 类型分离

**目标（PR #54 v0.3）**：拆分 `types.ts`，根入口 TS 签名保持兼容。

**当前事实**

- `types.ts` 69 行，`import type { ReactNode } from "react"`，混合 Core 数据（`FolioDoc`、`FolioHeading`、`FolioEntryType`、`FolioNavigationItem`、`FolioConfig`）与 UI 类型（`FolioSlots`、`FolioAppProps`、`FolioUiOptions`、`FolioThemePreference`）。
- `content`、`docs-structure`、`search`、`config`、`static`、`vite` 与 3 个 UI 模块（`app`、`header`、`docs-shell`）都从 `./types` 导入；`heading-ids`、`markdown` 不导入。

**施工约束**

1. 根入口 17 个类型名必须原样保留；`virtual.d.ts` 依赖 `FolioDoc` 从包名导入，`apps/site` 也从根入口导入 `FolioDoc`。
2. UI 类型可以依赖 Core 类型（`ui → core`），不能反向；拆分后 Core 类型的文件不得出现 `react` 导入。
3. 纯类型改动：`dist/index.js` 的行为与导出不得变化；只允许 `.d.ts` 组织方式变化。
4. 不改 CSS、不改构建脚本、不新增 `/core`、`/ui` 子路径（PR #54 要求先有真实 tarball POC，属 D1）。
5. 必须一次性更新所有 import 方；不能留下「旧 types.ts 兼容层」长期并存。
6. 验证：`tsc --noEmit`、42 个包测试、`pack:verify`、`pack:consumer`（三条类型路径）、`apps/site` typecheck + build；并对照本文件 §3.2/3.3 的导出清单。

**依赖**：无代码前置；需要维护者接受本基线。**判断：可以开始。**

**风险**：类型重导出如果改变声明身份，会破坏 `import type { FolioDoc }` 的消费者；现有 tarball 检查覆盖 NodeNext/Bundler，但不覆盖任意消费者代码，因此导出名必须逐字保持。

### 5.2 B2 · Core 纯逻辑归位（PR #54 v0.3 拆为 B2a/B2b/B2c）

**B2a：`content.ts` + `heading-ids.ts` + `docs-structure.ts` 原子归位**

- 事实：`docs-structure.ts` 依赖 `content.ts` 的 `compareFolioDocs`/`slugify`；`content.ts` 依赖 `heading-ids.ts`。三者不能拆开单独移动。
- 约束：`markdown.ts`（`slugify`）、`vite.ts`/`static.ts`（`docs-structure`）、`index.ts`（重导出）的导入路径必须同批更新；`parseFolioDoc` / `extractHeadings` / neighbors 语义不变。
- 验证：`content.test.mjs`、`docs-structure.test.mjs`、`static.test.mjs` 全绿；FOL-013 的「TOC ID = 渲染 heading ID」测试必须继续通过。

**B2b：`markdown.ts` 归位**

- 事实：`markdown.ts` 依赖 `content`（slugify）与 `heading-ids`；被 `markdown-react.tsx`（UI）、`static.ts`（Build）、根入口共同使用。
- 约束：marked 配置、Callout 占位符、代码高亮、Mermaid 源码转义、标题锚点分配规则不得改变；`renderFolioMarkdown` 的公开签名与 `FolioMarkdownRenderOptions` 不变。

**B2c：`search.ts` + `config.ts` 归位**

- 事实：两者只依赖 `types`；`app.tsx` 使用 `normalizeBasePath`，`apps/site` 从根入口使用 `defineFolioConfig`/`resolveGithubPagesBase`。
- 约束：搜索结果排序、空查询行为、base path 归一化结果不变；公开签名不变。

**B2 共同约束**

1. 保持 `src/index.ts`、`src/vite.ts` 作为入口 barrel；否则必须同批改 tsup 输入、`exports`、`copy-styles`、测试。
2. 一次只动一个边界，每张卡都跑完整 `release:check` + `pack:consumer`。
3. 不新增公共子路径；不把 `docs-structure.ts` 的语义搬进 UI。
4. 包测试从 `dist` 导入，拆分后仍应构建后测试，不要改成源码导入。

**依赖**：B1 → B2a → B2b/B2c。**判断：B1 完成且导出清单稳定后可以开始 B2a。**

### 5.3 C6a · 组件样式聚合/打包门禁（所有组件 CSS 迁移的硬前置）

**目标（PR #54 v0.3）**：在 C2–C5 之前建立聚合构建能力，保证 `@uichat-mira/folio/styles.css` 导出不变，且构建后 CSS 内容、依赖顺序、真实发布产物都有回归验证。

**当前事实**

- `copy-styles.mjs` 只复制单文件；没有 CSS 聚合、没有 PostCSS/打包器。
- `pack:verify` 只断言 `dist/styles.css` 在包内，不断言内容。
- `styles.css` 同时服务 React 与静态 HTML；`apps/site` 依赖 5 条全局规则并覆盖多个 `.folio-*` 类名。
- FOL-014 证明单文件默认样式在独立 tarball 消费者中可用（CSS 资产 18,851 字节、无官网选择器）；其后新增的 40px 触控目标 CSS 不在那批截图内。

**施工约束**

1. `dist/styles.css` 必须仍是唯一聚合入口，`exports` 与 `sideEffects` 不变。
2. 拆分后必须有确定性的拼接/构建顺序；Token 块先于组件规则。
3. 门禁要验证**内容与顺序**，不能只验证文件存在；建议直接断言每个组件选择器块与 Token 块存在，并在真实 tarball 消费者构建产物中验证组件规则可达。
4. 5 条全局规则与 `--folio-*` Token 名称冻结；任何全局规则变更需要独立授权，不属于 C6a。
5. 类名冻结到 C6b/C7：静态 HTML 与 `apps/site` 都依赖现有 `.folio-*`。
6. 门禁必须接入 `release:check` 或 `pack:verify`，避免被单卡绕过；Windows 包检查保持有效。
7. C6a 本身不改视觉、不迁移组件规则，只建立能力与门禁。

**依赖**：FOL-007（宿主影响结论）+ 本基线 §4；与 B1 无依赖。**判断：维护者接受 §4 边界后即可开始，但必须先于 C2–C5。**

### 5.4 依赖与顺序（事实约束汇总）

| 工作 | 可以开始的条件 | 不得同时改变 |
| --- | --- | --- |
| B1 | 本基线被接受；导出清单冻结 | 运行时、CSS、构建脚本、公共子路径 |
| B2a | B1 完成；三者原子移动 | 标题/排序/邻居语义、入口名 |
| B2b | B2a 完成 | Markdown 输出、锚点规则 |
| B2c | B2a 完成 | 搜索排序、base path 行为 |
| C6a | §4 边界被接受；早于 C2–C5 | 导出路径、全局规则、Token 名、类名 |

## 6. 未验证项与不确定项（如实记录）

1. **npm Registry 现状未在本卡重新查询**；`0.1.1` 已发布来自 README / consumer-contract / FOL-016 证据，不是本次实测。
2. **FOL-007 的浏览器测量是历史证据**（`de368cb`）；本次只核对了当前选择器集合与行号，没有重跑 `docs/research/fol-007/run.mjs`。
3. **FOL-014 的截图早于 40px 触控目标 CSS**（`docs/consumer-contract.md` 已注明）；本次没有重跑浏览器验收。
4. **本机无法用单次 `release:check` 覆盖全部阶段**：`apps/site` 的 esbuild 临时文件清理只在工作区内临时目录成功，而 `pack:consumer` 要求消费者位于仓库外；分项真实结果见 §1.2。CI 结果以 PR 检查为准。
5. **当前没有自动化检查**断言根入口导出清单稳定性、CSS 聚合内容、或 React/静态类名一致性；这些正是 B1 的回归面与 C6a/C6b 的交付物。
6. **`apps/site` 对 `.folio-*` 的覆盖是否为必要 API 缺口未评估**；本卡只记录事实，不判定其合理性。
7. **未评估嵌入模式（模式 B）的真实消费者**；FOL-007 已说明当前不存在。

## 7. 证据清单

| 证据 | 位置 / 命令 |
| --- | --- |
| 基线 SHA | `git rev-parse origin/dev` → `26d1c2a6834485b53857f414d951e4c81bd53409` |
| 分项验证 | `npm run release:check` 各阶段（真实结果与限制见 §1.2） |
| 包审计 | `npm run pack:verify -w @uichat-mira/folio` → 11 files / 108318 bytes |
| 独立消费 | `npm run pack:consumer -w @uichat-mira/folio` → tarball sha256 `ca0d7b88…` |
| 根入口导出 | `node --input-type=module -e "const r=await import('./dist/index.js'); ..."` → 19 个 |
| 插件入口导出 | 同上 `dist/vite.js` → 7 个 |
| 包清单 | `packages/folio/package.json` |
| 根导出源码 | `packages/folio/src/index.ts` |
| 插件源码 | `packages/folio/src/vite.ts` |
| 类型混合 | `packages/folio/src/types.ts` |
| 静态生成 | `packages/folio/src/static.ts` |
| React 文档壳 | `packages/folio/src/docs-shell.tsx` |
| 样式复制 | `packages/folio/scripts/copy-styles.mjs` |
| 全局 CSS | `packages/folio/src/styles.css` L1–L70 |
| 包/消费门禁 | `packages/folio/scripts/verify-package.mjs`、`verify-tarball-consumer.mjs`、`checks/*.mjs` |
| 官网消费 | `apps/site/src/main.tsx`、`apps/site/vite.config.ts`、`apps/site/src/site.css` |
| 宿主影响证据 | [FOL-007](https://github.com/uichat-mira/folio/issues/51)、[`docs/research/fol-007-css-host-impact.md`](../fol-007-css-host-impact.md) |
| 双渲染导航证据 | [FOL-008](https://github.com/uichat-mira/folio/issues/52)、[`docs/research/fol-008-navigation-parity.md`](../fol-008-navigation-parity.md) |
| 独立 UI 验收 | [FOL-014](https://github.com/uichat-mira/folio/issues/84)、[`docs/research/fol-014-default-ui-acceptance.md`](../fol-014-default-ui-acceptance.md) |
| 规划参考（未合并） | [PR #54](https://github.com/uichat-mira/folio/pull/54) |
