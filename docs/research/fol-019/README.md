# FOL-019 独立消费者默认 UI 视觉基线

本目录是 FOL-019（Issue [#110](https://github.com/uichat-mira/folio/issues/110)）的
证据目录。它**不新建验收平台**：浏览器驱动、tarball 安装、严格 `tsc` 与截图逻辑仍然
只在 [`../fol-014/run.mjs`](../fol-014/run.mjs) 里；这里只提供场景包装、自有消费者
fixture 与结果。

## 结构

| 路径 | 作用 |
| --- | --- |
| `run.mjs` | 场景包装：用 `--out` / `--fixture` / `--scenario` 调用 FOL-014 harness |
| `scenario.json` | 场景：起始路由、交互选择器、搜索探测、无 JS 静态阶段 |
| `consumer/` | FOL-019 自有消费者 fixture（FOL-014 fixture 的副本 + 一篇长文样张） |
| `results/` | 本次采集产物：`acceptance.json`、截图、渲染 DOM、静态 HTML 快照 |

FOL-014 的 `consumer/` 与 `results/` 未被修改或覆盖；`run.mjs` 在不传任何参数时仍然
完全复现 FOL-014 的默认行为与产物路径。

## 消费者 fixture

`consumer/` 与 `../fol-014/consumer/` 的唯一差异：

1. `vite.config.ts` 用 `FOLIO019_STATIC=1` 切换 `staticRoutes`：
   - 未设置 → `staticRoutes: false`，构建 React SPA 壳，用于运行时交互验收；
   - 设置 → `staticRoutes: {}`，由包内公开 Vite 插件写出预渲染 HTML，用于无 JS 阅读验收。
2. 新增 `content/docs/long-form.md`：长正文、多级标题、代码块、宽表格、嵌套引用与列表。
3. 站点标题/页脚改为 FOL-019 文案。

fixture 只引用三个公开入口：`@uichat-mira/folio`、`@uichat-mira/folio/vite`、
`@uichat-mira/folio/styles.css`，以及 `virtual:folio/content`。没有 workspace 别名、
没有仓库内部源码路径、没有 `apps/site` 的 `site.css` / `showcase.css` /
`legacy-claude-visual.css`。

## 运行

```bash
npm ci --no-audit --no-fund
node docs/research/fol-019/run.mjs          # 全流程：build → pack → 独立安装 → tsc ×4 → vite build → Chrome
node docs/research/fol-019/run.mjs --keep   # 保留仓库外临时消费者目录用于诊断
```

设置 `FOLIO014_CHROME` 可覆盖浏览器路径（默认查找系统 Chrome/Edge）。

一次运行做两次构建、共享同一次 tarball 安装：

1. `staticRoutes: false` 的 SPA 构建 → 桌面 1440×900 / 手机 375×812 的亮/暗测量、
   截图、侧栏/TOC/分页/抽屉/搜索交互；
2. `FOLIO019_STATIC=1` 的静态构建 → 校验 `dist/**/index.html` 预渲染文件，再以
   **禁用 JavaScript** 的页面测量正文、导航/TOC、分页、类名与默认 CSS。

`staticRoutes: false` 的 React SPA 不是静态验收；静态证据只来自第 2 步的预渲染 HTML。

## 结果与报告

- 报告：[`../fol-019-default-ui-baseline.md`](../fol-019-default-ui-baseline.md)
- 原始数据：`results/acceptance.json`（包证据、类型、构建、几何、交互、控制台、
  静态 HTML 与无 JS 测量）
- 截图：`results/screenshots/`（6 张 React 基线 + 3 张静态无 JS）
- 渲染 DOM：`results/dom-*.html`（桌面、移动抽屉打开态）
