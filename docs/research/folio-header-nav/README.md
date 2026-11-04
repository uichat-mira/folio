# Folio Header 第一轮整治 · 真实浏览器验证记录

- 分支: `feat/header-nav-megamenu`（基于 `origin/dev` @ `a144b6c`）
- 浏览器: Google Chrome for Testing（Playwright `chromium-1243`，headless），DPR 1
- 复现: `FOLIO_BASE=<地址> node docs/research/folio-header-nav/run.mjs`
- 结论: **右对齐、结构化下拉菜单、Header 视觉与动效三项均按真实浏览器结果通过**；
  过程中发现并修正 2 个真实缺陷（见第 5 节）。静态无 JS 页面仍无顶部导航，属既有缺口，
  本次不扩大范围，仅记录（第 6 节）。

## 1. 环境与复现方式

```bash
npm ci --no-audit --no-fund
npm run build -w @uichat-mira/folio
npm run dev -w apps/site                      # http://localhost:5173/
GITHUB_REPOSITORY=uichat-mira/folio npm run dev -w apps/site   # http://localhost:5174/folio/
```

验证脚本需要 Playwright 与一份 Chromium。若本机没有与 Playwright 版本匹配的浏览器，
用 `PLAYWRIGHT_MODULE_DIR` 与 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向已有安装：

```bash
PLAYWRIGHT_MODULE_DIR=/tmp/pw/node_modules/playwright \
PLAYWRIGHT_CHROMIUM_EXECUTABLE="/path/to/Google Chrome for Testing" \
FOLIO_BASE=http://localhost:5181 \
node docs/research/folio-header-nav/run.mjs
```

脚本输出 `results.json` 与 `shots/*.png`，全部数据来自运行中的 DOM、computed style 与
真实绘制像素，不读取源码文本、不以 CI 状态代替验收。

## 2. 右对齐

`1440px` 实测：

| 指标 | 值 |
| --- | --- |
| Header 高度 | `64px` |
| `__wrap` 内边距 | `0 28px` |
| Brand 距左内边距 | `28px` |
| 右侧功能区距右内边距 | `28px` |
| 导航与按钮区间距 | `16px` |
| 顶层条目 | `8` |
| 水平溢出 | `0` |

导航位于 brand 右侧且与操作按钮构成连续右簇（`navIsRightOfBrand: true`）。实现方式只有
一处：`.folio-header__nav` 承接剩余宽度并 `justify-content: flex-end`，
`.folio-header-actions` 去掉原来的 `margin-left: auto`。没有引入新的布局系统。

窄屏收敛（无挤压、无截断、无溢出）：

| 宽度 | 水平溢出 | 被截断条目 | 搜索标签 |
| --- | --- | --- | --- |
| 1440 | 0 | 0 | 显示 |
| 1024 | 0 | 0 | 显示（提示键位隐藏） |
| 900 | 0 | 0 | 隐藏，仅图标 |
| 820 | 0 | 0 | 隐藏，仅图标 |
| 781 | 0 | 0 | 隐藏，仅图标 |
| 780 | 切换为移动端 |

## 3. 结构化下拉菜单

官方站现在是 5 个结构化菜单（开始 / 安装 / 编写 / API / 部署）+ 3 个普通链接
（展厅 / 文章 / 项目）= 原有的 8 个顶层入口，顺序与目标路由不变——两种形态都被实际使用。
全部 18 个面板条目 `href` 均指向真实存在的路由。

| 检查 | 结果 |
| --- | --- |
| 悬停展开 | `visibility: visible`，`aria-expanded="true"` |
| 面板在视口内 | 是（1440 / 1024 / 900 / 820 / 781 全部 `offscreen: 0`） |
| 指针跨 14px 间隙不闪断 | 面板保持打开，同时只有 1 个 `is-open` |
| `Escape` 关闭 | `hidden` |
| 点击展开 | `expanded: true` |
| 点击面板外关闭 | `hidden` |
| 面板项真实跳转 | 落到 `/docs/introduction`，标题正确 |
| 路由变化后关闭 | `hidden`，`aria-expanded="false"` |
| 键盘 | `Tab` → `Enter` 展开 → `Tab` 进入面板条目，焦点落在 `a.folio-nav-menu__entry`，面板保持打开 |
| 客户端路由 | header 节点同一实例（`sameNode: true`），激活项随路由更新 |

