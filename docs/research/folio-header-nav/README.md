# Folio Header 第一轮整治 · 真实浏览器验证记录

- 分支: `feat/header-nav-megamenu`（基于 `origin/dev` @ `a144b6c`）
- 浏览器: Google Chrome for Testing（Playwright `chromium-1243`，headless），DPR 1
- 复现: `FOLIO_BASE=<地址> node docs/research/folio-header-nav/run.mjs`
- 结论: 右对齐、结构化下拉菜单、Header 视觉与动效三项按真实浏览器结果通过；
  **导航信息架构已按审查意见重做**（见第 2 节），这是本次修订的主要变更。
  静态无 JS 页面仍无顶部导航，属既有缺口，不扩大范围（第 6 节）。

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

## 2. 信息架构（本轮修订的核心）

### 上一版错在哪

上一版把原有 8 个顶层入口改造成 5 个下拉菜单 + 3 个普通链接，**目的是让组件有东西可演示**，
分类则是为了填满菜单而重新分配的：

- 「API」里有「Folio 是什么」（这是入门内容）；
- 「开始」里塞了内容维护与运行时组合（早已越过入门）；
- 「安装」里混入配置参考、构建集成与迁移状态；
- 「开始 / 安装 / 编写 / API」边界互相重叠；
- 「部署」只是因为需要第五个下拉才被提成一级栏目。

这不是读者能理解的知识体系。**菜单应服务内容，而不是让内容迁就菜单。**

### 现在的一级导航

一级导航表达**内容类别**，只有一条下拉：

| 一级入口 | 形态 | 指向 |
| --- | --- | --- |
| 文档 | 下拉 | `/docs/`（集合索引） |
| 展厅 | 普通链接 | `/showcase` |
| 文章 | 普通链接 | `/blogs` |
| 项目 | 普通链接 | `/projects` |

### 「文档」里的二级导航

二级导航表达**阅读任务**，不表达文件位置：

| 分组 | 条目数 | 承载内容 |
| --- | --- | --- |
| （无标题，置顶） | 1 | 文档目录，即集合索引 |
| 快速开始 | 2 | Folio 是什么、快速开始 |
| 编写与配置 | 3 | 编写内容、内容模型、导航与内容清单 |
| 参考资料 | 4 | 站点配置、Frontmatter、构建集成、静态构建与 SEO |
| 部署发布 | 2 | GitHub Pages、Cloudflare Pages |

更深的知识层级交给文档侧边栏。面板内**只有两级**，这是刻意的：header 下拉承载任务分流，
不承载知识全图。

分组依据来自内容自身的 Frontmatter（`group: 指南 · 入门`、`group: 参考 · API`、
`group: 参考 · 部署`），不是凭空发明的新分类。

### 为此新增的通用能力

上一版面板只能渲染**扁平**链接列表。12 个链接平铺无法表达阅读任务，而正是这个限制
逼出了「多开几个下拉」的思路。所以真正的修复在组件层：

`FolioNavigationChild` 新增可选 `group` 字段。同一 `group` 的条目渲染在同一个标题下，
按首次出现顺序排列；未分组的条目汇成一段无标题内容置顶（内含自动生成的 section root）。
完全不写 `group` 时，面板与旧版一致——旧配置不需要改一个字符。

解析结果同时提供 `entries`（始终扁平）与 `groups`（同一批链接的分组视图），
两者永不互相矛盾，忽略分组的 consumer 继续工作。`groupEntries()` 也对外导出。

### 面板几何（这轮实测修正的）

面板原先相对导航轨道定位、宽度等于轨道宽度。顶层从 8 条减到 4 条后，轨道变窄，
面板被挤成 218×980 的单列——**8 条时成立的做法在 4 条时不成立**。现改为：

- 相对 `.folio-header__nav` 容器定位（不是触发器，也不是轨道）；
- 显式宽度 `min(880px, 100vw - 56px)`；
- 列数按阈值确定：≥874px 视口四列（4×180 + 3×22 间距 = 786px 内部宽度），以下两列。

