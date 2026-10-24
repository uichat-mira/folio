# Folio 工程治理设计稿（Draft v0.3）

> **状态**：讨论成果整编稿，待维护者审阅；不是施工授权或发布批准  
> **日期**：2026-10-24  
> **本次修订**：Draft v0.3 — 修复 PR #54 审查中的施工与发布顺序风险；34 张规划基线（9 已有 + 25 候选），另有 3–4 张条件性预留；不授权建卡或发布。  
> **目标仓库**：[`uichat-mira/folio`](https://github.com/uichat-mira/folio)  
> **核对基线**：`dev`（`559a62c26bdd3fb4e9455c6008031c1b613ed10c`）；变更执行前重新确认分支状态  
> **项目文档路径**：`docs/engineering/folio-governance-design.md`（Draft，须经过维护者审阅后才能作为冻结设计）

## 1. 目的与完成定义

Folio 是面向外部消费者的 **Git-native、Vite/React 友好的 npm 内容与发布产品**。官网只是一个消费者，但**Folio 随包提供的默认 UI 必须漂亮、可靠、易用**，不能把美观责任完全推给消费者。

本轮治理有四项结果：

1. **代码卫生显著改善**：目录反映职责，依赖单向，移除确认无用的迁移遗留与重复实现；保持既有行为和公开契约。
2. **发包便捷性显著改善**：版本准备、真实 tarball 消费检查、候选发布和正式发布各有可执行入口与失败诊断，复用既有 GitHub Release → npm Trusted Publishing 工作流。
3. **Core / UI / Build 与内置 / 扩展职责明确**：内容模型与运算、默认交互和样式、构建适配分界清楚；消费者可以采用默认成套 UI，也可以安全组合局部能力。
4. **为视觉治理打基础**：组件拥有样式，默认组件的视觉和交互达到可验收基线；CSS Token 和扩展接口稳定，独立消费者无需覆盖私有 DOM 才能实现品牌。

**项目退出标准**：在不修改 Folio 私有源码、不做脆弱 CSS 内部选择器覆盖的条件下，独立消费工程可以安装打包产物、运行默认界面、定制品牌并构建静态页面；维护者能按简明指南完成一次可追溯的发布候选验证。

## 2. 决策原则与非目标

### 已达成的方向

- 以 **单个 `@uichat-mira/folio` npm 包**为当前发布单位，**先做包内 Core / UI / Build 分层和目录治理**，不先拆多个 npm 包。
- **Core / UI 划分不是只移动文件**；但目录结构本身同样是必须治理的工程质量。
- **默认 UI 是产品能力**：默认首页、文档布局、阅读、搜索、移动端和深浅色不能粗糙到迫使使用者一开始就重做。
- **样式随组件归属**，提供受控默认样式入口和可覆盖的公开 Tokens；消费者自己的品牌和页面排版由消费者负责。
- 保持当前公共入口和已有 API 兼容，演进采用添加与验证优先；不要以“更纯粹”为名造不必要的大迁移。
- 借鉴 Fumadocs 的 Core/UI 边界、Starlight 的渐进定制、VitePress 的轻量主题覆盖；**不照搬**庞大插件系统或提前引入 Theme Engine。

### 非目标

- 本轮不重做 Folio 官网视觉，不统一所有 Mira 站点的设计语言；官网重设计留到工程治理完成后。
- 不新增多套主题产品、通用 CMS、插件市场、多包独立版本体系。
- 不为了文件数量好看而逐个按钮、每个 CSS 属性都分文件。
- 不在治理中自动迁移 Mira 文档站或 `tomzlab-web`，不在未授权情况下推进 `test → prod` 或发布 npm。
- 不借治理范围重写 Markdown 解析器、React Router 或现有内容模型；发现具体契约缺陷时独立建小卡。

## 3. 已核实的当前工程现状（2026-10-24）

| 位置 | 现状与问题 |
| --- | --- |
| `packages/folio/src/` | 17 个源码文件平铺，包括 `app.tsx`、`docs-shell.tsx`、`static.ts`、`vite.ts`、`types.ts`、`styles.css`；难以从目录看清所有权。 |
| `packages/folio/src/styles.css` | 约 1,058 行，含全局 `:root`、`*`、`body`、`a`、`button,input` 样式；组件样式集中、可影响宿主页面。 |
| `apps/site/src/main.tsx` | 官方站引入包样式、`site.css`、`showcase.css`、`legacy-claude-visual.css`；`site.css` 还覆盖 `.folio-*` 公共组件内部选择器。必须确认覆盖是否为必要 API 缺口。 |
| `types.ts` | 数据模型 `FolioDoc` 与 React `ReactNode` 类型相关的 `FolioSlots` 同文件。 |
| `static.ts` / `docs-shell.tsx` | 静态 HTML 和 React 页面有各自的导航/TOC/分页呈现；已有 `docs-structure.ts` 共享部分导航数据，但表示契约与回归仍待审查。 |
| `app.tsx` | `FolioApp` 自建 `BrowserRouter`，并把主题状态写到 `document.documentElement`；嵌入已有 Router 的场景需要界定，而不是默认承诺支持。 |
| package `exports` | `.`、`./vite`、`./styles.css` 三个公开入口；根入口同时导出 Core 运算和 React UI。 |
| `verify-package.mjs` | 使用 `npm pack --dry-run` 检查包清单；当前没有已证实的、隔离目录安装实际 `.tgz` 后运行 Vite 的完整消费验证。 |
| `.github/workflows/publish.yml` | 已存在 GitHub Release 触发、版本/tag 校验、`prod` 提交血统校验、npm 11 + OIDC Trusted Publishing、已有版本跳过。不能把它描述为“还没发布系统”。 |

**消费者证据**：`apps/site` 使用本仓库 workspace 依赖；`uichat-mira/uichat-mira-docs@prod` 仍依赖前身 `@uichat-mira/docs`；`uichat-mira/tomzlab-web@dev` 目前为独立 HTML/CSS 静态工程，不是 Folio 消费者。GitHub Folio Releases 在本次查询为空；**npm Registry 发布状态需单独核验，不能仅凭 Releases 推断**。

**已发现的独立风险**：静态路由的输出路径穿越、重复路由覆盖、Markdown 原始 HTML 的信任边界。分别按既有问题卡处置，不与目录治理/视觉任务混为一张。

## 4. 目标边界与模块归属

### 4.1 依赖原则

- `core/`：纯内容/数据/语义能力；不得依赖 React、DOM、组件 CSS 或 Node 文件写入 API。Markdown → HTML 语义转换属于内容变换，但其 HTML 信任策略必须另行明确。
- `ui/`：React 默认组件、布局、交互、状态、样式；可以使用 Core；**默认 UI 本身必须达到可发布的审美和交互基线**。
- `build/`：Vite 内容发现、静态页/SEO/文件产物；依赖 Core；不依赖浏览器 UI 状态、品牌 CSS。静态输出中的导航与 TOC 使用共享语义契约和稳定样式类名。
- `apps/site/`：仅官方站品牌、首页结构、案例内容和站点局部样式。官网特例不得反向污染 npm UI。
- **依赖方向**：`ui → core`；`build → core`；`consumer → public exports`。必要的静态 HTML 外观契约由 UI 与 Build 共用的文档规则明确，而非互相复制不一致的逻辑。

### 4.2 推荐目录（草案，不是机械搬迁清单）

```text
packages/folio/
  src/
    core/
      content/       # Frontmatter、FolioDoc、slug、heading IDs
      markdown/      # Markdown 语义转换及兼容规则
      navigation/    # collections、neighbors、目录模型
      search/        # 与视觉无关的搜索逻辑
      config/        # 路径与站点配置规则
    ui/
      app/           # 默认 App 和路由组合入口
      components/
        header/      # Header.tsx + Header.css
        docs-shell/  # DocsShell、DocNav、Toc、Pager + CSS
        search/      # 搜索界面与交互 + CSS
        markdown/    # FolioMarkdown、代码/Mermaid 增强 + CSS
        share/       # 分享按钮 + CSS
      styles/
        tokens.css   # 公开主题变量
        base.css     # 作用域明确的组件基础规则
        index.css    # 默认样式聚合入口
    build/
      vite/          # Vite plugin、manifest adapter
      static/        # route writer、SEO、静态 HTML 呈现
    index.ts         # 兼容既有根入口
    vite.ts          # 兼容既有 /vite 入口
```

**注意**：目录深度和文件数量以模块真实复杂度为准。例如静态输出可以将 `route writer` 与 `SEO` 分开，但不能为了分类而建立十几个无意义薄包装。共享语义数据模型应有唯一实现，不强迫 React 与无 JS 静态 HTML 共用同一个 renderer。

### 4.3 模块归属映射

| 现文件 | 初步归属 | 改造注意 |
| --- | --- | --- |
| `content.ts`, `heading-ids.ts` | `core/content` | 标题 ID 算法、路由规则保留测试 |
| `markdown.ts` | `core/markdown` | HTML 与高亮的信任/输出契约需独立评审 |
| `docs-structure.ts` | `core/navigation` | 继续作为静态和 React 的共享语义源 |
| `search.ts` | `core/search` | 搜索算法与 SearchDialog 分开 |
| `config.ts` | `core/config` | 保留 root public exports |
| `app.tsx` | `ui/app` + 拆出局部 UI | SearchOverlay、Home、NotFound 不应永远集中于主壳 |
| `header.tsx`, `docs-shell.tsx`, `share.tsx`, `markdown-react.tsx`, `icons.tsx` | `ui/components/*` | 仅提取已存在的独立组件职责，不制造大型组件系统 |
| `static.ts` | `build/static` | 将文件写入/SEO 与静态文档表示职责解耦；保留共享类名契约 |
| `vite.ts` | `build/vite` + 兼容子入口 | 旧 `@uichat-mira/folio/vite` 保留 |
| `types.ts` | Core 类型与 UI 类型分离 | 继续由现有根入口 re-export，确保 TS 类型兼容 |
| `styles.css` | `ui/styles` 与相应组件 CSS | 对消费者保留既有 `/styles.css` 聚合入口 |

## 5. 默认 UI、组件与 CSS 治理

### 5.1 质量要求

默认 UI 不只是 fallback：无需站点级覆盖即可在桌面/手机上正常阅读、搜索、切换主题和导航；视觉有一致的排版尺度、颜色对比、留白、焦点态与响应式行为。**最终视觉是否达到“可直接使用”，需要维护者在浏览器进行真人验收**；单靠截图像素断言或 CI 无法代替审美验收。**组件 CSS 施工之前**必须通过不加载官网覆盖样式的最小演示，留存桌面/移动、亮/暗、文档长文和交互状态的基线；其后逐组件比对，末尾再次真人验收。

### 5.2 样式所有权

1. 样式随组件或明确的共用视觉层维护。`Header` 管 Header 规则，`DocsShell` 管阅读布局，`MarkdownView` 管内容排版。
2. 公共主题变量 (`--folio-*`) 是有兼容承诺的定制入口；普通 `.folio-*` DOM 层级和私有选择器不承诺随版本稳定。哪些类名必须用于静态 HTML 输出，列为**内部双渲染契约**并有回归检查。
3. 单独引入 `FolioMarkdown` 等局部 UI 时不能全局修改宿主 `body`、链接、按钮、背景。完整 `FolioApp` 可通过组件根节点拥有自己的基线；官网自身负责 `body` 等站点级样式。
4. 深浅色状态尽量作用域化；现行 `document.documentElement.dataset.folioTheme` 是宿主副作用，变更需保留默认整站兼容并检查独立嵌入行为。
5. 默认样式通过一个受支持的 `@uichat-mira/folio/styles.css` 聚合入口提供，内部可以拆组件 CSS 文件，消费者不必手工拼导入顺序。**迁移任何组件 CSS 之前，必须先完成聚合产物构建与回归门禁**；当前 `copy-styles.mjs` 只复制单一 `src/styles.css`，直接分散 CSS 文件会有打包漏样式风险。聚合门禁必须检查实际打包后的 CSS 内容与加载顺序，不仅断言 `dist/styles.css` 文件存在。
6. 不直接全量切换 CSS Modules：静态 HTML 与 React 同时使用 `folio-*` 类名，先以共享样式合同验证再决定局部适用范围；CSS-in-JS 与全新 Theme Engine 不列入当前范围。
7. `legacy-claude-visual.css` 先核实页面依赖，不能凭文件名直接删除；如属于官网案例，则继续留在 `apps/site`。

### 5.3 最小视觉/兼容验收矩阵

| 场景 | 必验收行为 |
| --- | --- |
| 默认首页 | 无官网附加 CSS 的默认组件有合理版式和主行动入口 |
| 文档阅读 | 长文、标题层级、代码块、表格、TOC、上一篇/下一篇正确且可读 |
| 窄屏 | Header 导航、抽屉、TOC、搜索能操作，无横向溢出或被遮挡 |
| 主题 | 浅/深色 Token、生效范围、代码和 Mermaid 对比度 |
| 静态 HTML | 禁用 JS 时主体可阅读，导航/目录/SEO 正确，类名仍有默认样式 |
| 嵌入消费者 | 使用局部组件不改变宿主全局 body/link/button；覆盖公开变量即可换品牌 |

## 6. 公共 API 演进策略

### 6.1 冻结现有公开入口

- `@uichat-mira/folio`：保留现有命名导出和类型。
- `@uichat-mira/folio/vite`：保留 plugin 与静态构建导出。
- `@uichat-mira/folio/styles.css`：保留默认样式入口。

### 6.2 候选新入口（需打包 POC 才可正式采纳）

- `@uichat-mira/folio/core`：不依赖 React/DOM 的内容与结构 API。
- `@uichat-mira/folio/ui`：React UI 组件与默认 App。

不因为内部创建了 `core/` 和 `ui/` 目录，就自动将目录作为公共子路径。只有当独立消费验证表明有实际收益、且 TypeScript/ESM/export map 均正确时才发布。不能默默撤销既有根入口。单独评估 React 运行时被纯 Core 消费者不必要拉入的问题，优先以入口与打包分离解决。

### 6.3 扩展能力合同

| 能力 | Folio 默认责任 | Consumer 可定制边界 |
| --- | --- | --- |
| 内容模型、Frontmatter、路由数据 | 标准解析、排序、ID 与数据契约 | 内容源、字段值和业务用途 |
| Markdown | 可读、可访问、稳定标题/代码/Callout 输出 | 输入内容；原始 HTML 权限待信任研究冻结 |
| 文档导航/搜索 | 可用的默认视图与纯数据方法 | 导航数据、按公开 Slots/Props 替换页面结构 |
| Header、DocsShell、Share | 高质量默认组件与交互 | 公开配置、Slots、主题 Tokens、必要时显式组件替换 |
| 样式 | 完整默认视觉与稳定主题变量 | 视觉品牌、首页、局部布局与站点特有 CSS |
| 构建、SEO、静态发布 | 标准 Vite/static output 约定与错误语义 | 配置、路径映射、站点 metadata、部署目标 |

`FolioApp` 当前自建 Router，`FolioHeader`/`FolioDocsShell` 依赖 Router Context。**可嵌入模式是否需要显式无 Router 的壳组件**，先做小型真实消费 POC，不能提前以“万能兼容”增加复杂 API。

## 7. 发版与 npm 便利性治理

### 保留的既有事实

工作区已有 `npm run release:check`；`publish.yml` 从 GitHub Release 发布事件触发，验证 tag 与 package version、tag commit 属于 `prod`、npm 已发布版本跳过，并使用 OIDC/Trusted Publishing。已有发布工作流应作为基础，不重复造轮子。

### 目标流程

```text
feat/*：提交版本号 / lockfile / 变更说明
    │
    ├─ CI / release:check + 真实 .tgz 独立消费验证
    ↓
  dev → test → prod （同一候选版本沿晋级链进入 prod）
                    │
        只读复核版本、tag 名、prod 提交血统
                    │
          维护者批准 tag / GitHub Release
                    │
         正常发布：现有 publish.yml → OIDC/npm
                    │
             回读 Registry 版本与产物

仅在 Registry 确认包名尚未首发时：
    已批准的 prod 候选 → 维护者授权一次性 bootstrap
    → 配置 Trusted Publisher → 后续全部使用正常发布链
```

### 实施边界

- **版本准备（晋级之前）**：版本号、lockfile、变更说明等需落库的修改必须在 `feat/*` 候选提交，并经 `dev → test → prod` 晋级。工具校验 package/workspace version 一致、变更说明与约定 tag 名；进入 `prod` 后不再临时改版本，只做只读复核与授权发布。重大版本变更仍由维护者决定。
- **打包验证**：实际生成 `.tgz`，在非 workspace 临时目录安装；验证 ESM、类型、`/vite`、CSS、内容虚拟模块、Vite 构建和静态 HTML。
- **发布门禁**：保留 Linux 和 Windows 验证，不降低现有 `release:check` 要求；必要的真实消费者测试接入相关门禁，但避免重复跑昂贵步骤。
- **发布故障**：失败需在日志指出版本、步骤和可重试条件；不靠禁用测试、绕过 OIDC 或临时手动 token 来“修绿”。
- **正式发布**：对于**已建立的 npm 包且 Trusted Publisher 已配置完成**，继续以 `prod` lineage 的 GitHub Release → OIDC 作为正常发布路径；发布后核验 Registry 产物，不能以“工作流绿色”替代 npm 真实状态。
- **首次 bootstrap 条件例外**：先通过 npm Registry 原始查询（例如 `npm view @uichat-mira/folio versions --json --registry=https://registry.npmjs.org/`）确认包是否存在，记录查询时间和结果。若包已存在，不执行手动首发；若经核实尚未发布，则仅允许按 `docs/publishing.md` 的首次 bootstrap 契约，使用**已审核的 `prod` 候选**、经维护者单独授权建立包与配置 Trusted Publisher。查询失败或无法确定时禁止把“未知”当“未发布”，也不得用手动发布绕过正常工作流。
- **工具选择**：暂不引入 Changesets/Release Please；如果版本维护实际复杂度显著上升，再另立小型研究任务比较收益。

## 8. 治理阶段、执行和退出门槛

### Phase A · 基线与风险止血

**交付**：归属清单、公共 API 快照、CSS 所有权清单、`dev` 检查基线；**默认 UI 无官网覆盖样式的视觉/交互基线**；独立解决路径越界/重复路由，Markdown 安全先冻结信任模型。

**门槛**：可从源码、测试和版本证据判断现状；不开始大规模目录重排前明确公共接口保持不变。

### Phase B · Core/UI/Build 与目录治理

**交付**：按实际职责重组目录与类型，抽出 `app.tsx` 中已经稳定的独立模块，`static.ts` 解除文件写入与页面表现的无谓混合；内部 import 规则和公开导出检查。

**门槛**：现有 package API、文档导航、静态 HTML、官网 reference site 行为回归通过；一次只动一个边界，禁止大爆炸式重写。

### Phase C · 组件与默认样式治理

**交付**：**先实现 CSS 聚合构建与发行产物门禁**，再逐组件迁移样式、收敛受控 Token 与宿主作用域，消除可证实的全局污染；维护 Phase A 的默认 UI 演示并执行最终视觉验收；验证静态/React 共用类名的合同。

**门槛**：默认 UI 桌面/移动、浅/深色、无 JS 静态阅读验收通过；嵌入者可通过公开 Token/Props 定制，不依赖官网私有覆盖；维护者真人视觉验收。

### Phase D · 发包与消费者证据

**交付**：真实 tarball 独立安装和最小 Vite/静态构建检验、**晋级前**版本准备指南、正常 Release/OIDC 与条件性首发 bootstrap 的决策文档、发布后 Registry 回读与故障排查说明。

**门槛**：可复现独立消费与发布候选验证；CI 证据精确到 SHA/版本；正式发布依然需要明确授权。

### Phase E · 试点与验收

**交付**：使用最小独立消费者验证默认 UI 与品牌覆盖；可选择在明确批准后评估 `tomzlab-web`，但不能强迫其从纯 HTML/CSS 迁移成 React 工程。

**门槛**：实现新的品牌表达不要求修改 Folio 私有源码；独立消费者回归留存。官网视觉全面再设计作为**后续独立项目**。

阶段是验收顺序而非一张卡一个阶段；可并行的小任务必须在依赖清楚的前提下单独派工。每卡一个可独立回退的结果，限制 Worker 执行范围；34 张仅是浮动规划基线，不是刚性卡数或交付时间承诺。

## 9. 工作项规模评估与任务卡调整（Draft v0.3）

### 9.1 修订口径：34 张规划基线，条件性预留 3–4 张

本次根据 [PR #54 审查意见](https://github.com/uichat-mira/folio/pull/54#pullrequestreview-5637036812) 校正工程依赖和工作量：B2 由一个跨多模块巨卡拆成三个小边界；组件 CSS 搬迁前增加独立的**聚合构建产物合同**和**默认视觉初始基线**。不能为了维持数字 30 而制造大卡。

| 工作组 | 已有 Issue | 新候选工作项 | 规划合计 | 范围 |
| --- | ---: | ---: | ---: | --- |
| A · 基线与风险止血 | 4 | 1 | **5** | 现状、API 证据与安全风险 |
| B · Core/UI/Build 与目录 | 1 | 10 | **11** | 类型、纯逻辑、UI、静态呈现和依赖 |
| C · CSS 组件化及默认 UI | 1 | 10 | **11** | 视觉基线、聚合门禁、样式归属、主题和最终验收 |
| D · npm 发布和独立消费 | 3 | 4 | **7** | 实际 tarball、版本、OIDC 与品牌试点 |
| **总计** | **9** | **25** | **34** | 尚未分配新增正式编号 |

**34 张仍是浮动预算，不是必须创建 25 张新 Issue 的命令。** 此外保留 **3–4 张仅在研究结果证明必要时才可能追加的条件项**，所以目前资源规划视作**约 34–38 张**；研究也可能让任务取消、缩小、合并。不得从工作项数量推算执行工时或并发 Worker 数。

### 9.2 现有 9 张保持原 Issue 归属

| 领域 | Issue | 处置 |
| --- | --- | --- |
| A | [FOL-001](https://github.com/uichat-mira/folio/issues/45) | 静态路由 outDir 防越界；保留并单独验证 |
| A | [FOL-002](https://github.com/uichat-mira/folio/issues/46) | 重复路由拒绝；保留并单独验证 |
| A | [FOL-003](https://github.com/uichat-mira/folio/issues/47) | Markdown 原始 HTML 信任边界研究；结论先于后续施工 |
| A | [FOL-006](https://github.com/uichat-mira/folio/issues/50) | npm 与消费者迁移状态文档；以实际 Registry 和依赖核实 |
| B | [FOL-008](https://github.com/uichat-mira/folio/issues/52) | 静态 HTML / React TOC 与导航行为对照；不顺手重写 |
| C | [FOL-007](https://github.com/uichat-mira/folio/issues/51) | 宿主 CSS 污染研究；不在研究卡中执行组件迁移 |
| D | [FOL-004](https://github.com/uichat-mira/folio/issues/48) | 真实 tgz 安装、根入口/Vite/CSS/类型基线；消费 fixture 所有者 |
| D | [FOL-005](https://github.com/uichat-mira/folio/issues/49) | 复用 004 fixture，验证 virtual module |
| D | [FOL-009](https://github.com/uichat-mira/folio/issues/53) | 复用 004/005 fixture，验证静态文件产物 |

已存在的 Issue 不作废、不重建、不预先修改合同；复用同一独立消费 fixture，不为 004/005/009 三次复制。

### 9.3 新增 25 张候选，按独立验收结果组织（尚未创建正式 Issue）

以下 `A1/B1/C0…` **仅是本文规划代号，不是组织任务 ID**；不得据此占用正式 `FOL-NNN`。建卡前先核实是否已被现有 Issue 覆盖。

#### A · 基线（1 张）

| 代号 | 单卡交付与验收 |
| --- | --- |
| A1 | 模块所有权、依赖方向、现有根入口导出、公共 CSS 覆盖面清单；逐项标明 Core/UI/Build/Consumer 归属与证据。仅冻结现状，不执行重构。 |

#### B · Core/UI/Build 与目录（10 张）

| 代号 | 单卡交付与验收 |
| --- | --- |
| B1 | Core 数据类型与 React Props/Slots 类型分离；原根入口 TS 签名保持兼容。 |
| B2a | `content.ts`、`heading-ids.ts` 及依赖它们的 `docs-structure.ts` 归位 Core；标题 ID、排序和相邻篇语义不变。 |
| B2b | `markdown.ts` 与关联纯 Markdown 转换逻辑归位；已有 HTML/Callout/代码块输出保持。 |
| B2c | `search.ts` 与 `config.ts` 这两个小型纯功能模块归位；搜索结果、base path 与公开签名保持。若依赖图证明不能作为一个原子单元，建卡前继续拆分。 |
| B3 | 从 `app.tsx` 拆出 SearchDialog 状态与组件；键盘行为、关闭与路由跳转不变。 |
| B4 | 从 `app.tsx` 拆出 Home/NotFound；默认路由和 consumer `slots.home` 兼容。 |
| B5 | 从 `docs-shell.tsx` 拆出 DocNav/TOC/Pager；沿用已共享的导航数据语义，移动端和 React 阅读行为保持。 |
| B6 | `static.ts` 的文件写入、路由安全和 SEO/meta 职责分离；产物与原有安全回归不变。依赖 FOL-001/002 收口。 |
| B7 | 静态文档导航/TOC/Pager HTML 输出归属清晰化，与 React 共享语义/类名契约；依赖 FOL-008 对照基线。 |
| B8 | Vite Adapter 目录和 Core/UI/Build 单向依赖检查收口；现有 `/vite` 入口及 CI 有效。 |

#### C · 组件 CSS 与默认 UI（10 张）

| 代号 | 单卡交付与验收 |
| --- | --- |
| C0 | **改造前**建立不加载官网 `site.css/showcase.css` 的最小默认 UI 演示和对照记录：桌面、手机、亮/暗、长文、导航、搜索、无 JS 阅读；产物供后续每张组件卡比对，未通过处记录为基线缺口，**不提前声称已改善默认视觉**。 |
| C1 | 受控主题 Tokens、Folio 根节点作用域与全局 CSS 污染边界设计/治理；独立宿主页不被局部 UI 修改 `body/a/button`。依赖 FOL-007 结论。 |
| C2 | Header 自有 CSS 与状态样式：桌面/移动、焦点与主题可验收；不改变既有公有组件 Props。 |
| C3 | DocsShell/DocNav/TOC/Pager CSS 归属与阅读布局、窄屏样式；静态/React 仍共享必要的类名。 |
| C4 | MarkdownView 的标题、代码、表格、Callout、Mermaid 样式归位；默认阅读体验在两种输出下不退化。 |
| C5 | SearchDialog/Share 默认样式归位，焦点、弹层层级和移动适配正常。 |
| C6a | **所有 C2–C5 之前的硬前置**：建立组件样式聚合/打包能力；`@uichat-mira/folio/styles.css` 导出不变，构建后 CSS 内容、依赖顺序及真实发布产物在回归中得到验证。不得只检查 `dist/styles.css` 文件存在。 |
| C6b | 所有组件迁移完成后，完成静态 HTML 所需类名与 CSS 聚合兼容回归；验证 React 与无 JS 静态页内容/外观不丢失。 |
| C7 | 清理官网对包内私有 `.folio-*` 选择器的不必要覆盖；官网特殊样式继续归 `apps/site`，不强求官网改版。 |
| C8 | **最终**默认 UI 真人视觉和交互验收；对照 C0 基线、公开 Tokens 的品牌覆盖、手机和桌面深浅色、无 JS 静态输出。独立重大缺陷回到对应组件卡或另开缺陷卡，不把所有返工塞进 C8。 |

#### D · npm 发布与独立消费（4 张）

| 代号 | 单卡交付与验收 |
| --- | --- |
| D1 | 治理前后公共 API、TS 声明和现有导出兼容测试；`/core`、`/ui` 候选子入口只在真实 tarball 试验证明收益后另行批准。与 FOL-004 初始安装检查不重复。 |
| D2 | **晋级前**版本准备：在候选分支提交 package/workspace version、lockfile 与 changelog；经过 `dev → test → prod`，进入 prod 后只读检查 tag/版本/提交血统，不在 prod 临时改版本。 |
| D3 | 发布结果回读、Registry 实际版本和产物验证及故障诊断；先检查包名是否已存在，区分**受控首次 bootstrap**和正常 Release → OIDC 流程。不得因 Registry 查询失败而手动尝试首发。 |
| D4 | 非 workspace 独立消费者展示默认 UI 与公开 Tokens 的第二套品牌；保存安装、构建、浏览器证据，不强迫迁移 `tomzlab-web`。 |

### 9.4 不提前建卡的 3–4 项条件性工作

| 条件性工作 | 启动前证据 |
| --- | --- |
| 非可信 Markdown HTML 的防护或拒绝策略实现 | FOL-003 已提供风险复现和信任模型决定 |
| 在宿主 Router 中嵌入 Folio 的新 API | 真实消费者证明当前组件组合无法满足 |
| 新增 `/core`、`/ui` 公开入口 | D1 给出独立 tarball、类型、peer dependency 与兼容验证收益 |
| 非预期 UI/a11y 缺陷 | C8 出现当前组件卡之外的独立可复现缺陷 |

研究若结论为无需变更，相关条件卡就不成立。

### 9.5 依赖关系与派工规则（修订）

```text
A1 ──→ B1 → B2a → B2b/B2c
   ├─→ FOL-008 → B5 / B7
   ├─→ FOL-007 → C1
   └─→ C0（默认 UI 前置视觉基线）

C6a（CSS 聚合打包门禁）──────────────┐
C0（视觉基线）＋ C1（主题作用域）──────┤→ C2/C3/C4/C5
                                      ↓
                              C6b（双渲染样式合同）
                                      ↓
                              C7（官网私有覆写收口）
                                      ↓
                              C8（最终 UI 真人验收）

FOL-001 / FOL-002 → B6
FOL-004（tgz fixture）→ FOL-005 → FOL-009
B/C 结构稳定 + FOL-004 → D1（API 终验）
D2（feat 中版本提交，经 dev→test→prod）→ D3（发布回读）
FOL-004/005/009 + C8 → D4（品牌消费试点）
```

**首批仅选择约 6–8 张具备依赖的卡**，优先处理 FOL-001/002/003/004/006/007、A1、C0 的基线与研究，不等于八张并行派工。C6a 可在形成样式边界共识后尽早完成，绝不可把 C2–C5 置于其前。任何一张卡若无法由一组聚焦检查和一次 PR 作出“通过/退回”结论，应在建卡前收窄或拆分。

**施工与审批分离**：本文不修改现存 Issue，不授权新建任务卡、派遣 Worker、合并 PR、提升 `test/prod` 或发布 npm。正式任务遵守组织独立验收、单卡小步、状态不在文档建第二台账的规则。

## 10. 工程验收清单

- [ ] 核心 API 不需要 React/DOM/CSS；`core`/`ui`/`build` 依赖方向能被检查。
- [ ] 目录结构让维护者能准确定位内容、UI 和构建逻辑；无已证实重复逻辑、无确认过时的兼容残骸。
- [ ] 现有公共导出、`/vite`、`/styles.css` 保持可用；新增子入口必须以 tarball 消费检查证明。
- [ ] C0 无官网覆盖的默认 UI 初始视觉/交互基线先于组件 CSS 迁移留存；最终 C8 有维护者真人验收记录。
- [ ] C6a 的 CSS 聚合构建和实际打包内容验证在组件拆样式之前生效；组件样式归属清晰、局部 UI 不污染宿主全局 CSS；公开 Token 和扩展方式有文档及消费实例。
- [ ] React 文档和无 JS 静态 HTML 的 TOC、分页、链接及对应 CSS 均有效。
- [ ] 安全路径写入与重复路由拒绝行为有回归；Markdown HTML 的信任契约记录清楚。
- [ ] 实际 `.tgz` 安装后 ESM、类型、Vite 插件、CSS 和静态页生成通过；Windows 包检查不弱化。
- [ ] 版本号/lockfile/变更说明在 feat 候选中完成并经 dev→test→prod；正常 Release/OIDC 发布及有条件首次 bootstrap 的区分与 Registry 回读有统一文档和可执行验证；无隐式发布授权。
- [ ] 官方站与至少一个隔离消费 fixture 保持可构建；项目阶段验收有 SHA、命令、产物或真人截图等相应证据。

## 11. 待验证而非擅自拍板的技术选型

1. **CSS Modules 的适用范围**：先证明静态 HTML 与 React 样式一致性；不设“全面采用”前提。
2. **是否增加 `/core`、`/ui` 公共导出**：经过类型、tree-shaking、peer dependency、外部消费检验再确认；目录调整不必强制新增公共出口。
3. **Router 组合边界**：完整 App 与嵌入组件是否需要分离 Router 提供者，依据实际消费试验决定。
4. **原始 HTML 信任模型**：保留受信任 Markdown 功能的同时，明确非可信内容是否支持及其限制；未经研究不直接插入 sanitizer。
5. **发布自动化工具**：先改进当前原生 Release + OIDC，是否使用 Changesets/Release Please 延后。
6. **真实试点站点**：`tomzlab-web` 当前无需 React/Vite；可做独立小 fixture 或经明确同意再迁移，不能将其视为已完成的 Folio 消费。

## 12. 变更治理

- 本文是 **工程设计草案**，可作为修订 Issue 的共同依据，但不替代每张 Issue 的 Goal / Scope / Acceptance / Evidence。
- 组织规则与 GitHub Issue 仍各自负责治理和任务真相；本稿不创建第二套状态账本，不自行设置 Priority、Effort、Project Status。
- 所有执行均遵守 `feat/* → dev → test → prod`；构建/审查绿色不等于可发布或已被维护者接受。
- 同一阶段可以形成多张小卡；研究结论应回写原 Issue，修改公共接口和发版动作必须有明确授权。
- 任何结构调整都应先证明兼容、后清理旧实现；保留的旧入口需说明明确的消费者和移除条件，杜绝无限兼容垃圾。

---

### 审阅结论建议

**建议将本稿作为 Folio 工程治理的待审设计基线；修正 PR 审查提出的 CSS 聚合前置、发布准备时序、首发例外、UI 基线与 B2 粒度问题后，以约 34 张浮动规划作为进一步讨论基础，再决定是否修订已有 9 张任务卡、逐批创建缺失工作项。** 视觉重设计暂不启动；但默认 UI 的成品质量、可维护目录和组件 CSS 是本轮治理不可削减的正式成果。

### 参考源码

- [Folio AGENTS.md](https://github.com/uichat-mira/folio/blob/dev/AGENTS.md)
- [包导出配置](https://github.com/uichat-mira/folio/blob/dev/packages/folio/package.json)
- [公共导出清单](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/index.ts)
- [Core/UI 混合类型](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/types.ts)
- [默认 CSS](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/styles.css)
- [官方站样式加载](https://github.com/uichat-mira/folio/blob/dev/apps/site/src/main.tsx)
- [静态生成器](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/static.ts)
- [文档 React 壳](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/docs-shell.tsx)
- [发布工作流](https://github.com/uichat-mira/folio/blob/dev/.github/workflows/publish.yml)
- [组织派卡规范](https://github.com/uichat-mira/.github/blob/main/skills/create-work-item/SKILL.md)