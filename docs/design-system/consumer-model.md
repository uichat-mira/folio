# Folio 消费者视觉模型与模板契约（FOL-034）

> **状态**：产品与设计合同，供维护者审读及 [FOL-049](https://github.com/uichat-mira/folio/issues/182)、[FOL-050](https://github.com/uichat-mira/folio/issues/183) 后续实施。**本文件没有引入任何运行时/API/CSS 改动**。基线：`uichat-mira/folio@dev`，`46b869e7fe948ea45aa3f3672c9bcacc259eb50b`，2026-11-11。任务：[FOL-034 / #138](https://github.com/uichat-mira/folio/issues/138)；基础合同：[FOL-033](README.md)。
>
> **标记**：**[F] 代码已支持的事实**、**[P] 本卡提出的未来产品/工程合同（目前不能直接使用）**、**[D] 需要维护者确认的产品方向**。不能将建议字段复制进当前 `FolioConfig` 然后声称编译可过。

## 0. 结论：一套 Folio，不是一张万能主题皮肤

**[P] 将四个维度正交：**

| 维度 | 回答的问题 | 负责的面 | 不允许越界 |
|---|---|---|---|
| **Template（模板）** | 内容如何编排？ | 页面结构、区块排列、可见组件和空状态；第一阶段只针对框架内置 **Portal / Editorial 首页** | 不定义品牌色、代码高亮、浏览器模式，也不强制消费站写某个品牌 |
| **Theme Preset（视觉预设）** | 这套 UI 的色彩与排版气质是什么？ | 一组 Semantic/必要 Component Token 的亮暗取值；阅读、代码容器与 Callout 的视觉角色 | 不增加路由、不重排首页 DOM、不把文章类型写死 |
| **Brand（消费站品牌）** | 这是哪家站点？ | `config.title/description/logo/footer`、`headerBrand`、站点独有文案/图片、明确开放的品牌 CSS 变量覆盖 | 不把 site CSS 克隆成 Folio 组件 CSS，也不覆盖框架内部私有选择器作为常规做法 |
| **Color Scheme（色彩模式）** | 当前采用明亮还是暗色取值？ | `light/dark/system` 偏好及最终有效 `light/dark`；只影响取值，不决定页面结构 | 不把 Graphite 当成第三种模式，不与 Preset 混为同一个枚举 |

**[P] 代码高亮色板是视觉预设的一个可独立选择的子配置（Code/Syntax Palette）**，不是第五套页面模板，也不是第四种 Color Scheme。`system` 需要先解析系统偏好得到有效 `light/dark`；Theme Preset 依然保持不变。

**[P] 最小独立组合示例**：

| 页面结构 | 视觉预设 | 最终模式 | 代码配色 | 产品语义 |
|---|---|---|---|---|
| Portal | Pearl | light | Xuanzhi Light | 暖白知识门户 |
| Portal | Pearl | dark | Xuanmo Dark | 同站夜间阅读 |
| Editorial | Pearl | light | Xuanmo Dark | 个人刊物＋深色代码 |
| Portal | Graphite | dark | Xuanmo Dark | 深色优先的技术门户 |
| Editorial | Editorial | light | 当前既有代码高亮 | 不配置的新老消费者兼容 |

因此 **Graphite = 独立 Preset（暗色优先），不等于 Dark Scheme**；未来 Graphite 也必须有可用的 light 角色值，或在实施前明确拒绝不支持的组合，不能无提示把用户选择的 `light` 强制改成 `dark`。本合同推荐 **提供 light/dark 成对取值**，不支持时不得宣称完成三套“可自由组合”的主题。

## 1. 代码事实：已支持、有限支持与尚未支持

以下是实际 `dev` 源码核对，不是设想。

| 能力 | 当前状态 | 源码或历史证据 |
|---|---|---|
| 站点标识/描述/Logo/导航/集合 | **[F] 已支持** `FolioConfig`；可配置 Footer 结构、品牌 Logo/明暗资源与分组 | [`types.ts`](../../packages/folio/src/types.ts)，[`Header`](../../packages/folio/src/ui/header/Header.tsx)，[`Footer`](../../packages/folio/src/ui/footer/Footer.tsx) |
| 默认首页内容配置 | **[F] 已支持** `home.meta`、`home.sections`，区块 `intro/featured/recent/collections/about`；内容和选择经 `resolveFolioHome` | [`types.ts`](../../packages/folio/src/types.ts)，[`core/home.ts`](../../packages/folio/src/core/home.ts) |
| 框架首页模板选择 | **[F] 未支持**：无 `home.template`；即使显式 `home.sections`，React 和静态仍带 `folio-editorial-home` 类及刊物结构 | [`app.tsx`](../../packages/folio/src/app.tsx)，[`static.ts`](../../packages/folio/src/static.ts)，[`editorial.css`](../../packages/folio/src/ui/home/editorial.css) |
| 默认首页身份 | **[F] 现在是刊物**：`DefaultHome` 和 `renderDefaultStaticHome` 有 `PERSONAL JOURNAL`、`READ · COLLECT · REMEMBER`、`写给生活的零碎记录`；`core/home.ts` 的缺省 meta/kicker 也相同 | [`app.tsx`](../../packages/folio/src/app.tsx)，[`static.ts`](../../packages/folio/src/static.ts)，[`core/home.ts`](../../packages/folio/src/core/home.ts) |
| React 首页整体覆写 | **[F] 已支持** `FolioSlots.home`；`Home` 优先取 truthy `custom`，其次 `config.home`，最后 `DefaultHome`；空值/false 不会触发完整覆写 | [`ui-types.ts`](../../packages/folio/src/ui-types.ts)，[`app.tsx`](../../packages/folio/src/app.tsx) |
| 只覆写静态首页 | **[F] 已支持** `staticRoutes.home` 局部替换 `/` 的 HTML/metadata，不接管其他默认路由；优先顺序是 `routes?()` → `home` 局部覆写 → 页面输出 | [`static.ts`](../../packages/folio/src/static.ts) `FolioStaticBuildOptions`、`writeFolioStaticSite` |
| Color Scheme 偏好 | **[F] 已支持** `FolioThemePreference = light/dark/system`，`ui.defaultTheme`，`localStorage["folio-theme"]` 和根级 `data-folio-theme`；当前首次解析优先 saved user > explicit UI default > OS | [`ui-types.ts`](../../packages/folio/src/ui-types.ts)，[`app.tsx`](../../packages/folio/src/app.tsx) |
| 显式视觉预设 | **[F] 尚无**独立 `preset` 公共选择 API；38 个根 Token/18 dark 覆盖，21 份 CSS 组成单一公开入口 | [`styles.css`](../../packages/folio/src/styles.css)、[`manifest.mjs`](../../packages/folio/styles/manifest.mjs)、[FOL-033](README.md) |
| Markdown/语法高亮主题选择 | **[F] 尚无**独立 palette API；`markdown.css` 的 `hljs` 颜色固定，浅亮页面中的代码块仍为深底；Mermaid 浅色 JS 值写死 | [`markdown.css`](../../packages/folio/src/ui/markdown/markdown.css)、[`markdown-react.tsx`](../../packages/folio/src/markdown-react.tsx) |
| React 与静态文档 | **[F] 都存在**，且 Markdown 共用纯 HTML 渲染器；无 JS 静态不自动包含站点级 Header/Footer、React Slot 或增强后的 Mermaid SVG | [`core/markdown.ts`](../../packages/folio/src/core/markdown.ts)，[`static.ts`](../../packages/folio/src/static.ts)，[FOL-019 历史测试](../research/fol-019-default-ui-baseline.md) |
| 官方实例站 | **[F] 自己的 `apps/site/src/HomePage.tsx`**，通过 `slots.home` 替换 React 首页；`apps/site/src/static-routes.ts` 自己产静态首页 | [`apps/site/src/main.tsx`](../../apps/site/src/main.tsx)，[`apps/site/src/static-routes.ts`](../../apps/site/src/static-routes.ts) |

**[F] 关键真实消费者**：[Moyu `prod` 配置](https://github.com/uichat-mira/moyu/blob/prod/folio.config.ts) 没有指定 `home` 或模板；[`src/main.tsx`](https://github.com/uichat-mira/moyu/blob/prod/src/main.tsx) 直接使用 `FolioApp`，无 `slots.home`；[`vite.config.ts`](https://github.com/uichat-mira/moyu/blob/prod/vite.config.ts) 用默认静态路由而非 `staticRoutes.home`。其 `package.json` 标示 `@uichat-mira/folio@0.1.1`，但 Moyu 仓库的构建说明还存在固定源码 SHA 的预览/发布路径，因此**不能把 package 声明简单等同当前所有部署产物版本**。无论如何，Moyu 的配置证明：**“未配置 = Editorial”已是实际消费路径**，不能在兼容版本中突然换成 Portal。

## 2. 首页的产品身份：决定与保护条件

**[P] 产品方向**：Folio 未来应有**中性的通用 Portal 首页**，而不是让所有新消费者默认带 `PERSONAL JOURNAL` 及个人随笔叙事；Editorial 是另一种有价值的模板，**保留、不删除、不贬为过时样式**。模板只是首页结构，文档、导航、搜索、TOC、Footer 不随着模板选择重新造轮子。

**[P] 当前兼容行为（不得破坏）**：

- 未声明新模板字段的旧 `FolioConfig`：继续获得目前的 **Editorial 默认首页**，包括已配置的 `home.meta` 和 `home.sections` 的既有语义、内容选择及样式。不能只给已有 Moyu 自动推断一个隐藏 `editorial` 标记然后将其他旧用户改成 Portal。
- 需要 Portal 的**新消费者**：在 FOL-050 引入模板显式 opt-in 后选择 `portal`。框架提供中性缺省文案和最小区块集合；仍可使用现有五类 `home.sections` 对内容编排。
- **未来是否把“没有配置模板”切成 Portal 是单独的、需要维护者批准的破坏性默认值迁移/版本决策**。本轮 FOL-050 **不直接切换所有用户默认值**，不靠站点名、路径、Logo 或个人资料推断身份。
- 保留 Editorial 模板在 React 和静态 HTML 的统一能力；不可只改 React 让静态 SEO/分享产物仍使用旧文案。

**[P] Portal 的最低内容合同**：站点标题/介绍来自 `config.title/description`；集合导航从 `config.collections` 派生；可选的精选、近期、栏目、关于来自真实 `docs` 和现有 `resolveFolioHome`；没有条目时显示中性、可读的空状态，不伪造文章、分类、日期。`meta` 默认应当为中性或隐藏，不使用“日记”“记录生活”作为缺省词。

**[D] 需要产品决定、但不影响设计稿施工的唯一高影响取舍**：是否在**未来非兼容版本**把 Portal 改为未配置默认？建议“是”，但应先完成 opt-in 模板和真实消费站迁移证据，之后单独批准切换；此合同不在当下替用户触发该变更。

## 3. 未来最小公共 API 建议——全部尚未实现

**[P] 不增加第二套路由状态机**。Home Template 应挂在**共享的 `FolioConfig.home`**，因为 React 和静态构建已经能拿到它；主题、品牌取值则应在双方可共享的**站点级 `FolioConfig`**，不应仅在 `FolioUiOptions` 加一个 React-only theme preset。以下为**设计伪接口，不是现有可编译 API**：

```ts
// PROPOSED ONLY — not present in current @uichat-mira/folio
type FolioHomeTemplate = "editorial" | "portal";
type FolioVisualPreset = "editorial" | "pearl" | "graphite";
type FolioCodePalette = "legacy" | "xuanzhi" | "xuanmo" | "auto";
type FolioAppearance = {
  preset?: FolioVisualPreset;
  scheme?: "light" | "dark" | "system";
  codePalette?: FolioCodePalette;
};

// Proposed additions to FolioConfig, not live fields:
// home?: FolioHomeConfig & { template?: FolioHomeTemplate };
// appearance?: FolioAppearance;
```

**[P] 字段放置理由及节约原则**：

1. `home.template` 负责框架**首页 DOM**；`home.sections`/`home.meta` 仍负责首页内容。Template 选择只影响首页，不自动替换搜索、DocsShell、Footer 的内容与路由。
2. `appearance.preset` 为站点视觉语义选取，**不进入 `home`**；全站 Header、阅读、列表、Footer、代码区域均能同一套视觉角色。未设置时维持现有基线，逻辑上相当于 legacy Editorial 色值。
3. `appearance.scheme` 是新消费者未来共享的**站点级初始偏好**，以便静态 HTML 和 React 有相同取值依据；`ui.defaultTheme` 作为老消费者已存在的 React 层覆盖点继续可用，不删除旧类型。
4. `appearance.codePalette` 属独立 Syntax Palette 配置：`legacy` 精确保留现有深色代码块语义；`xuanzhi`/`xuanmo` 显式指定；`auto` 在有效 light/dark 下分别选择 Xuanzhi/Xuanmo。**字段省略必须兼容目前的深色代码块，而不是偷偷改成 auto**。
5. 不新增 `themeEngine`、`templateRegistry`、每组件 JSX 配置或新色板生成框架；颜色通过 FOL-033 已定义的 Semantic/必要 Component 变量传递。新 API 只在 FOL-049/FOL-050 有可验证真实消费者需求时才落地，必要时可采用同等简单、经维护者确认的命名。

**[P] 明暗偏好的解析顺序（建议）**：用户在当前站点保存的显式 light/dark 选择 > 老 `ui.defaultTheme` 显式设置（React 兼容优先） > 新站点共享的 `appearance.scheme` > `system` / OS。原来 `app.tsx` 的真实逻辑是 saved > ui.defaultTheme > OS。新增 shared scheme 后不得覆盖旧消费者的显式选择；**因为 Vite 静态写入没有 React `ui`，配置冲突时不能承诺无 JS 与客户端完全一致**。建议新消费者只在 `appearance.scheme` 设置站点偏好；只有老消费者为兼容保留旧 `ui.defaultTheme`，并明确仅其 React 端优先。这是过渡规则，不应永久维护两个不同且可独立编辑的真相源。

**[P] 底层实现最低边界**：

- 有效 Preset / Scheme / Code Palette 应在 React 与静态产物上产生**同一组可识别的根作用域标记或等效的 CSS 配置**；不要只在 `FolioApp` 的 `useEffect` 里赋值，让无 JS 静态读者永远只有默认色。
- 读取已存在的 CSS custom property 和颜色模式，仍导出**一个** `@uichat-mira/folio/styles.css`；不允许消费站手工导入 21 份内部 CSS 或直接复制全部组件选择器。
- 确定性的值合成顺序：包基础 → Preset 语义值（每套 light/dark） → 消费站经公开 API 覆写的 Brand 值 → 明确授权的少量局部调节。**Brand 覆写是最后一层值，不是第四个 CSS 引擎。**
- `.folio-shell` 上本地声明的阅读/首页宽度覆盖根继承，不能误将根级同名覆盖列成已支持。FOL-049 应提供可工作的公开布局覆盖路径或明确保留为结构实现细节，避免“只改 Token”但实际无效。

## 4. 三套视觉方向与两套代码色板的合同

| 预设 / 色板 | 核心语言 | 实施/兼容规则 |
|---|---|---|
| **Pearl 珍珠白**（Preset） | 纸张暖白、墨色文字、细边框、中文/英文混排、克制留白 | 参照 [tomzlab-web `prod` CSS](https://github.com/uichat-mira/tomzlab-web/blob/prod/assets/css/site.css)；**不能复制站点品牌**。为 light/dark 分别定义可读 Semantic 角色 |
| **Editorial 刊物**（Preset） | 保护现有 Folio 刊物的默认气质、字体与点缀色 | “未配置视觉”的兼容基线；不要求同时选择 Editorial 首页模板，可与 Portal 组合 |
| **Graphite 石墨**（Preset） | 深色优先、低炫光、技术信息层级 | **不是** `Color Scheme.dark` 的新名字。必须明确 dark-first + 可用 light 角色；切换 `light` 不应自动变更 preset |
| **Xuanzhi Light 宣纸**（Syntax Palette） | 亮色代码表面与相应语法角色 | 显式代码色板，与页面是否 Pearl 独立 |
| **Xuanmo Dark 玄墨**（Syntax Palette） | 深色代码表面与相应语法角色 | 显式代码色板；与页面可以构成亮页深代码 |
| **legacy（兼容代码配色）** | 保持当前 `markdown.css` 的深色块与 highlight.js 色值 | **省略配置时使用**，保证历史文章外观不被自动改写 |

**[P] 代码规则**：`Reading Typography`、`Code Surface`、`Syntax Palette` 分离。`highlight.js` 只需语义色槽映射，不因主题需求自动升级成 Shiki。Mermaid 使用**有效站点主题语义**而非代码语法色；静态无 JS 必须留下可读原始图表代码或已有等价内容，不虚称构建时 SVG 已有。Callout 的信息/危险语义不能任意被品牌色取代。

**[D] 审美裁决说明**：上述是首批**产品方向与架构约束**，不是确认所有五套颜色的具体 hex、字重、间距和视觉质量已经通过。实际色票、对比度、组件表现由 FOL-049 借助真实消费者样章验收，不能从这份文档推断已经完成。

## 5. 自定义路径、优先级、冲突解决与组件所有权

### 5.1 用户应该如何选择定制手段

| 需要 | 首选手段 | 当前支持程度与边界 |
|---|---|---|
| 站名、描述、路由导航、集合、Footer | 结构化 `FolioConfig` | **[F] 已支持**，Footer 还可完全不显示 |
| 首页模块内容、顺序、精选来源 | `config.home.meta/sections` | **[F] 已支持**，但目前仍使用 Editorial 首页 DOM |
| 首页结构 Portal/Editorial | `config.home.template` | **[P] 尚未实现**，计划 FOL-050；不能把 `home.sections` 当成新模板 |
| 主题预设、代码亮暗、共享初始 scheme | `config.appearance` | **[P] 尚未实现**，计划 FOL-049 |
| Logo/页头行动与专属内容 | 站点 CSS + `slots.headerBrand/headerActions` | **[F] React 已支持**；静态 HTML 不能自动序列化 React 插槽 |
| 个别消费者品牌色 | 在 Folio 公共 CSS 后加载 Consumer CSS，按已公开 Token 覆写 | **[F] 部分可行**，硬编码颜色/局部宽度仍无法靠根 Token 全面覆盖；FOL-049 修合同 |
| 完整自定义 React 首页 | `slots.home` | **[F] 支持**；需要单独处理无 JS 首页 |
| 只覆写静态首页 | `folio({staticRoutes:{home: ...}})` | **[F] 支持** HTML 字符串/函数，原路由继续生成；不是自动 React SSR |
| 完整接管静态路由 | `staticRoutes.routes` | **[F] 可用但高成本**；不作为普通换肤推荐路径 |

**[F] 实际优先级**：

- **React `/` 首页**：truthy `slots.home` > 有 `config.home` 的 `ConfiguredHome` > `DefaultHome`。存在 `config.home` 不等于切换 Portal 模板。
- **静态 `/` 首页**：`staticRoutes.routes` 若提供，先替代默认路由集合；其后 `staticRoutes.home` 可覆盖根路由 `body`/metadata；没有覆写时，`config.home` 的 `renderConfiguredStaticHome` 或缺省 `renderDefaultStaticHome`。`staticRoutes:false` 直接不写静态站点。`slots.home` 与这条链**无关系**。
- **品牌**：`config.title` 等是站点数据；`slots.headerBrand` 取代 React 页头品牌节点，而不是覆盖整个 Header 布局。`slots.footer` 提供全替换 React Footer，`config.footer` 提供结构化默认 Footer；静态默认阅读页目前不复制整站 Header/Footer。
- **显示层**：Header/DocsShell/Markdown/文章页等由包 CSS 负责；CSS Token 的赋值优先级应清楚且由打包/独立消费者测试守护，**不能用路由 Slot 假装“换肤”**。

**[P] 冲突处理**：模板与配置区块不矛盾，结构使用选定模板、内容使用配置。普通消费者不应同时维护 `slots.home` 与另一份完全不同的 `staticRoutes.home`；高级消费者如果确有两套覆写，必须提交两条路径共享的内容模型或可检查的等价测试。静态路线数组覆写是最强扩展点，若缺少根路由但又声明 `staticRoutes.home`，现有代码会在构建时报错，此错误语义应保留。

### 5.2 组件责任矩阵

| UI 表面 | Folio 固有公共结构 | Template 可以决定 | Preset / Brand 可以决定 |
|---|---|---|---|
| Header / 移动端导航 | 交互、菜单、响应式行为、键盘可用性 | 不因首页模板替换 Header 核心逻辑 | Preset 决定视觉；Brand 放 Logo、站名、消费者行动 |
| 首页 | 原生区块查询/顺序/路由链接/空态能力 | **Portal / Editorial 布局、区块视觉层级及缺省文案** | 颜色、字体、圆角、有限展示尺寸；Brand 定站点内容 |
| 文章/Markdown | 语义 HTML、锚点、代码、Callout/表格规则 | 首页模板**不更改文章 DOM** | Reading、Code Surface、Syntax Palette 的语义取值及公开品牌覆盖 |
| 文档壳 / TreeNav / TOC / PageNav | 目录树、分页、阅读宽度、移动折叠/焦点 | 与首页模板正交，不新造一套文档模板 | Preset 视觉角色；Brand 仅通过开放变量和已有 Slot 定制 |
| 集合列表/归档 | 内容集合、链接与排序 | 首页可选展示方式，不改变集合路由/数据合同 | 颜色、排版等视觉；集合标题内容归站点 |
| 搜索 | 索引/结果行为与快捷键 | 不为首页模板另造搜索机制 | Preset 颜色/排版；Brand 不修改搜索算法 |
| Footer | 结构化页脚、链接、法律信息和可隐藏模式 | 首页模板不决定是否存在站点 Footer | Brand 文字/Logo/法务链接；Preset 视觉 |

**[P] 不承诺“所有视觉差异都能用 Token”**：结构布局、条件渲染、交互状态和某些响应式断点由组件拥有；品牌覆盖必须在受支持接口内可达，超出需求才使用高级 Slots/显式模板 CSS。

## 6. 三类消费者——真实可用路径与未来配置的边界

### 场景 A：文档 / 知识门户

以下 `FolioConfig` **[F] 今天即可使用**，但当前包内首页仍以 Editorial DOM 呈现；它**不是已经完成的 Portal 模板**：

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export const config = defineFolioConfig({
  title: "知识中心",
  description: "从入门到参考的结构化技术资料。",
  navigation: [{ label: "指南", collection: "/guide" }],
  collections: [{ path: "/guide", title: "指南" }],
  home: {
    meta: false,
    sections: [
      { type: "intro", kicker: "开始使用" },
      { type: "recent", collection: "/guide", title: "最近更新", limit: 6 },
    ],
  },
});
```

**[P] FOL-050 完成后**，仅给 `home` 增加 `template: "portal"` 即可选择中性布局；站点不需要自建 React 首页或复制 `staticRoutes.routes`。如另需品牌定制，再由 FOL-049 的 Preset/Token 承担，不触碰文档导航逻辑。

### 场景 B：品牌 / 产品门户

当前配置、结构化 Footer、消费者 Header 标识都已支持：

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export const config = defineFolioConfig({
  title: "产品门户",
  description: "产品能力、实践文章与接入指南。",
  collections: [
    { path: "/guide", title: "接入指南" },
    { path: "/blogs", title: "产品文章" },
  ],
  footer: {
    brand: { name: "产品门户", logo: { src: "/logo.svg", darkSrc: "/logo-dark.svg" } },
    groups: [{ title: "资源", links: [{ label: "指南", href: "/guide" }] }],
  },
  home: {
    meta: false,
    sections: [
      { type: "intro", kicker: "产品与文档" },
      { type: "collections", paths: ["/guide", "/blogs"] },
    ],
  },
});
```

**[F]** React 可另传 `slots.headerBrand` 或 `headerActions`；注意这不会进入默认无 JS 静态头部。[官方示例站 `main.tsx`](../../apps/site/src/main.tsx) 正是用独立的 `HomePage` 和品牌 CSS；那是**消费者自己的站点改造**，不构成 Folio 框架已经有 `home.template` 的证据。

**[P]** 以后选 `home.template="portal"`、`appearance.preset="pearl"` 即可得到通用结构和暖白视觉。消费者的具体 Logo、介绍与文案仍由自身提供；Pearl 不等于 tomzlab 品牌直接移植。

### 场景 C：个人刊物 / Editorial（真实兼容证据）

**[F]** [Moyu 当前 `prod`](https://github.com/uichat-mira/moyu/blob/prod/folio.config.ts) 配置 `title/description/navigation/collections`，**不声明 `home`**；[Moyu 入口](https://github.com/uichat-mira/moyu/blob/prod/src/main.tsx) 直接使用 `<FolioApp config={...} docs={...}/>`，所以依赖目前的内置 Editorial 首页。在仍兼容的 Folio 中，不增任何新字段，继续保留这一条已存在的路径。

**[P]** FOL-050 可新增显式 `home.template="editorial"` 作为日后升级的迁移目标；不要求 Moyu 在此设计卡中立即改仓库，也不自动批准将其线上包或固定源码 SHA 升级。FOL-049 的 `appearance.preset="editorial"` 仅决定配色与排版气质；它既可以配个人刊物模板，也可以配 Portal，二者独立。

### 全局的预期配置示意（**全是拟议字段，当前不能编译**）

```ts
// PROPOSED ONLY — installable only after FOL-049 / FOL-050 ship.
const exampleFutureConfig = {
  title: "知识中心",
  description: "多栏目内容门户",
  home: {
    template: "portal", // proposed, FOL-050
    meta: false,         // already supported
    sections: [{ type: "intro", kicker: "欢迎" }], // already supported
  },
  appearance: {          // proposed, FOL-049
    preset: "pearl",
    scheme: "system",
    codePalette: "auto",
  },
};
```

## 7. 实施与验证交接：两张卡即可

**[P] FOL-049 负责视觉**：[Issue #182](https://github.com/uichat-mira/folio/issues/182)。在现有根 Token、21 CSS 源、`styles/manifest.mjs` 与 `styles/contract.mjs` 上提供公共、可验证的 preset/code palette/Brand 覆写路径；检查 Reader、Table、Callout、Syntax、Mermaid 的明暗组合；保持 highlight.js 和唯一样式包入口，不改首页 DOM。

**[P] FOL-050 负责结构**：[Issue #183](https://github.com/uichat-mira/folio/issues/183)。基于 `resolveFolioHome` 复用现有内容模型，实现显式 `portal/editorial` 首页模板，保护未配置的 Editorial 老消费者；维护 React/静态双路径实际等价和 HTML 转义/路由。不能改官方示例站 `apps/site` 品牌首页。

**[P] 合同验收矩阵**：

| 维度 | FOL-049 要证明 | FOL-050 要证明 |
|---|---|---|
| 默认旧消费者 | 缺省 preset/代码配色不回归，Moyu 样式不被静默替换 | 缺省模板仍 Editorial，Moyu 原配置渲染不变 |
| 新消费者 | Pearl/Editorial/Graphite 与 scheme 独立，代码亮暗可组合 | 只加模板配置即得 Portal；不需要复制首页组件 |
| React | 首屏有效 preset/scheme、主题切换、品牌色覆盖及 Mermaid | 模板 DOM、区块、链接、空态 |
| 静态 / 无 JS | 构建出的 CSS 语义和 scheme 降级可读（不假装已有站点 Header） | 首页模块/文案/路由与 React 对齐 |
| 组合 | 代码色板不改变整站 scheme、Preset 不更改路由 | 换模板不更改 Markdown、Footer、搜索、TOC |
| 产物 | `release:check`、`styles:verify`、Windows、真实 tarball CSS | `home.test.mjs`、`static.test.mjs`、真实 tarball 与反向兼容路径 |

**[F] FOL-030 已完成首页内容与静态根路由覆写**：不重新造这层功能。**[P]** 两张卡可以在本合同审读后并行施工，但共享 CSS 主题角色先协调；不要因为“主题三套”再生三张相同工程卡。CI/自动化证明技术合同，不能代替具体视觉取舍的维护者判断。

## 8. 不能在本次治理 PR 中做的事

- 不修改 `packages/folio/src/**`、`styles/contract.mjs`、`styles/manifest.mjs`、`apps/site` 或任何下游站点。
- 不引入 `config.appearance`、`home.template` 等**拟议字段**到实际 TypeScript；这些必须由 FOL-049/FOL-050 的实施 PR 实现与测试。
- 不发布 npm、不部署测试/生产、不把历史消费者锁定版本偷偷升级。
- 不将无 JS 静态页面的 Markdown 可读性误报为完整 React 交互可用；也不把现有 Code/Mermaid 固定色误报为已实现动态主题。
- 不以本设计文档替代未来的 npm tarball、Windows、React/静态输出和必要无障碍/视觉验证。

**设计成功的判据**：维护者仅从本合同就能分清“什么现在能配置、什么尚不存在、谁在什么文件实现、旧 Moyu 是否会变样、Portal 新消费者能否最小接入”。最终的页面视觉效果由有实际输出的实施 PR 决定。