实测 1440/1024/900 为四列、450px 高，820 为两列、663px 高；
1440/1200/1100/1024/940/900/860/820/800/781 全部 `fitsX: true`、水平溢出 0。

## 3. 右对齐

`1440px` 实测：header `64px`；brand 距左 `28px`；右侧功能区距右 `28px`；
导航与按钮区间距 `16px`；水平溢出 `0`。

实现只有一处：`.folio-header__nav` 承接剩余宽度并 `justify-content: flex-end`，
`.folio-header-actions` 去掉原来的 `margin-left: auto`。没有引入新的布局系统。

窄屏逐级收敛，全程无挤压/截断/溢出：`1080px` 收紧内边距与字号并隐藏 `⌘K` 提示 →
`900px` 搜索退化为纯图标 → `780px` 切移动端。

## 4. 交互与视觉

| 检查 | 结果 |
| --- | --- |
| 悬停展开 | `visibility: visible`，`aria-expanded="true"` |
| 指针跨 14px 间隙 | 面板保持打开，同时只有 1 个 `is-open` |
| `Escape` / 点击外部 / 路由变化 | 均关闭 |
| 面板项真实跳转 | 落到真实任务页，标题正确 |
| 键盘 | `Tab` → `Enter` 展开 → `Tab` 进入面板条目 |
| 客户端路由 | header 同一实例，激活项随路由更新 |
| 移动端 | 独立手风琴，**分组标题同样渲染**（4 个），点击落到真实任务页 |
| 深色模式 | header 绘制像素 `rgb(24, 23, 21)` |
| 浅色模式 | header 绘制像素 `rgb(250, 249, 244)` |
| `prefers-reduced-motion` | 面板/移动面板/箭头 transition 全 `0s` |

面板视觉实测：背景 `rgb(250, 249, 245)`、圆角 `12px`、header 分隔线 `1px`、
标题 `18px`、分组标题 `10.5px` / `letter-spacing: 1.05px`、条目高 `38px`、
四列任务分组顶边全部对齐在 `top: 244`。

`/` 与 `/folio/` 两种 base 都实测：`/folio/` 下全部 `href` 均以 `/folio/` 开头
（`badHrefs: []`），深链接 200，激活态正确解析，分组结构一致。

## 5. 验证中发现并修正的真实缺陷

三项都是真实浏览器/真实构建跑出来的：

1. **移动端首次点击被当成"点击面板外"而立即关闭。** 移动面板是 `header` 直接子节点
   （`fixed`），不在 `navRef` 内，document 级 `pointerdown` 把面板内首次点击判为外部。
   修复前 `childVisible: false`，修复后 `true`。
2. **窄桌面左侧面板溢出视口。** 面板原先相对各自 `<li>` 定位，781–900px 下最左侧面板
   到 `left: -196px`。
3. **顶层入口减少后面板被挤成单列**（见 2.5）。这是把导航从 8 条收敛到 4 条才暴露的，
   也说明「面板宽度跟着导航轨道走」这个假设本身是错的。

## 6. 未解决 / 不在本轮范围

- **静态（无 JS）页面没有顶部导航。** 预渲染文档页一直只有侧边栏。本次没改这个现状。
- **根源问题已记录、未处理：`docs/`、`api/guide/`、`api/reference/` 三套目录本身分类交叠。**
  例如 `api/guide/what-is-folio.md` 的标题是「API 文档索引」，而 `docs/introduction.md`
  才承载入门内容。新导航用 `group` 表达阅读任务，绕开了目录位置，**但这只是让导航不再
  暴露目录问题，并没有修好目录本身**。目录治理是独立议题，不应塞进 Header PR。
- 只验证了 Chrome。Safari 的 `color-mix()`、`backdrop-filter`、`grid-template-rows`
  动画仍需人工过一遍。
- 未做真实触摸屏物理命中测试，移动端使用 Playwright `hasTouch` + `tap()`。
- 分组列数阈值（874px）与内容条目数绑定。条目显著增多时需要重新评估。
