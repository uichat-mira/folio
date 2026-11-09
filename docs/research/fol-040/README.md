# FOL-040 Article 分类与标签归档 Core 契约独立验收

[`verify-core.mjs`](verify-core.mjs) 是独立于实现者测试的验收脚本。它不读取
`packages/folio/test/*`，只通过构建后的公共入口 `packages/folio/dist/index.js` 与一个
**仓库外**的 npm tarball 消费者，验证 [#162](https://github.com/uichat-mira/folio/issues/162)
的 Article 分类/标签归档 Core 契约。

```bash
# 在本 worktree 根目录执行；npm 沙箱需要 workspace 内的 cache/logs
export npm_config_cache=$PWD/.npm-cache npm_config_logs_dir=$PWD/.npm-logs
node docs/research/fol-040/verify-core.mjs              # 结果写入 results/acceptance.json
node docs/research/fol-040/verify-core.mjs --skip-consumer  # 跳过 tarball 消费者（快速回归）
node docs/research/fol-040/verify-core.mjs --keep       # 保留临时 fixture / consumer 目录
```

默认会先执行 `npm run build -w @uichat-mira/folio`，因此 PASS 对应的是当前工作区的
真实 `dist`。任何检查失败都会以非零退出码结束，并仍然写出
[`results/acceptance.json`](results/acceptance.json)。

## 被测对象

| 项 | 值 |
| --- | --- |
| 分支 | `feat/folio-article-archives` |
| 被测 commit | `da6202d70c485e7545708fbf8d36ed23cbce8c68`（FOL-040 实现提交） |
| base | `c6ecaef540f33a69ba583680ed0ce02a83e69cec`（origin/dev） |
| 包 | `@uichat-mira/folio@0.1.1` |
| Node | v22.23.2（darwin arm64） |
| 证据脚本 | `docs/research/fol-040/verify-core.mjs` |

`results/acceptance.json#meta.packagedSourcesDirty` 为空，表示 `packages/ apps/site/
schemas/ scripts/` 在打包时没有未提交改动；工作区的未跟踪文件只有本目录证据。
`meta.commit` 是运行时 `git rev-parse HEAD`，因此该 tarball 可由这个 commit 复现
（sha256 见下）。

## 它真实验证了什么

### 1. Markdown → Frontmatter → FolioDoc → Core 归档索引

- 读取官方站全部 **45** 个 `apps/site/content/**/*.md`，对每个文件分别调用
  `parseFrontmatter` 与 `parseFolioDoc`，断言 body 一致、路径/ID 与独立推导的
  `sourcePathToRoute` 一致、旧内容 `category === undefined`、标签解析与旧契约完全一致。
- 旧行为回归：4 篇既有 Article 的路径、标签、搜索结果（按标签与中文标题）、
  `selectFolioCollectionDocs` 集合递归结果不变；给这些文档人工补上 `category` 后集合
  选择结果逐项相同。
- 用 17 个专门构造的 Markdown fixture（14 个基础 + 3 个冲突/无安全字符）覆盖：无分类、无标签、多标签、标签字符串
  `React | Vue`、同一文章内重复标签、中文分类/标签、大小写与空白、空值、
  `category` 数组/对象/数字（非法形态 → 未分类）、`type: doc/page` 排除、
  多 collection 输入范围、日期/`order`/path 稳定排序、重复输入顺序无关、
  输入数组不被改写、显示名 fallback 与 override。
- 冲突与报错：`C++` / `C#` → 同一 slug `c` 必须抛错；`+++` 无 URL-safe 字符必须抛错；
  同一分类 id 的冲突显示名、两个分类落到同一显示名都必须抛错。

### 2. 公共契约与构建产物

- `dist/index.js` 实际导出 4 个函数；`dist/index.d.ts` 含
  `buildFolioArticleArchiveIndex` / `findFolioArticleArchiveGroup` /
  `normalizeFolioArticleArchiveId` / `folioArticleArchiveSlug`、3 个结果类型和
  `FolioArticleArchiveConfig`，签名与实现一致。
- Core 无 React/DOM 证据（三重）：
  1. `src/core/article-archive.ts` 只 import `../types`（类型）与 `./content`，无 DOM 全局；
  2. `dependency-layers` 闸门在真实源码树上通过（56 模块，17 core）；
  3. 用 esbuild 把 `article-archive.ts` 单独打包，metafile 证明依赖图不含
     `react` / `react-dom` / `react-router-dom`，并在全新 Node 进程（无 DOM、无 React）
     中运行该 bundle 得到正确索引。
- Schema：用 ajv 2020 编译 `schemas/content.schema.json`，逐形态对比
  `category` 的 schema 合法性/解析结果（string 有效；空/空白 → 未分类；数组/对象/数字/
  布尔被 schema 拒绝且解析为未分类）；官方站 45 个文件的 `category`/`tags` 字段全部
  符合 schema；`docs/architecture.md` 的描述与实现一致。

### 3. 仓库外真实 tarball 消费者

- `npm pack` 生成 `uichat-mira-folio-0.1.1.tgz`，安装到仓库**外**的临时目录
  （`$TMPDIR/...`），不是 workspace symlink、不是 `file:` 指向源码目录：
  `node_modules/@uichat-mira/folio` 是真实目录，lockfile resolved 是 `.tgz` 路径。
- 消费者只从公共入口 `import { ... } from "@uichat-mira/folio"`，用真实 Markdown
  字符串跑 `parseFrontmatter → parseFolioDoc → buildFolioArticleArchiveIndex`，
  校验分类/标签/未分类结果与显示名 override。
- 消费者用 `tsc -p tsconfig.json`（NodeNext、`skipLibCheck: false`）编译一个使用
  公共函数与类型的 `.ts` 文件，证明 tarball 里的声明可用。
- 安装后的 `dist/index.js`、`dist/index.d.ts` 与本地构建字节一致（sha256）。

## 执行结果

`node docs/research/fol-040/verify-core.mjs`：**41/41 checks passed**（退出码 0）。
完整逐项明细（命令、耗时、tarball sha256、消费者探针输出）见
[`results/acceptance.json`](results/acceptance.json)。

| 阶段 | 检查 |
| --- | --- |
| `package-build-and-public-entry` | dist 存在、公共入口导出 4 函数、声明含 4 函数/3 类型/config |
| `real-content-chain` | 45 文件解析、旧内容无 category、标签/路径/ID/搜索/集合行为不变、旧内容归档索引仅含 Article |
| `markdown-to-archive-index-edge-contract` | 15 项：分组、原始文档引用、排序、顺序无关、显示名 override/fallback/冲突、slug 冲突、无 URL-safe 字符、归一化幂等、find 解析、单分类、多集合范围 |
| `schema-and-docs-consistency` | schema 编译、字段契约、category 形态一致、旧内容字段合规、legacy tags 差异记录、architecture 文档 |
| `core-is-react-and-dom-free` | 源码 import 图、无 DOM 全局、layer 闸门、esbuild metafile + 独立运行 |
| `external-npm-tarball-consumer` | tarball 内容、非 symlink 安装、dist 字节一致、公共入口真实运行、类型解析 |

### Tarball

| 项 | 值 |
| --- | --- |
| 文件 | `uichat-mira-folio-0.1.1.tgz` |
| sha256 | `b1eabb9c85aea7e7cecbe00dcac3757e26e94e00de820d4afdb3e550fd22baf2` |
| 大小 / 文件数 | 96399 bytes packed / 17 files / 386223 bytes unpacked |
| 安装位置 | 仓库外临时目录（evidence run 时由 `mkdtemp` 创建，默认清理） |

## 必跑命令与 release:check

所有命令都在 worktree 根目录执行，并预设
`npm_config_cache=$PWD/.npm-cache npm_config_logs_dir=$PWD/.npm-logs`（否则本机沙箱下
`npm pack`/`npm install` 会因无法写入 `~/.npm/_logs` 失败）。命令、退出码与捕获的输出
尾部记录在 [`results/required-commands.json`](results/required-commands.json)；41 项独立
检查的逐项明细在 [`results/acceptance.json`](results/acceptance.json)。按仓库
`.gitignore` 的 `*.log` 规则，原始日志文件不进入版本库。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck -w @uichat-mira/folio` | 0 | `tsc --noEmit` 通过 |
| `npm test -w @uichat-mira/folio` | 0 | **311/311** tests pass，0 fail / 0 skip |
| `npm run layers:check -w @uichat-mira/folio` | 0 | 56 modules（27 ui / 11 build / 17 core / 1 entry），137 relative edges，0 violation |
| `npm run pack:verify -w @uichat-mira/folio` | 0 | 17 files / 386223 bytes unpacked |
| `npm run release:check` | 0 | 全链路通过 |

上表每项的实际命令、退出码和输出尾部见
[`results/required-commands.json`](results/required-commands.json) 的 `commands` 与
`releaseCheck` 字段（含 release:check 的 pack:consumer 阶段输出尾部）。

`release:check` 实际覆盖：`validate`（仓库 typecheck、包构建、站 typecheck、style
ownership、OG worker test、311 包测试、官方站构建 **50 HTML routes**）→ `pack:verify`
（17 files）→ `pack:consumer`（真实 tarball 安装、三入口声明、Vite 构建、静态路由/
base path/sitemap/robots/feeds/siteIndexing、PWA 与反向证明）。它产出的 tarball
sha256 与本证据脚本一致：
`b1eabb9c85aea7e7cecbe00dcac3757e26e94e00de820d4afdb3e550fd22baf2`。

> `release:check` 的 `source: da6202d… (working tree dirty)` 指的是本目录的未跟踪证据
> 文件；`packagedSourcesDirty` 为空，`packages/`、`apps/site/`、`schemas/`、`scripts/`
> 没有未提交改动。

## 已知边界与未验证项

以下是**未执行**或**明确不在本卡范围**的检查，不得当作通过：

- 本卡只验收 Core 数据契约；归档页面、React 组件、静态 HTML、sitemap/SEO 由
  FOL-041 (#163) 验证。浏览器/视觉证据不在本卡范围内。
- 仓储没有覆盖全部内容的 schema 校验脚本。45 个旧文件中
  `reference/examples/claude.md`、`reference/examples/supabase.md` 的 `description`
  含未加引号的冒号，YAML 解析失败后回退到 loose frontmatter，`order: 62/63` 被读成
  字符串，因此整对象不符合 schema 的 `order: number`。这是 **FOL-040 之前就存在**的
  内容/工具链漂移（两个文件在本分支未改动），与 `category`/`tags` 无关；本脚本把它
  作为独立观察记录，其余 43 个文件整对象通过 schema。
- 旧内容兼容验证覆盖官方站现有 45 个文件；不覆盖下游消费站（Mira 站点）的私有内容。
- `tags` 的 legacy `React | Runtime` 字符串写法：schema 只声明 `string[]`，解析器仍
  接受该旧写法。这是既有契约差异，FOL-040 未改变；脚本显式记录，不视为新增回归。
- 未验证 Windows 路径/构建行为；本机证据为 darwin arm64。
- 未做 npm Registry 发布验证（本任务禁止 publish）。
- `npm run release:check` 的结果见上节；该命令覆盖仓库级 validate、pack:verify 与
  官方 tarball 消费者，但不等同于 FOL-041 的归档页面验收。
