# FOL-041 Article 归档页面与静态发布独立验收

两套独立脚本覆盖 FOL-041 (#163) 的端到端行为。它们不读取 `packages/folio/test/*`：

| 脚本 | 覆盖 | 结果 |
| --- | --- | --- |
| [`verify-site.mjs`](verify-site.mjs) | 官方站（`apps/site`）：Core → React/静态归档、根路径与 GitHub Pages 子路径、SEO、opt-in 差分、浏览器/键盘/无 JS | **32/32 PASS**（[`results/site.json`](results/site.json)） |
| [`verify-consumer.mjs`](verify-consumer.mjs) | 仓库外真实 npm tarball 消费者：非 `/blogs` 双 collection、默认静态路由、noindex、冲突失败、React/静态一致性、公共类型 | **23/23 PASS**（[`results/consumer.json`](results/consumer.json)） |

```bash
# 在本 worktree 根目录执行；npm 沙箱需要 workspace 内的 cache/logs
export npm_config_cache=$PWD/.npm-cache npm_config_logs_dir=$PWD/.npm-logs
node docs/research/fol-041/verify-site.mjs            # 构建包 + 官方站并验收
node docs/research/fol-041/verify-site.mjs --skip-build
node docs/research/fol-041/verify-consumer.mjs        # npm pack + 仓库外安装/构建/浏览器
node docs/research/fol-041/verify-consumer.mjs --skip-build --keep
```

失败会以非零退出码结束；结果 JSON 始终写出。截图写在
[`results/screenshots/`](results/screenshots/)。

## 被测对象

| 项 | 值 |
| --- | --- |
| 分支 | `feat/folio-article-archives` |
| FOL-041 实现 commit | `716f5e4071c397b250fe3b57774b492e2f6cd235`（父 `9df6f4c`） |
| base | `c6ecaef540f33a69ba583680ed0ce02a83e69cec`（origin/dev） |
| 包 | `@uichat-mira/folio@0.1.1` |
| Node / 平台 | v22.23.2 / darwin arm64 |
| 浏览器 | 本机 Google Chrome 156.0.8078.81（headless，DevTools Protocol） |
| Chrome 沙箱注意 | headless Chrome 需 `--disable-crash-reporter --disable-breakpad --no-sandbox`，否则本机 Crashpad 写 `~/Library` 被拒后进程崩溃 |

`results/*.json#meta.packagedSourcesDirty` 为空：`packages/`、`apps/site/`、`schemas/`、
`scripts/` 在验证时没有未提交改动。唯一未跟踪内容是本证据目录。

## 真实验证了什么

### 1. Markdown → Frontmatter → Core → React / 静态 HTML

- 从 `apps/site/content/**/*.md` 独立解析 45 个文档，调用公共 Core
  `buildFolioArticleArchiveIndex` 得到 2 个分类、11 个标签、13 个归档路由，作为**期望值**；
  再与构建产物逐项比对。
- 每个归档页：文件存在、可见条目数、`<title>`、description、canonical、条目标题/链接/
  顺序都与 Core 完全一致；分类行、文章标签链接、集合首页的分类 chip 也逐项一致。
- 官方站 opt-in：`/blogs` 的 4 篇文章声明 category（工程实践 / 内容模型），`Folio` 标签
  同时出现在两个分类下，`/blogs/tag/folio` 的 React 与静态列表都包含两篇文章。
- 浏览器（桌面 1440×900）实际点击分类 chip / 文章标签，`performance.navigation` 保持
  1（客户端路由），DOM 列表与 Core 一致；键盘 Tab 能到达 chip 与 tag link，Enter 激活
  chip 后同样不整页刷新。
- 静态/React 一致性：官方站与外部消费者都在同一路由上比较 React DOM 与静态 HTML 的
  条目、顺序、链接（尾部斜杠差异只在比较时归一化）。

### 2. 静态 HTML → sitemap / SEO / base path

- 官方站根路径构建：**63** 个 HTML route = 既有 50 + 13 归档；sitemap **62** 个
  `<loc>`（排除 404），归档 13 条，route 集合与预期完全相等；robots 指向 sitemap；
  404 保持 `noindex,nofollow`。
- GitHub Pages 子路径：`FOLIO_SITE_BASE=/folio/` 重新构建 63 个 route；归档页 canonical
  为 `https://uichat-mira.github.io/folio/blogs/category/工程实践/`，页面所有内部
  `href/src` 都带 `/folio/`，63 页的全部内部链接都能解析到真实文件；sitemap/robots
  也带 `/folio/`；通过带 base 的静态服务器无 JS 直接抓取归档页返回 200，base 外路径 404。
- CJK URL：静态 href、canonical、sitemap 三处都是**原始 UTF-8**（不是 percent-encoding），
  浏览器请求时按 percent-encoding 访问，服务端解码后命中同一文件；React Link 生成的
  DOM href 也一致。
- `siteIndexing: "noindex"`（外部消费者预览构建）：所有归档页输出
  `<meta name="robots" content="noindex,nofollow">`，canonical 不变，`robots.txt` 保留
  `Allow: /` 但**不再声明 Sitemap**；`sitemap.xml` 仍生成（“不对外声明”是现有契约，
  不是删除 sitemap）。

### 3. Opt-in 差分（captain 要求的高风险探针）

在 HEAD 的临时 git worktree 中仅删除 `/blogs` 的 `archive: true`，重新构建：

| 指标 | archive 开启 | archive 关闭 |
| --- | --- | --- |
| HTML routes | 63 | **50**（既有基线） |
| 新增/删除 route | — | 关闭版没有新增，开启版恰好新增 13 个归档路由 |
| `/blogs` | 分类行 + 条目 tag 链接 | 没有 `folio-archive-row` / `folio-entry-tag` |
| 4 篇文章 | 有 `folio-article-tags` | 没有 |
| sitemap | 含 13 条归档 | 不含任何 `/category/` `/tag/` |
| 其余 HTML | — | 归一化哈希资源名和 GitHub API 头像后，只有 `/blogs` + 4 篇文章不同，其余 **逐字节相同** |

这证明归档是 opt-in，且没有向全局导航注入任何归档入口。

### 4. 构建期冲突（全部真实构建失败）

外部消费者（仓库外、tarball 安装）上观察到：

| 冲突 | 退出码 | 错误 | 是否写入归档页 |
| --- | --- | --- | --- |
| 文档占用归档 route（`/journal/category/工程实践`，type: doc） | 1 | `folio article archive route conflict: "/journal/category/工程实践" … conflicts with document "Colliding doc"` | 否 |
| collection index 占用归档 route（第二个 collection path 等于该 route） | 1 | `… conflicts with collection index "Shadow collection"` | 否 |
| 自定义静态 route 重复归档 URL（`/journal/tag/folio` 两个 route） | 1 | `folio static route conflict: "/journal/tag/folio" ("Tag archive A") and … ("Tag archive B") both normalize to "/journal/tag/folio"` | 否 |

说明：默认静态 route 集由 Folio 生成时，archive-vs-doc / archive-vs-collection-index 在
写盘前失败；当消费者提供自己的 `routes`（官方站就是这种模式）时，重复的归档 URL 由
`static-output` 的 route 冲突层拦截。Core 本身还保证标签 id 唯一、slug 冲突（如
`C++`/`C#`）直接抛错，因此不会生成两条相同 slug 的归档。

### 5. 外部真实 tarball 消费者

- `npm pack` 产出 `uichat-mira-folio-0.1.1.tgz`（17 files，99811 bytes，
  sha256 `68fd00d46dccc7ff0c2cda6388d5d51d0ee9386ef3a3bc79775bde4cc722aad5`），安装到
  仓库**外**的临时目录：`node_modules/@uichat-mira/folio` 是真实目录，lockfile resolved
  是 `.tgz`，不是 workspace/`file:` 源码链接；安装后的 `dist/index.js` 与本地构建字节一致。
- 消费者 collection 为 `/journal`、`/notes`（均 opt-in）与 `/docs`（未 opt-in），
  **完全没有 `/blogs`**。默认静态路由（无自定义 routes）产出 20 个 route，其中 7 个归档：
  `/journal/category/工程实践`、`/journal/category/内容模型`、`/journal/tag/folio`、
  `/journal/tag/git`、`/notes/category/frontend`、`/notes/tag/react`、
  `/notes/tag/中文标签`。
- 在 `/folio-smoke/` base 下构建并起静态服务器：7 个归档页全部可直接 fetch 到（200），
  `/docs` 归档 URL 404，base 外 URL 404；React 客户端页面与静态 HTML 条目/顺序/链接一致
  （共享 tag `folio` 跨两个分类）。
- `tsc`（NodeNext、`skipLibCheck: false`）从 tarball 解析公共 Core 配置/类型与
  `/vite` 类型；消费者用 bare specifier `import "@uichat-mira/folio"` 直接运行成功。
- 未启用归档的既有形态：`/docs` collection 没有任何归档页面、分类行或 tag 链接；官方站
  archive 关闭的差分构建也是 50 route 基线。

### 6. 回归

- 官方站 45 个既有文档 route 全部存在，`<title>` 逐项等于 `文档标题 · Folio`；
  首页、指南、参考的标题/描述不变；文章 URL 未改变。
- 搜索：tag 仍可搜索、分类不进入搜索字段（合成 probe），既有标题搜索仍命中。
- Feed：官方站未配置 feeds，构建产物仍无 RSS/Atom/feeds 文件与 alternate link
  （与 base 一致）；包级 release:check 的 feed 消费者用例继续通过。
- 既有 311 个包测试 + FOL-041 新增测试合计 **331/331** 通过；layer gate 60 模块 0 violation。

### 7. 单一事实源（captain 探针）

- 官方站 `apps/site/src/archive.ts` 只调用公共 Core：
  `buildFolioArticleArchiveIndex`、`selectFolioCollectionDocs`、`folioCollectionIndexes`、
  `normalizeFolioCollectionPath`；没有 `.toLowerCase()`、`.normalize()`、`slugify()`
  等重复归一化实现。
- 包内 React 归档模型与静态归档模型同样只调用 Core 索引；React/static 的分组、过滤、
  中文/大小写处理都来自 `packages/folio/src/core/article-archive.ts`（单一实现）。
- 非阻塞观察（不改变 PASS）：route 路径模板
  `<collection>/<kind>/<slug>` 在 3 处重复（站点、React 模型、静态模型），归档描述文案
  在站点与静态模型重复 2 处；React 与静态各有一套渲染器是不同输出目标的合理分工。
  建议后续抽一个公共 route-path helper，但不构成 FOL-041 缺陷。
- 链接形式观察（低风险）：包内 **默认静态 writer** 生成的归档/条目 href 带尾部斜杠
  （`/journal/alpha/`），默认 React UI 的 `Link` 生成不带尾部斜杠（`/journal/alpha`）；
  两种 URL 都指向同一目录路由，服务端/静态托管都能解析。本验收在 React↔静态比较时
  归一化尾部斜杠，官方站（自定义静态路由）两边则完全一致。若未来要求逐字节一致的
  href，需要统一该约定，但不是当前 FOL-041 的功能缺陷。

## 浏览器截图与可视证据

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| [`desktop-blogs-entrypoints.png`](results/screenshots/desktop-blogs-entrypoints.png) | 1440×900 | `/blogs` 分类行 + 条目 tag 链接 |
| [`desktop-category.png`](results/screenshots/desktop-category.png) | 1440×900 | 分类归档页（React 客户端路由） |
| [`desktop-tag.png`](results/screenshots/desktop-tag.png) | 1440×900 | 跨分类共享标签 `Folio` 归档页 |
| [`desktop-chip-focus.png`](results/screenshots/desktop-chip-focus.png) | 1440×900 | Tab 聚焦到分类 chip |
| [`desktop-nojs-category.png`](results/screenshots/desktop-nojs-category.png) | 1440×900 | **禁用 JavaScript** 直接加载静态分类页 |
| [`mobile-category.png`](results/screenshots/mobile-category.png) | **375×812 CSS px**（DPR 2，图片 750×1624） | 移动端分类归档页，无横向溢出 |
| [`consumer-category.png`](results/screenshots/consumer-category.png) | 1440×900 | 仓库外消费者 `/journal/category/工程实践` React 页 |
| [`consumer-tag.png`](results/screenshots/consumer-tag.png) | 1440×900 | 消费者共享标签 `/journal/tag/folio` |
| [`consumer-nojs-category.png`](results/screenshots/consumer-nojs-category.png) | 1440×900 | 消费者静态页无 JS 直达 |

无 JS 验证同时用 `Emulation.setScriptExecutionDisabled` 的真实 Chrome 与直接 HTTP
fetch 两条路径：静态 HTML 本身就包含完整条目列表，不依赖客户端渲染。

## 必跑命令与 release:check

所有命令在 worktree 根目录执行，并预设
`npm_config_cache=$PWD/.npm-cache npm_config_logs_dir=$PWD/.npm-logs`。按仓库
`.gitignore` 的 `*.log` 规则，原始日志不进入版本库；命令、退出码和输出尾部记录在
[`results/required-commands.json`](results/required-commands.json)。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck -w @uichat-mira/folio` | 0 | `tsc --noEmit` 通过 |
| `npm test -w @uichat-mira/folio` | 0 | **331/331** tests pass，0 fail / 0 skip |
| `npm run layers:check -w @uichat-mira/folio` | 0 | 60 modules（31 ui / 11 build / 17 core / 1 entry），147 relative edges，0 violation |
| `npm run pack:verify -w @uichat-mira/folio` | 0 | 17 files / 403129 bytes unpacked |
| `node docs/research/fol-041/verify-site.mjs` | 0 | **32/32** checks（见 `results/site.json`） |
| `node docs/research/fol-041/verify-consumer.mjs` | 0 | **23/23** checks（见 `results/consumer.json`） |
| `npm run release:check` | 0 | 全链路通过：331 tests、63 HTML routes、17-file tarball、完整 tarball consumer |

命令、退出码与输出尾部见
[`results/required-commands.json`](results/required-commands.json)。

`npm run release:check` 覆盖仓库 typecheck、包构建/类型、style ownership、OG worker、
331 个包测试、官方站 63 HTML routes、pack:verify（17 files）与完整 tarball consumer
（三入口、类型、Vite 构建、static routes/base/sitemap/robots/feeds/siteIndexing、PWA）。
其产出的 tarball sha256 与本验收 tarball 一致（见上）。

## 已知边界与未验证项

以下明确**未验证**或不在 FOL-041 范围，不作为通过依据：

- 只验证 Chromium（本机 Chrome 156），Firefox/Safari 未验证。
- GitHub Pages 真实部署未执行（禁止 deploy）；子路径证据来自本地
  `FOLIO_SITE_BASE=/folio/` 构建 + 带 base 的静态服务器。CDN/托管平台缓存差异未覆盖。
- 未验证真实下游消费站（Mira 网站）迁移；只用官方站 + 独立 tarball 消费者。
- 归档页分页、标签云、多选过滤、分类层级/树、自动导航注入都不在 FOL-041 契约内，未实现也
  未验证。
- `siteIndexing: "noindex"` 的语义是“页面级 noindex + robots.txt 不声明 sitemap”；
  `sitemap.xml` 仍会生成（本地文件，不被 robots 宣告）。若未来要求“noindex 时删除
  sitemap”，需要单独契约。
- 自定义 `staticRoutes.routes` 的消费者自己拥有页面集合；archive-vs-custom 冲突只在
  “同一条归档 URL 被重复写出”时由静态 route 冲突层拦截，不存在“默认归档自动合并进自定义
  routes”的路径（公共 API 不提供这种合并）。
- React 模型自身的冲突保护（`buildFolioArticleArchiveModel` 的 `claimArchive`）由包测试
  覆盖；本验收的冲突证据走真实构建失败（静态层），未额外构造浏览器内 React 冲突运行。
  由于该函数不在公共 barrel 中，外部消费者无法直接触发它。
- 未验证 Windows 构建行为；未覆盖 20 万级文档规模/性能。
- 标题/description 文案是契约的一部分（测试按当前中文文案断言）；若产品要改文案，应同步
  更新验收期望。
