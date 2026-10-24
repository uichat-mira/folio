# Folio 工程治理设计稿（Draft v0.2）

> **状态**：讨论成果整编稿，待维护者审阅；不是施工授权或发布批准  
> **日期**：2026-10-24  
> **本次修订**：Draft v0.2 — 增补 30 张基线工作项评估、现有 9 张归属、预计 21 张新增候选和 3–4 张条件性预留；未授权创建 Issue。  
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

默认 UI 不只是 fallback：无需站点级覆盖即可在桌面/手机上正常阅读、搜索、切换主题和导航；视觉有一致的排版尺度、颜色对比、留白、焦点态与响应式行为。**最终视觉是否达到“可直接使用”，需要维护者在浏览器进行真人验收**；单靠截图像素断言或 CI 无法代替审美验收。

### 5.2 样式所有权

1. 样式随组件或明确的共用视觉层维护。`Header` 管 Header 规则，`DocsShell` 管阅读布局，`MarkdownView` 管内容排版。
2. 公共主题变量 (`--folio-*`) 是有兼容承诺的定制入口；普通 `.folio-*` DOM 层级和私有选择器不承诺随版本稳定。哪些类名必须用于静态 HTML 输出，列为**内部双渲染契约**并有回归检查。
3. 单独引入 `FolioMarkdown` 等局部 UI 时不能全局修改宿主 `body`、链接、按钮、背景。完整 `FolioApp` 可通过组件根节点拥有自己的基线；官网自身负责 `body` 等站点级样式。
4. 深浅色状态尽量作用域化；现行 `document.documentElement.dataset.folioTheme` 是宿主副作用，变更需保留默认整站兼容并检查独立嵌入行为。
5. 默认样式通过一个受支持的 `@uichat-mira/folio/styles.css` 聚合入口提供，内部可以拆组件 CSS 文件，消费者不必手工拼导入顺序。
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
feat/* → dev → test → prod
                      │
            准备版本/变更说明
                      │
         locked build + release:check
                      │
       真实 .tgz → 隔离消费者检查
                      │
        维护者批准 tag / Release
                      │
      现有 publish.yml → npm Registry
                      │
         回读已发布版本与入口
```

### 实施边界

- **版本准备**：提供简短可重复命令/步骤，检查 package/workspace version、tag 命名、变更说明与发布血统；不自动替人确认重大版本变更。
- **打包验证**：实际生成 `.tgz`，在非 workspace 临时目录安装；验证 ESM、类型、`/vite`、CSS、内容虚拟模块、Vite 构建和静态 HTML。
- **发布门禁**：保留 Linux 和 Windows 验证，不降低现有 `release:check` 要求；必要的真实消费者测试接入相关门禁，但避免重复跑昂贵步骤。
- **发布故障**：失败需在日志指出版本、步骤和可重试条件；不靠禁用测试、绕过 OIDC 或临时手动 token 来“修绿”。
- **正式发布**：继续以 `prod` lineage 的 GitHub Release 为唯一 npm 触发点；发布后核验 Registry 产物，不能以“工作流绿色”替代 npm 真实状态。
- **工具选择**：暂不引入 Changesets/Release Please；如果版本维护实际复杂度显著上升，再另立小型研究任务比较收益。

## 8. 治理阶段、执行和退出门槛

### Phase A · 基线与风险止血

**交付**：归属清单、公共 API 快照、CSS 所有权清单、`dev` 检查基线；独立解决路径越界/重复路由，Markdown 安全先冻结信任模型。

**门槛**：可从源码、测试和版本证据判断现状；不开始大规模目录重排前明确公共接口保持不变。

### Phase B · Core/UI/Build 与目录治理

**交付**：按实际职责重组目录与类型，抽出 `app.tsx` 中已经稳定的独立模块，`static.ts` 解除文件写入与页面表现的无谓混合；内部 import 规则和公开导出检查。

**门槛**：现有 package API、文档导航、静态 HTML、官网 reference site 行为回归通过；一次只动一个边界，禁止大爆炸式重写。

### Phase C · 组件与默认样式治理

**交付**：CSS 分归组件，受控 Token 集与样式入口，消除可证实的全局污染；默认 UI 独立 demo；静态/React 共用外观类名的合同测试。

**门槛**：默认 UI 桌面/移动、浅/深色、无 JS 静态阅读验收通过；嵌入者可通过公开 Token/Props 定制，不依赖官网私有覆盖；维护者真人视觉验收。

### Phase D · 发包与消费者证据

**交付**：真实 tarball 独立安装和最小 Vite/静态构建检验、版本准备指南、发布回读检查与故障排查说明。

**门槛**：可复现独立消费与发布候选验证；CI 证据精确到 SHA/版本；正式发布依然需要明确授权。

### Phase E · 试点与验收

**交付**：使用最小独立消费者验证默认 UI 与品牌覆盖；可选择在明确批准后评估 `tomzlab-web`，但不能强迫其从纯 HTML/CSS 迁移成 React 工程。

**门槛**：实现新的品牌表达不要求修改 Folio 私有源码；独立消费者回归留存。官网视觉全面再设计作为**后续独立项目**。

阶段是验收顺序而非一张卡一个阶段；可并行的小任务必须在依赖清楚的前提下单独派工。每卡一个可独立回退的结果，限制 Worker 执行范围，30 张仅作为规划基线，不是刚性卡数或交付时间承诺。

## 9. 工作项规模评估与任务卡调整（Draft v0.2）

### 9.1 估算口径：30 张基线规划，按研究结论调整

本轮基于工程稿与 `dev` 源码，对治理任务做**可独立验收结果级别**的重新估算：

| 工作组 | 已存在 Issue | 建议新增候选 | 基线合计 | 边界 |
| --- | ---: | ---: | ---: | --- |
| A · 基线与风险止血 | 4 | 1 | **5** | 契约基线、安全缺陷、信任边界、状态文档 |
| B · Core/UI/Build 与目录治理 | 1 | 8 | **9** | 类型、纯逻辑、React 组件、Build 分离与依赖约束 |
| C · 组件 CSS 与默认 UI | 1 | 8 | **9** | 全局污染、Tokens、组件样式、静态兼容、默认成品 |
| D · npm 发布与独立消费 | 3 | 4 | **7** | tarball/类型/Vite 消费、版本准备、发布回读、品牌试点 |
| **总计** | **9** | **21** | **30** | 不预设新增 Issue 编号 |

**30 张是规划基线，不是固定必须创建的数量或单批派工目标。** 预计另有 **3–4 张条件性后续工作**，仅在验证显示确有独立可交付缺口时补充，故建议按 **30–34 张**作总体资源预估。研究结论可能使部分候选项合并、缩小或取消；不为凑数建卡。

这里的“张数”统计的是**有独立验收和回退边界的预期工作项**。它不能当作人员工时、交付周期或并行 Worker 数量。

### 9.2 已有 9 张：沿用，不重建

现有 Issue 仍属于项目事实，**不作废、不占新编号**：

| 领域 | Issue | 现有目标 | 处理建议 |
| --- | --- | --- | --- |
| A | [FOL-001](https://github.com/uichat-mira/folio/issues/45) | 阻止静态路由写出 outDir | 保留；以越界拒绝与回归测试验收 |
| A | [FOL-002](https://github.com/uichat-mira/folio/issues/46) | 拒绝重复内容路由 | 保留；以明确失败语义验收 |
| A | [FOL-003](https://github.com/uichat-mira/folio/issues/47) | 原始 HTML 信任边界研究 | 收窄为风险复现和明确的信任决策；不顺手重写渲染器 |
| A | [FOL-006](https://github.com/uichat-mira/folio/issues/50) | npm/迁移状态文档与现实对齐 | 保留；先核实 Registry 和已迁移消费者 |
| B | [FOL-008](https://github.com/uichat-mira/folio/issues/52) | 静态 / React 导航一致性研究 | 先建立锚点、TOC、上下页、base path 对照基线；研究不夹带大重构 |
| C | [FOL-007](https://github.com/uichat-mira/folio/issues/51) | 宿主 CSS 污染研究 | 研究全局影响和独立组件消费行为；组件 CSS 施工另立小卡 |
| D | [FOL-004](https://github.com/uichat-mira/folio/issues/48) | 真实 tarball 的现有三入口验证 | 先集中包安装和入口解析；类型/CI 若独立则收窄或拆分 |
| D | [FOL-005](https://github.com/uichat-mira/folio/issues/49) | 独立 Vite 消费虚拟模块 | 复用 004 fixture；仅验证 virtual manifest |
| D | [FOL-009](https://github.com/uichat-mira/folio/issues/53) | 独立静态产物验证 | 复用同一 fixture；仅验收静态页、404、sitemap、robots |

**复用原则**：独立消费 fixture 是共享测试基础设施，不允许 004/005/009 各造一套项目和依赖锁。

### 9.3 新增 21 张候选工作项（尚未创建正式 Issue）

以下代号 `A1/B1…` **仅为设计稿内部规划序号，不是组织任务 ID，也不代表已授权建卡**。派卡前必须逐项复核是否已有覆盖，确认单卡验收成本后才分配正式 `FOL-NNN`。

#### A · 基线（1 张）

| 候选 | 独立交付结果 / 验收证据 |
| --- | --- |
| A1 | 建立现有模块所有权、依赖方向、根入口导出与公共 CSS 覆盖面的**基线清单**；能逐模块标明 Core/UI/Build/Consumer 归属、已证实消费者与待确认项。它记录现状，不负责执行重构。 |

#### B · Core/UI/Build 与目录（8 张）

| 候选 | 独立交付结果 / 验收证据 |
| --- | --- |
| B1 | Core 数据类型与 React UI Props/Slots 类型分离；旧根入口类型签名保持兼容，类型测试通过。 |
| B2 | 内容、Markdown、navigation、search、config 的纯逻辑按所有权归位；不改变解析、排序、heading ID 和搜索结果，相关单测回归。 |
| B3 | 从 `app.tsx` 分离 SearchOverlay/SearchDialog 的状态及视图责任；键盘导航、搜索和路由行为维持不变。 |
| B4 | 从 `app.tsx` 分离默认 Home/NotFound 页面组合；默认路由、404 与 consumer `slots.home` 兼容。 |
| B5 | `docs-shell.tsx` 内 DocNav/TOC/Pager 等组件按职责归位；沿用 `docs-structure` 语义，移动端及 React 文档行为保持。 |
| B6 | `static.ts` 的路由文件写入与 SEO/meta 构建职责拆分；输出路径及已有静态元信息一致，保留 001/002 的安全回归。 |
| B7 | 静态 DocsShell 导航/TOC/Pager 的 HTML 表示归属清晰化，形成与 React 共享的语义/类名契约；以 008 基线及无 JS 页面回归证明。 |
| B8 | Vite Build Adapter 目录入口与 Core/UI/Build 单向依赖约束收口；旧 `/vite` 入口保持不变，加入能阻止反向依赖的检查。 |

#### C · 组件 CSS 与默认 UI（8 张）

| 候选 | 独立交付结果 / 验收证据 |
| --- | --- |
| C1 | 收敛公开 Design Tokens、主题作用域和禁止全局污染的基础规则；独立宿主不被局部 UI 默认改写 `body/a/button`。 |
| C2 | Header 组件拥有自己的默认 CSS 与状态样式；桌面/移动、主题及官网普通消费场景正确。 |
| C3 | DocsShell/DocNav/TOC/Pager 组件样式归位；阅读宽度、导航和响应式布局可独立验收。 |
| C4 | MarkdownView 的标题、代码、表格、Callout、Mermaid 样式归位；默认排版在静态和 React 内容上可读。 |
| C5 | SearchDialog/Share 相关样式归位，键盘焦点、弹层层级、移动视口等默认交互完整。 |
| C6 | 重建受控 `/styles.css` 聚合入口和静态 HTML 稳定类名检查；单独 CSS 引入不漏样式、不产生错误加载顺序。 |
| C7 | 清理官网对公共 `.folio-*` 的不必要重写，保留官网专属样式与真实案例；以官网构建及覆盖清单证明无需改包内私有 DOM。 |
| C8 | 建立**没有官网 CSS 加成**的默认 UI 验收样板与视觉/交互验收记录；覆盖桌面/手机、浅/深色、长文、搜索和无 JS 页面。必要的小范围收口只处理该验收面，超出范围的功能缺陷另立卡。 |

#### D · 发布与消费者证据（4 张）

| 候选 | 独立交付结果 / 验收证据 |
| --- | --- |
| D1 | 公共 API 和 TS 声明兼容性验证：对治理前快照比较保留的根入口类型与运行导出；必要的新 `/core`、`/ui` 入口须单独通过真实 tarball 试验后方可采纳。与 FOL-004 的初始安装检查不重复。 |
| D2 | 版本准备与变更说明形成一条明确可执行路径，检查 package/workspace 版本、tag 规则与 `prod` 血统；不自动发布。 |
| D3 | 在现有 Release → OIDC 工作流上增加发布后 npm Registry/产物回读与可诊断的失败说明，保持生产发布门禁。 |
| D4 | 用独立消费者消费默认 UI 和公开主题 Tokens，提供第二套品牌展示而不覆盖包内私有选择器；保留独立安装、运行和截图证据，不强制改造现有 `tomzlab-web`。 |

### 9.4 不提前建卡的条件性 3–4 项

| 条件 | 何时才允许单独成卡 |
| --- | --- |
| Markdown 非可信 HTML 处理 | FOL-003 证明现实风险并冻结信任策略后，才明确修复范围 |
| 嵌入已有 React Router | 独立消费者复现明确需求且现有 `FolioApp`/组件组合不能满足时 |
| 新增 `/core`、`/ui` 公开子入口 | D1 证明收益、打包/peer dependency 成本与兼容边界后 |
| 非预期 UI/a11y 缺陷 | C8 真实验收出现可复现且无法纳入组件局部收口的问题时 |

不要把研究卡直接写成“不管结果如何都必须施工”的任务。

### 9.5 依赖、派工粒度和建议首批

建议依赖路径（不是一次性并行派工表）：

```text
A1 基线 ──→ B1/B2（Core 类型与纯逻辑）
       ├──→ FOL-008（双渲染导航对照）→ B5/B7
       └──→ FOL-007（宿主污染）→ C1 → C2/C3/C4/C5 → C6/C7 → C8

FOL-004（共享 tgz fixture）→ FOL-005（virtual module）→ FOL-009（静态）
B/C 结构稳定 + FOL-004 → D1（最终 API 兼容与候选新入口）
D2（发布准备）→ D3（发布回读；不隐式触发发布）
FOL-004/005/009 + C8 → D4（独立品牌消费）
```

**首批只释放约 6–8 张可执行卡**。优先复用 FOL-001、002、003、006、007、004，加上 A1 等基线工作；要根据依赖依次启动，并非全部同时派给 Worker。FOL-004 要先收窄成小范围 tarball 基线，不得让一个 Worker 一次完成整个发布链。

**单卡控制**：一次只改变一个边界或一个组件族；能单独回退，能在一组聚焦测试、一次 PR 审查或一组有针对性的浏览器验收中作出明确“通过/退回”决定。超出时在派工前收窄，不把其他问题塞进同卡。

**权限**：本节仅为设计稿的任务量评估；更新本文、合并文档 PR、修订已有 Issue、创建新的 Issue、派遣 Worker、合并实现 PR 与 npm 正式发布，是不同动作，各需符合当前授权与组织流程。任务编号和 Project 状态不能由文档预占或充当第二套任务真相。

## 10. 工程验收清单

- [ ] 核心 API 不需要 React/DOM/CSS；`core`/`ui`/`build` 依赖方向能被检查。
- [ ] 目录结构让维护者能准确定位内容、UI 和构建逻辑；无已证实重复逻辑、无确认过时的兼容残骸。
- [ ] 现有公共导出、`/vite`、`/styles.css` 保持可用；新增子入口必须以 tarball 消费检查证明。
- [ ] 默认组件的外观与键盘/移动端交互达到维护者接受的成品水平。
- [ ] 组件样式由组件负责；导入局部组件不污染宿主全局 CSS；公开 Token 和组件扩展方式有文档及消费实例。
- [ ] React 文档和无 JS 静态 HTML 的 TOC、分页、链接及对应 CSS 均有效。
- [ ] 安全路径写入与重复路由拒绝行为有回归；Markdown HTML 的信任契约记录清楚。
- [ ] 实际 `.tgz` 安装后 ESM、类型、Vite 插件、CSS 和静态页生成通过；Windows 包检查不弱化。
- [ ] 版本准备、发布门禁、Registry 回读的文档与可运行命令统一；无对生产发布的隐式授权。
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

**建议将本稿作为 Folio 工程治理的设计基线，先审阅职责边界、退出条件及 30 张基线规划，再决定是否修订已有 9 张任务卡、逐批创建缺失工作项。** 视觉重设计暂不启动；但默认 UI 的成品质量、可维护目录和组件 CSS 是本轮治理不可削减的正式成果。

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