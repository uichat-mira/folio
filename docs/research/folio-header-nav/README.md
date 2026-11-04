# Folio Header 第一轮整治 · 真实浏览器验证记录

- 分支: `feat/header-nav-megamenu`（基于 `origin/dev` @ `a144b6c`）
- 浏览器: Google Chrome for Testing（Playwright `chromium-1243`，headless），DPR 1
- 复现: `FOLIO_BASE=<地址> node docs/research/folio-header-nav/run.mjs`
- 结论: 右对齐与 Header 视觉/动效按真实浏览器结果通过；**导航信息架构经过两轮返工，
  最终形态是「指南 / 参考」两个普通一级链接**（见第 2 节），官方站点因此不再配置下拉。
  下拉组件本身保留、导出并通过单元测试，只是不再被官方站点使用（见 2.4）。
  静态无 JS 页面仍无顶部导航，属既有缺口，不扩大范围（第 6 节）。

## 1. 环境与复现方式

```bash
npm ci --no-audit --no-fund
npm run build -w @uichat-mira/folio
npm run dev -w apps/site                      # http://localhost:5173/
GITHUB_REPOSITORY=uichat-mira/folio npm run dev -w apps/site   # http://localhost:5173/folio/
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

## 2. 信息架构（三轮返工后的最终形态）

### 第一版错在哪

第一版把原有 8 个顶层入口改造成 5 个下拉菜单 + 3 个普通链接，**目的是让组件有东西可演示**，
分类则是为了填满菜单而重新分配的：「API」里放「Folio 是什么」，「开始」里塞内容维护与运行时
组合，「安装」里混配置参考/构建集成/迁移状态，「开始 / 安装 / 编写 / API」边界互相重叠，
「部署」只是因为需要第五个下拉才被提成一级栏目。

### 第二版错在哪（本次返工的起因）

第二版把 8 个入口收敛成 4 个，其中「文档」是一条下拉，按阅读任务分成 4 组。分类本身站得住了，
但**它仍然是替组件找活干**：读者要看文档，必须先点开一个菜单，再从 12 条里选一条，
而每个目的地本来就是一个自带侧边栏的完整文档视图。下拉在这一步没有增加任何信息，
只增加了一次点击。

对照 VitePress 一类成熟文档站：**「指南」「参考」是普通一级链接，点进去就是各自带左侧目录
与右侧 TOC 的文档视图，不触发任何下拉。**

### 现在的形态

一级导航全部是普通链接，没有下拉、没有折叠箭头：

| 一级入口 | 形态 | 指向 | 侧边栏标题 |
| --- | --- | --- | --- |
| 指南 | 普通链接 | `/guide/introduction` | 指南（11 条） |
| 参考 | 普通链接 | `/reference/overview` | 参考（8 条） |
| 展厅 | 普通链接 | `/showcase` | — |
| 文章 | 普通链接 | `/blogs` | — |
| 项目 | 普通链接 | `/projects` | — |

### 2.1 两半文档怎么分：按内容归属，不按目录

关键发现：**文档侧边栏是按 `doc.collection`（frontmatter）分组的，不是按 `config.collections`。**
没写 `collection` 的页面回落到字面量「文档」，于是返工前全站只有一个 19 条的扁平侧边栏。

因此拆分不需要迁移任何 Markdown 文件，只需给 19 个文档补 `collection:`：

- `指南`：`开始`、`指南 · 入门`、`指南 · 概念`、`指南 · 组合` 四组，11 篇；
- `参考`：`参考 · API`、`参考 · 部署`、`参考 · 迁移`、`维护` 四组，8 篇。

**归属直接采用内容自身的 `group` 前缀**（`指南 ·` / `参考 ·`）。也就是说，这套划分本来
就写在内容里，第二版只是把它藏进了一个下拉；这次是把它提到一级导航，并让它真正决定侧边栏。

边界放在内容里，好处是改导航不必动内容结构，而重命名一个栏目只是导航改动、
不是一次内容迁移——这正是「不扩大范围」的可行解法。

### 2.2 新增 `activeMatch`：一个条目横跨多个路由目录

拆分后暴露了一个真实问题：「指南」的页面同时位于 `/docs/*` 和 `/api/guide/*` 两个目录，
而激活判断默认只看 `href` 前缀。结果是 `/api/guide/content-model` 这类页面上「指南」不亮。

`FolioNavigationItem` 因此新增可选 `activeMatch?: string[]`：额外的路由前缀，命中即视为当前页。

这里刻意**没有**用 `/docs` 这种整目录前缀。第一版实现就是那样，实测立刻暴露缺陷：
`/docs/content-maintenance`（内容是参考类）同时点亮了「指南」和「参考」两个一级条目。
所以改成逐个列出页面——宁可写长一点，也不让一个目录前缀代表两种语义。

`activeMatch` 只影响高亮，不改变渲染形态：带它的条目仍是普通链接。
省略等价于空列表，已有 `{label, href}` 配置不受影响。

> **第四轮补充：这已经不是最终形态。** 下面 2.5 说明了为什么 `activeMatch` 在这批内容上
> 只是止血，以及为什么最终把它从官方站配置里删掉。

### 2.3 实测验证（第三轮记录，路由已变，见 2.6 的当前数据）

| 检查项 | 结果 |
| --- | --- |
| 一级条目形态 | 5 条普通链接，`menuTriggers: 0`、`dropdownPanels: 0`、`chevrons: 0` |
| 点击「指南」 | `/docs/introduction`，侧边栏「指南」11 条，TOC 5 条 |
| 点击「参考」 | `/api/guide/what-is-folio`，侧边栏「参考」8 条，TOC 4 条 |
| 9 条深链接 | 全部 200，`withoutSidebar: 0`、`withoutToc: 0`、**`pagesWithWrongActiveCount: 0`** |
| 客户端路由切换 | header 实例不变（`sameHeaderNode: true`），侧边栏随之替换 |
| 移动端 390/320 | 面板 5 条普通链接，`accordionTriggers: 0`，点击后进入文档视图且面板关闭 |
| 键盘 | Tab 可达「指南」，Enter 进入 `/docs/introduction` |
| `/folio/` base | 全部 `href` 以 `/folio/` 开头，侧边栏 `badSidebarHrefs: 0` |
| 10 档宽度 | 溢出 0，截断 0 |
| 静态（无 JS） | 产物 HTML 中 `folio-docnav__collection` 分别为「指南」/「参考」，各自 4 个 section |

> 上表是**第三轮**（`/docs` + `/api/guide` 双目录）的记录。第四轮改了路由根，
> 同一批断言需要重跑，结果见 2.6。

### 2.4 下拉组件怎么办

官方站点不再配置下拉，但**组件与公开 API 一个字都没删**：

- `FolioNavigationItem.children` / `panel` / `FolioNavigationChild.group` / `activeMatch` 全部保留；
- `resolveFolioNavigation()`、`isFolioNavItemActive()`、`groupEntries()` 继续导出；
- 分组渲染的单元测试继续跑（`header.test.mjs` / `navigation.test.mjs`，189 项全过）。

也就是说，这一轮没有回退任何组件能力，只是把「官方站点是否需要下拉」和
「Folio 是否支持下拉」这两件事分开了。**上一轮的面板几何修正仍然有效**，只是当前官方站点
没有触发器去打开它，因此浏览器脚本不再包含面板交互断言（那段覆盖由单元测试承担）。

### 2.5 第四轮：让路由跟着内容归属走，而不是让组件迁就目录

2.1–2.3 修好了「读者看到什么」，但没有修「结构本身」。第四轮维护者把范围放开：
**允许调整这两个导航下的内容组织和路由**。这一步才解决根因。

**诊断。** 内容归属（`collection`）和 URL 结构在当时是两套彼此矛盾的账：

```text
content/docs/            -> /docs/*        指南 4 篇，参考 1 篇
content/api/guide/       -> /api/guide/*   指南 7 篇，参考 2 篇   <- 一个目录装两种语义
content/api/reference/   -> /api/reference/*  参考 3 篇
content/api/deployment/  -> /api/deployment/* 参考 2 篇
content/pages/           -> 混合
```

`/api` 这个前缀还被部署、附录、设计案例共用。于是「参考」的落地页标题是「API 文档索引」
却住在 `api/guide/` 下，而「指南」的页面又有一半在 `api/` 里。`activeMatch` 之所以需要，
正是因为一个一级入口横跨了两个互不相干的目录——**它是症状，不是解法**。

**做法。** 每个阅读模式一个路由根，四个位置用同一个名字：

```text
content/guide/      -> /guide/*        collection: 指南    config.collections: /guide
content/reference/  -> /reference/*    collection: 参考    config.collections: /reference
```

具体三步：

1. **移动文件**，`git mv` 保留历史：`docs/*` 与 `api/guide/*` 里的指南类进 `guide/`；
   `api/reference/*`、`api/deployment/*`、`api/examples/*`、`api/appendix/*`、
   `api/guide/{what-is-folio,migration-status}`、`docs/content-maintenance` 进 `reference/`。
   `pages/*` 归入各自实际所属的 `showcase/` 与 `reference/`。
2. **删掉 26 个文件的 frontmatter `path:` 覆盖**。留着它们等于允许路由再次和目录分叉，
   这正是漂移的来源；目录即路由之后，`path:` 只在确实需要时使用。
3. **同步引用**：78 处正文内链、`folio.config.ts` 的 `navigation`/`collections`、
   `home-model.ts` 的 3 条精选路径、两份仓库文档与内容维护表。

`activeMatch` 从**逐页清单**（11 条 / 5 条）收缩成**每区一条根前缀**
（`["/guide"]`、`["/reference"]`）。这里踩到一个真实的坑：第一版把 `activeMatch` 全删掉，
以为根目录独立就够了，实测 `pagesWithWrongActiveCount` 立刻从 `0` 变成 **`7`**——
因为 `href` 指向根**内部**的落地页，前缀匹配只覆盖该页自己的子树，
`/guide/content-model` 这类同级页面就什么都不亮。补回一条根前缀后回到 `0`。

教训写进了契约：路由根独立是必要条件，不是充分条件；落地页在根内部时，条目仍要显式声明根。

落地页也随之换了身份：`/reference/overview` 标题改为「参考索引」，只列查证型入口，
把「按顺序读懂」的页面显式指回指南。原「API 文档索引」的标题与位置不匹配，现在两者一致。

**为什么这次不是重做 Header。** 组件、样式、交互、公开 API 一个字没动。第四轮改的是
内容与路由——也就是这轮返工反复指向的那个真问题：**文档的信息架构不应该被组件需求绑架。**


### 2.6 第四轮实测

同一套浏览器脚本，改成新路由后重跑（`results.json`，16 项）：

| 检查项 | 结果 |
| --- | --- |
| 一级条目形态 | 5 条普通链接，`menuTriggers: 0`、`dropdownPanels: 0`、`chevrons: 0` |
| 点击「指南」 | `/guide/introduction`「Folio 是什么」，侧边栏「指南」11 条（开始/入门/概念/组合），TOC 5 条 |
| 点击「参考」 | `/reference/overview`「参考索引」，侧边栏「参考」8 条（API/部署/迁移/维护），TOC 5 条 |
| 9 条深链接 | 全部 200，`withoutSidebar: 0`、`withoutToc: 0`、**`pagesWithWrongActiveCount: 0`** |
| 侧边栏归属 | `{"指南": 5, "参考": 4}`，无一条串区 |
| 客户端路由 | 落到 `/guide/content-model`，`sameHeaderNode: true`，侧边栏仍为「指南」，激活项「指南」 |
| Header 换区 | 点击「参考」后侧边栏整组替换，激活项「参考」 |
| 其它一级入口 | `/`、`/blogs`、`/projects`、`/showcase` 均 200，各自激活正确，无溢出 |
| 搜索 | 8 条结果，跨「指南」「参考」「展厅」命中 |
| 10 档宽度 | 溢出 0、截断 0（1440→320） |
| 移动端 390 / 320 | 5 条普通链接，`accordionTriggers: 0`，点击进入文档视图且面板关闭 |
| `prefers-reduced-motion` | navLink / mobilePanel / themeToggle 全 `0s` |
| 键盘 | Tab 到「指南」，Enter 落到 `/guide/introduction`，侧边栏「指南」 |
| 静态（无 JS） | `folio-docnav__collection` 为「指南」/「参考」，各 4 个 section |

构建产物侧另做了目录级核对：`dist/` 下只有 `guide/ reference/ blogs/ projects/ showcase/`，
旧的 `docs/`、`api/`、`pages/` 目录不再生成；`/guide/` 集合索引 11 条、`/reference/` 14 条；
成百上千个产物 HTML 里已无指向旧站点路由的 `href`（仅剩 3 处指向 GitHub 仓库的
`blob/dev/docs/...` 源码链接，属于仓库路径而非站点路由）。

`npm test` 189/189 通过，`npm run typecheck -w apps/site` 与 `npm run build -w apps/site` 均通过。

## 3. 右对齐

`1440px` 实测：header `64px`；brand 距左 `28px`；右侧功能区距右 `28px`；
导航与按钮区间距 `16px`；水平溢出 `0`。

实现只有一处：`.folio-header__nav` 承接剩余宽度并 `justify-content: flex-end`，
`.folio-header-actions` 去掉原来的 `margin-left: auto`。没有引入新的布局系统。

窄屏逐级收敛，全程无挤压/截断/溢出：`1080px` 收紧内边距与字号并隐藏 `⌘K` 提示 →
`900px` 搜索退化为纯图标 → `780px` 切移动端。

## 4. 交互与视觉

当前官方站点没有下拉，因此这一节的浏览器断言覆盖的是**仍然存在**的交互
（一级链接、客户端路由、移动面板、主题、减弱动效）。下拉面板的交互（悬停/间隙/Escape/
手风琴）现在由单元测试覆盖，见 2.4。

| 检查 | 结果 |
| --- | --- |
| 一级链接 | 5 条，无触发器、无箭头 |
| 客户端路由 | header 同一实例（`sameHeaderNode: true`），激活项随路由更新 |
| 移动面板 390/320 | 5 条普通链接，点击后进入文档视图、面板关闭、无溢出 |
| 键盘 | `Tab` 可达「指南」，`Enter` 进入 `/docs/introduction` |
| 深色模式 | header 绘制像素 `rgb(24, 23, 21)` |
| 浅色模式 | header 绘制像素 `rgb(250, 249, 244)` |
| `prefers-reduced-motion` | 导航链接/移动面板/主题按钮 transition 全 `0s` |
| 搜索 | 仍能命中两侧文档（8 条结果） |

`/` 与 `/folio/` 两种 base 都实测：`/folio/` 下全部 `href` 均以 `/folio/` 开头
（`badHrefs: []`、`badSidebarHrefs: 0`），深链接 200，激活态正确解析。

> 上一轮记录的面板视觉数据（880×450 四列、`top: 244` 对齐、`10.5px` 分组标题等）
> 仍然对组件成立，只是官方站点当前不再渲染该面板，故不列入本轮浏览器实测表。

## 5. 验证中发现并修正的真实缺陷

五项都是真实浏览器/真实构建跑出来的：

1. **移动端首次点击被当成"点击面板外"而立即关闭。** 移动面板是 `header` 直接子节点
   （`fixed`），不在 `navRef` 内，document 级 `pointerdown` 把面板内首次点击判为外部。
   修复前 `childVisible: false`，修复后 `true`。
2. **窄桌面左侧面板溢出视口。** 面板原先相对各自 `<li>` 定位，781–900px 下最左侧面板
   到 `left: -196px`。
3. **顶层入口减少后面板被挤成单列**（见上一轮记录）。这是把导航从 8 条收敛到 4 条才暴露的，
   也说明「面板宽度跟着导航轨道走」这个假设本身是错的。
4. **`activeMatch` 第一版用整目录前缀，导致一个页面点亮两个一级条目。**
   实测 `/docs/content-maintenance`（内容属参考类）同时激活「指南」与「参考」。
   改为显式列出页面后，9 条深链接的 `pagesWithWrongActiveCount` 为 `0`。
5. **第四轮删掉 `activeMatch` 后，7 个页面没有高亮。** 以为「路由根独立」就够，
   实测 `pagesWithWrongActiveCount` 由 `0` 变 `7`：`href` 是根内部落地页，
   前缀只覆盖该页子树，同级页面全灭。改为每个分区声明一条根前缀（`["/guide"]`）后回到 `0`。
   这条写进了消费者契约——根独立是必要不充分条件。

## 6. 未解决 / 不在本轮范围

- **静态（无 JS）页面没有顶部导航。** 预渲染文档页一直只有侧边栏。本次没改这个现状。
- ~~**`docs/`、`api/guide/`、`api/reference/` 三套目录分类交叠。**~~ **第四轮已解决**：
  文件已迁到 `content/guide/` 与 `content/reference/`，`path:` 覆盖已删除，路由跟随目录，
  `activeMatch` 从本站配置中移除。见 2.5。
- ~~**「指南」与「参考」的首屏落地页可以更好。**~~ **第四轮已解决**：落地页改为
  `/guide/introduction` 与 `/reference/overview`（标题「参考索引」，内容已重写为查证型入口）。
- 本轮**没有**做全站信息架构治理：`showcase`/`blogs`/`projects` 的组织未重新评估，
  只把原本住在 `content/pages/` 的两页放回它们实际所属的 `showcase/` 与 `reference/`。
- 本轮**没有**处理跨仓库/外部入链。官方站是全新站点，未发布过旧 `/docs`、`/api` 路由，
  因此不需要重定向层；若将来内容再次搬迁，需要自己承担外部链接失效。
- 只验证了 Chrome。Safari 的 `color-mix()`、`backdrop-filter`、`grid-template-rows`
  动画仍需人工过一遍。
- 未做真实触摸屏物理命中测试，移动端使用 Playwright `hasTouch` + `tap()`。
- 分组列数阈值（874px）与内容条目数绑定。条目显著增多时需要重新评估。
- 官方站点已无下拉触发器，面板几何修正没有站点级回归保护；若将来重新启用下拉，
  需要恢复浏览器脚本中的面板断言。