移动端使用独立手风琴，不是把桌面面板压窄：

| 检查（390 / 320） | 结果 |
| --- | --- |
| 桌面导航隐藏、菜单按钮出现 | 是 |
| 面板贴顶 `64px`、满宽（390 / 320） | 是 |
| 手风琴条目数 / 普通链接数 | 5 / 3 |
| 移动面板内是否混入桌面面板 DOM | 否（`desktopPanelInsideMobile: 0`） |
| 展开子项 | `aria-expanded="true"`，子链接可见 |
| 子项跳转后面板关闭 | 是 |
| 水平溢出 | 0 |

切换面板沿用真实 `<Link>` / `<button>`，因此新标签页、复制链接等原生行为保留。

## 4. 视觉与动效

- 激活态：`color: var(--folio-primary-active)`（实测 `rgb(169, 88, 62)`）+ `font-weight: 600`，
  无胶囊底色、无下划线；悬停是底色。两者不再共用同一种背景。
- 面板：`16px` 内边距、`1px` hairline 边框、`12px` 圆角、单层环境阴影
  `0 18px 48px`，eyebrow → 标题 → 分隔线 → 条目 的层级。
- 动效：面板 `0.15s`、手风琴 `0.18s`、箭头旋转 `0.18s`，都是位移与透明度。
- 深色模式：header 绘制像素 `rgb(24, 23, 21)`，与 `[data-folio-theme="dark"]` 的
  `--folio-canvas` 一致；面板同步换色。
- 浅色模式：header 绘制像素 `rgb(250, 249, 244)`，与 `--folio-canvas: #faf9f5` 一致。
- `prefers-reduced-motion: reduce` 下，面板、移动面板、箭头 transition 全为 `0s`。

像素采样点在截图里只有页面底色与面板底色，用于确认表面真的按 token 绘制，而不是只相信
computed style。

## 5. 本轮发现并修正的真实缺陷

两项都是**真实浏览器**跑出来的，不是代码审查推断：

1. **移动端首次点击被当成"点击面板外"而立即关闭。**
   移动面板是 `header` 的直接子节点（`fixed` 定位），不在 `navRef` 之内，所以 document 级
   `pointerdown` 处理器把面板内的第一次点击判为外部点击。修复：把移动面板也纳入
   "内部"判断。修复前 `childVisible: false`，修复后 `true`。
2. **窄桌面下左侧菜单面板溢出视口。**
   面板原先相对各自 `<li>` 定位；因为导航整体靠右，最左侧触发器在 781–900px 时面板左边缘
   到达 `-196px`。修复：面板改为相对 `.folio-desktop-nav` 定位并横跨导航轨道。这样
   每个面板在任意宽度都在视口内，且始终位于其触发器正下方，指针可以竖直下移进入。

同时修正一处**保真问题**：第一版把原配置的 8 个顶层入口合并成 7 个（`安装` 并入 `开始`），
与"保留导航顺序与路由"的要求不符。现已恢复全部 8 个顶层入口及原始顺序。

## 6. 未解决 / 不在本轮范围

- **静态（无 JS）页面没有顶部导航。** 预渲染的文档页只有侧边栏，从来没有 header 导航；
  本次没有改变这一现状，也没有实现静态 mega menu。这是既有缺口，不是本分支引入的回退。
  需要无 JS 顶部导航的 consumer 仍应通过 `staticRoutes` 自行提供。
- 本轮只验证 Chrome。Safari / Firefox 未验证。
- 未做真实触摸屏物理命中测试；移动端验证使用 Playwright 的 `hasTouch` 上下文与 `tap()`。
- 面板在 781px 附近宽度为 `433px`（导航轨道宽度）；更窄的桌面会走移动端布局，因此不存在
  面板过窄的情形。若未来导航条目显著增多，需要在 780px 之上再加一档收敛策略。
