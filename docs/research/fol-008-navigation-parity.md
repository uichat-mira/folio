# FOL-008：静态 HTML 与 React 文档导航的行为对照

- Issue: [#52](https://github.com/uichat-mira/folio/issues/52)
- 基线：`origin/dev` = `de368cbbebf9ce53c496a4fe722f992da99abdc1`
  （`docs(folio): correct npm publication and consumer migration status (FOL-006 #50)`）
- 研究 worktree：`D:\folio-worktrees\fol-008`，分支 `research/fol-008-navigation-parity`
- 环境：Windows、Node v24.9.0、npm 11.6.0、Chrome 156.0.8078.79（`--headless=new --dump-dom`）
- 语料与工具：`docs/research/fol-008/fixture/`（内容、构建、服务、浏览器 dump、对照分析）

## 结论（先读）

1. **没有发现双路径的导航分叉需要修复。** 在相同语料、相同 base path 下，TOC 的条目顺序与层级、
   标题 ID 与 TOC `href` 的对应、重复标题的稳定后缀、上一篇/下一篇的内容与顺序、base path 前缀
   全部一致。
2. 唯一的系统性表示差异是**尾斜杠**：静态链接是 `/folio/docs/guide/intro/`，React `Link` 生成
   `/folio/docs/guide/intro`。这是“静态目录索引”与“SPA 路由”两种运行模式的表示差异，不是缺陷；
   GitHub Pages 对无尾斜杠的目录请求返回 `301` 到带尾斜杠 URL，实测可达（见“Pages 子路径”）。
3. 库默认的 `staticRoutes` 静态文档页在无 JS 时**可以**导航（侧栏）、定位正文（TOC 锚点）和
   访问相邻篇（上一篇/下一篇）。
4. 官方站 `apps/site` 用 `staticRoutes.routes` 覆盖了静态 body，因此其**无 JS 文档页只有正文**，
   没有侧栏、TOC、分页。这是 `docs/static-build.md` 里“站点负责 body markup”的既有职责划分，
   不是 `static.ts` 与 `docs-shell.tsx` 的规则分叉；但会影响“无 JS 也能全站浏览”的产品表述，
   建议在发布说明或独立任务中决定，不在本卡施工。
5. 附加边界探测发现一个**两路径同源、同时错误**的 TOC 锚点缺陷（标题含 Markdown 链接或 `&` 时，
   TOC `href` 与正文 heading `id` 不一致）。当前站点 doc 内容没有触发它。它不属于“分叉”，
   建议单独治理，不阻塞 0.1.0。
6. **对 0.1.0 首发：导航一致性不构成阻塞项，无需为此修改生产实现。**

## 语料与方法

三篇 Markdown 位于 `docs/research/fol-008/fixture/content/docs/guide/`，同属 `collection: Core`：

| 文档 | route | order | section | 覆盖点 |
| --- | --- | --- | --- | --- |
| `intro.md` | `/docs/guide/intro` | 1 | Basics | h2/h3/h4、重复标题、行内代码标题、显式 `<h2 id>` |
| `second.md` | `/docs/guide/second` | 2 | Basics | 同分组上一篇/下一篇、重复标题 |
| `third.md` | `/docs/guide/third` | 3 | Advanced | 跨 section 相邻关系 |

两条路径都来自**同一份真实构建产物**：

- **A. 静态 HTML**：Vite + `folio` 插件、`staticRoutes: true`，使用 `static.ts` 的
  `defaultRoutes`（`renderStaticDocShell`/`renderStaticDocNav`/`renderStaticToc`/`renderStaticPager`）。
  分别以 `base: "/"` 和 `base: "/folio/"` 构建。
- **B. React 文档视图**：同一 bundle 的 `FolioApp` 公开入口，由严格静态服务器（目录索引、
  无 SPA catch-all、未知路径走 `404.html`）提供，在 Chrome 中完成真实渲染后 dump DOM。

对照工具只导出事实，不写结论：`analyze.mjs`（链接/顺序/锚点/静态目标是否存在）、
`summarize.mjs`（可读摘要）、`toc-check.mjs`（TOC href 是否命中正文 id）、
`edge-probe.mjs`（附加边界探测）。完整原始结果在 `results/root.json`、`results/pages.json`、
`results/edge-probe.json`。

**证据强度说明**：React 侧是真实浏览器渲染后的 DOM（非代码推导），但未做点击/滚动交互自动化，
也没有在真实 GitHub Pages 部署本 fixture；Pages 侧证据来自对线上站点的 HTTP 探测和本地严格
静态服务器。静态侧是真实 build 产物。研究不涉及视觉布局。

## 逐项对照

判定口径：**一致** = 目标与语义相同；**设计差异** = 两种运行模式的表示不同但都可正确工作；
**真实缺陷** = 用户可观察的错误导航；**证据不足** = 无法从现有运行证据判断。

| # | 检查项 | 静态结果 | React 结果 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | TOC 条目顺序与层级 | 8/3/3 条，顺序与 `doc.headings` 一致，`folio-toc-depth-N` 反映 h2–h4 | 同上，条目与层级相同 | 一致 |
| 2 | 标题 ID 与 TOC `href` 锚点 | 主语料全部命中（每页 TOC 目标集合 = 正文 `id` 集合） | 全部命中，且与静态相同 | 一致（边界例外见下） |
| 3 | 重复标题 ID 稳定性 | `重复标题`、`重复标题-2`；无重复 id | 完全相同；跨 `/` 与 `/folio/` 两次构建一致 | 一致 |
| 4 | 上一篇/下一篇身份、顺序、链接 | intro→second→third；仅尾斜杠差异 | 同一顺序与标题；`href` 无尾斜杠 | 一致（表示差异） |
| 5 | 根路径 `/` 下的导航目标 | 默认静态首页只有标题/描述，**无文档链接** | 首页有顶部导航 + 文档卡片（均指向 doc route） | 设计差异（见 5.1） |
| 6 | Pages 子路径 `/folio/` | `/folio/docs/.../`，无双重前缀、无前缀丢失 | `/folio/docs/...`，同上；无双重前缀 | 一致（尾斜杠表示差异，见 5.2） |
| 7 | 无 JS 静态文档可导航/定位/访问相邻篇 | 侧栏、TOC、分页齐全；所有链接落到真实生成文件，HTTP 200 | —（无 JS 不适用） | 一致（库默认）；官方站覆盖后见 5.3 |

### 1. TOC 顺序与标题层级

静态与 React 的 TOC 都直接遍历 `doc.headings`（`static.ts:399-408`、`docs-shell.tsx:97-130`），
层级只用 class `folio-toc-depth-{depth}` 表达。对 `intro` 的逐项结果（两个 base 相同）：

```text
#安装与配置 (h2) · #vite-配置 (h3) · #部署子路径 (h4) · #构建产物 (h4)
#重复标题 (h2) · #重复标题-2 (h2) · #安装-uichat-mira-folio (h2) · #explicit-readable-id (h2)
```

静态与 React 的文本、顺序、深度完全一致；这一项不存在需要修复的差异。

### 2. 标题 ID 与 TOC `href`

`toc-check` 对三篇文档的 14 个 TOC 条目逐项验证：每个 `href="#id"` 都能在正文找到同名 `id`，
静态与 React 都是 0 缺失。显式 `<h2 id="explicit-readable-id">` 也被两端纳入 TOC 且命中
（`heading-ids.ts` 的预留机制在两条流水线中同样生效）。

附加边界探测（`edge-probe.mjs`，不属于主对照语料）发现同源缺陷，见“6. 附加边界探测”。

### 3. 重复标题的 ID 稳定性

同一文档内两处 `## 重复标题` 在静态与 React 中都是 `重复标题`、`重复标题-2`；
`second.md` 的 `组合顺序` 同样得到 `组合顺序`、`组合顺序-2`。正文 `id` 集合没有重复项，
`/` 与 `/folio/` 两次独立构建结果相同。两端都使用 `heading-ids.ts` 的同一分配器，
且 `doc.headings` 也是同一 `extractHeadings` 产物，因此该一致是结构性的，不只是本次语料巧合。

### 4. 上一篇/下一篇

`getFolioDocNeighbors`（`docs-structure.ts:112-127`）被两端共用，顺序来自同一 collection 的
section 展开顺序：

```text
intro   : previous=—          next=second（运行时组合）
second  : previous=intro（入门：导航对照）    next=third（静态发布）
third   : previous=second（运行时组合）        next=—
```

内容身份、顺序、链接目标都一致。静态 `href="/docs/guide/second/"`（base `/`）或
`"/folio/docs/guide/second/"`（base `/folio/`）；React 对应 `/docs/guide/second` 与
`/folio/docs/guide/second`。差异只在尾斜杠。

### 5. 根路径与 Pages 子路径

#### 5.1 根路径 `/`

```text
静态默认首页（defaultRoutes "/"）:  <main class="folio-prerender"><h1>…</h1><p>…</p></main>
  → 0 个 <a>

React 首页（FolioApp 默认 Home）:
  → 品牌 /（或 /folio）、顶部导航 3 条、文档卡片 3 张
```

静态默认首页是极简预渲染，不承诺还原 React 首页；`docs/static-build.md` 把“首页/区域/文档 body
markup”列为站点职责，站点可通过 `staticRoutes.routes` 注入入口链接（`apps/site` 就注入了
“从 Folio 是什么开始”）。因此这不是导航规则分叉；但如果一个 consumer 直接使用默认
`staticRoutes` 且要求无 JS 从首页进入文档，需要自行覆盖首页 body。

#### 5.2 Pages 子路径

`base: "/folio/"` 时：

- 静态侧栏/分页：`/folio/docs/guide/second/`（`normalizeBase` + `staticRouteHref`，
  `static.ts:368-375`），无 `/folio/folio` 双重前缀；
- React 侧栏/分页：`/folio/docs/guide/second`（`BrowserRouter basename="/folio"` +
  `Link to={item.path}`，`app.tsx:326-339`、`docs-shell.tsx:80-87`），无前缀丢失。

对无尾斜杠目录路径，线上 GitHub Pages 的实测行为：

```text
GET https://uichat-mira.github.io/folio/docs/introduction  -> 301 -> .../docs/introduction/ -> 200
GET https://uichat-mira.github.io/folio/                    -> 200
```

本地严格静态服务器同样对 `/folio/docs/guide/second` 返回 301 到带尾斜杠 URL；Chrome 跟随
301 后 React 正确渲染“运行时组合”。因此 React 生成的“无尾斜杠”链接在真实托管上**不会 404**，
尾斜杠差异属于运行模式表示差异，不是缺陷。

#### 5.3 无 JS 静态文档

库默认 `staticRoutes` 生成的 `docs/guide/intro/index.html` 包含：

- `nav.folio-docnav`：三篇文档链接，当前篇带 `class="active" aria-current="page"`；
- `aside.folio-toc`：8 条页内锚点，全部命中正文 `id`；
- `nav.folio-page-nav`：上一篇/下一篇；
- 渲染后的正文。

对静态侧栏与分页的全部 `href`，`analyze.mjs` 验证对应目录下确实存在生成的 `index.html`；
本地 HTTP 请求全部 200（`/` 与 `/folio/` 两个 base）。因此库默认形态下，“无 JS 仍可导航、
定位正文、访问相邻篇”成立。

### 6. 官方站的静态现状（重要，但不是本卡的规则分叉）

`apps/site/vite.config.ts:57-79` 用自定义 `routes` 覆盖了所有文档静态 body，只输出正文与元数据；
`docs/static-build.md:58-63` 明确 body markup 属站点职责。对基线构建产物实测：

```text
npm run build -w @uichat-mira/folio-site
dist/docs/introduction/index.html
  → folio-docnav: false · folio-toc: false · folio-page-nav: false
```

即：**官方站无 JS 时能在单篇文档内阅读，但不能通过侧栏换篇，也没有页内 TOC 和上一篇/下一篇。**
React 在有 JS 时提供这些导航。这是站点组合选择导致的模式能力差异，不是 `static.ts` 与
`docs-shell.tsx` 的导航规则分叉，本卡不施工。若 0.1.0 的发布表述包含“无 JS 可完整浏览”，
需要在站点层单独决定是复用库的静态文档 shell，还是保持现状并在文档中说明。

## 差异分类汇总

| 差异 | 分类 | 依据 |
| --- | --- | --- |
| 静态 href 带尾斜杠、React href 不带 | 表现不同但符合两种运行模式 | 静态目录索引 vs SPA 路由；Pages 301 实测可达 |
| 静态默认首页无文档链接、React 首页有卡片/顶部导航 | 表现不同但符合设计 | 默认静态首页是极简预渲染；body markup 属站点职责，可覆盖 |
| 官方站无 JS 无侧栏/TOC/分页 | 站点层选择，非双路径规则分叉 | `apps/site/vite.config.ts` 覆盖 routes；`docs/static-build.md` 职责划分 |
| 含 Markdown 链接或 `&` 的标题：TOC `href` 与正文 `id` 不一致 | 真实缺陷（两路径同源同错，非分叉） | 见下节；现有 doc 内容未触发 |
| 移动端 DOM（`details` vs 按钮/遮罩） | 不是缺陷 | 交互模型不同，链接目标相同 |

## 附加边界探测（同源缺陷，非分叉）

`doc.headings` 的 `id` 来自 `content.ts:113-162` 的 `extractHeadings`（原始 Markdown + `slugify`），
而正文 heading 的 `id` 来自 `markdown.ts:170-193`（marked 渲染后的 HTML + `slugify`）。两条流水线
对普通标题、行内代码、强调、重复标题、显式 ID 一致，但对以下输入不一致：

| 标题 | TOC 目标（`extractHeadings`） | 正文实际 `id`（`renderFolioMarkdown`） | 结果 |
| --- | --- | --- | --- |
| `## [链接标题](https://example.com)` | `#链接标题https-examplecom` | `链接标题` | TOC 点击无目标 |
| `## FAQ & 支持` | `#faq-支持` | `faq-amp-支持`（marked 输出 `&amp;`） | TOC 点击无目标 |

两端 TOC 都用 `doc.headings`，所以静态与 React 会**同时**指向不存在的锚点——一致，但都错。
影响：这类标题的页内目录点击不跳转；不影响侧栏、上一篇/下一篇或 base path。
当前站点内容核查：含 `&` 的标题只出现在 `type: page` 的三篇设计参考里（`api/examples/*`），
它们不走文档 shell、没有 TOC；不存在含 Markdown 链接的标题。因此当前发布内容未触发。

最小修复位置（仅建议，本卡不实施）：

1. 让标题 id 只有一个来源。最小改动是在 `content.ts` 的 `cleanHeadingText`/`slugify` 侧
   与 `markdown.ts` 的实体处理保持一致：链接语法取链接文本、`&` 等实体先解码再 slugify；
   或直接在 `extractHeadings` 中复用渲染后的 heading 文本。
2. 回归测试建议：对 `docs-structure.test.mjs`/`markdown.test.mjs` 增加断言——对包含
   `[文本](url)`、`&` 的标题，`doc.headings[].id` 必须出现在 `renderFolioMarkdown` 输出中
   （可复用本目录的 `edge-probe.mjs` 输入）。

## 复现与证据清单

- 语料/工具/命令：`docs/research/fol-008/fixture/README.md`
- 原始结果：`results/root.json`、`results/pages.json`、`results/edge-probe.json`
- 生成物（不提交）：`fixture/dist-root/`、`fixture/dist-pages/`、`fixture/dumps-root/`、
  `fixture/dumps-pages/`、`fixture/dumps-site/`
- 关键命令：

```bash
npm ci --no-audit --no-fund && npm run build -w @uichat-mira/folio
cd docs/research/fol-008/fixture
FOLIO_FIXTURE_BASE=/       FOLIO_FIXTURE_OUT=dist-root  node ../../../../node_modules/vite/bin/vite.js build
FOLIO_FIXTURE_BASE=/folio/  FOLIO_FIXTURE_OUT=dist-pages node ../../../../node_modules/vite/bin/vite.js build
node analyze.mjs --out dist-root  --base /       --dumps dumps-root  --label root  --json results/root.json
node analyze.mjs --out dist-pages --base /folio/ --dumps dumps-pages --label pages --json results/pages.json
node edge-probe.mjs --json results/edge-probe.json
```

- 线上 Pages 行为探测（宿主行为，与本次提交无关）：

```text
curl -s -o NUL -w "%{http_code} %{redirect_url}" https://uichat-mira.github.io/folio/docs/introduction
→ 301 https://uichat-mira.github.io/folio/docs/introduction/
```

## 研究边界确认

本卡未修改 `static.ts`、`docs-shell.tsx`、`docs-structure.ts`、`heading-ids.ts` 或任何生产实现，
未新增共享导航框架，未改动默认 URL/slug/公开 API，未触碰 FOL-007 的 `docs/research/fol-007*` 文件，
未扩展搜索、主题或移动端交互，未合并旧 PR #24。

## 对 0.1.0 的回答

**没有需要修复的“双路径导航差异”。** 导航目标与语义在两种呈现下一致；尾斜杠与静态首页差异
属于运行模式/站点组合设计，不构成缺陷。两项可后置事项（官方站无 JS 侧栏能力、含链接或 `&`
标题的 TOC 锚点同源缺陷）都不是 0.1.0 首发的导航阻塞项；若要承诺“无 JS 全站浏览”，需另开
站点层任务决定。
