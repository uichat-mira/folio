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
| Portal | Pearl | light | Xuanzhi Light | 新一代的通用默认组合 |

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

**[F] 当前框架事实**：无 `config.home` 的 React/静态首页走内置 Editorial 路径。那是当前代码待修改的事实，不是决定下一代默认的产品证据。第一代试验站及旧发布版本不作为本合同的参考对象。

## 2. 首页产品决策：Portal 是新默认，Editorial 是正式可选模板

**[P] 新一代 Folio 的默认首页选 Portal，不再默认是个人刊物。** 即使 `config.home` 缺省或没有 `home.template`，新实现也应该选中性的 Portal；`home.template="editorial"` 才选择个人刊物。发行包的默认首页不由第一代试验性消费站反向决定。

- **Portal** 以真实 `config.title/description`、`collections`、`docs` 形成标题、介绍、栏目、精选/最近文章与中性空态；不用 `PERSONAL JOURNAL`、`写给生活的零碎记录` 等日记词句。
- **Editorial** 是独立的、有辨识度的正式模板（刊物式大标题/精选/阅读列表），不是为了兼容某个旧站而保留的特殊支线。
- `home.sections` 的五类分区和 `resolveFolioHome` 保持内容单一真相源；模板决定结构与默认语言，不能把两套内容选择规则独立维护。
- React 与静态两端使用相同模板选择与中性/刊物默认文案，允许分别生成 JSX/HTML，但禁止默认身份错位。
- **FOL-050 可以改变下一代未配置模板时的默认值**，不需额外申请一个旧消费者保护条件；仍要保证现有 `home` 配置、Slots、静态路由覆盖的**功能契约可达**，并通过当前版本测试证明。

**[P] 产品方向现已确认**：Portal 为默认，Editorial 显式选择；不用“未来版本是否切默认”作为待裁决事项。具体 Portal 的视觉质量和界面结构由 FOL-050 实现验证。

## 3. 未来最小公共 API 建议——全部尚未实现

**[P] 不增加第二套路由状态机**。Home Template 应挂在**共享的 `FolioConfig.home`**，因为 React 和静态构建已经能拿到它；主题、品牌取值则应在双方可共享的**站点级 `FolioConfig`**，不应仅在 `FolioUiOptions` 加一个 React-only theme preset。以下为**设计伪接口，不是现有可编译 API**：

```ts
// PROPOSED ONLY — not present in current @uichat-mira/folio
type FolioHomeTemplate = "editorial" | "portal";
type FolioVisualPreset = "editorial" | "pearl" | "graphite";
type FolioCodePalette = "xuanzhi" | "xuanmo" | "auto";
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

1. `home.template` 控制框架首页 DOM，**缺省为 portal**；`home.sections` / `home.meta` 保持内容配置，不能把模板选择塞进 `ui`。
2. `appearance.preset` 控制全站视觉，**建议缺省为 pearl**；`editorial`、`graphite` 是平级预设，既可搭 Portal 也可搭 Editorial。
3. `appearance.scheme` 建议缺省 `system`，新一代站点层共享初始偏好；`ui.defaultTheme` 是当前已存在 React API，实施时以明确优先级处理，不能无视正在使用的 props。
4. `appearance.codePalette` 缺省建议 `auto`，随有效 light/dark 选择宣纸/玄墨，也支持显式选择。当前代码的深色背景不是一套需要维持的“legacy”产品主题。
5. 只新增真实消费需要的最小配置，不造新的主题引擎、页面注册市场、CMS 或颜色 JSON 编译器。

**[P] 模式选择顺序**：保存的用户 light/dark 选择 > 显式 `ui.defaultTheme` > 新共享 `appearance.scheme` > OS/system；静态 HTML 无法预知用户本地存储，须以真实 CSS/构建模式解释首屏降级。不做按站点名或历史版本自动推断的兼容逻辑。

**[P] 底层实现最低边界**：

- 有效 Preset / Scheme / Code Palette 应在 React 与静态产物上产生**同一组可识别的根作用域标记或等效的 CSS 配置**；不要只在 `FolioApp` 的 `useEffect` 里赋值，让无 JS 静态读者永远只有默认色。
- 读取已存在的 CSS custom property 和颜色模式，仍导出**一个** `@uichat-mira/folio/styles.css`；不允许消费站手工导入 21 份内部 CSS 或直接复制全部组件选择器。
- 确定性的值合成顺序：包基础 → Preset 语义值（每套 light/dark） → 消费站经公开 API 覆写的 Brand 值 → 明确授权的少量局部调节。**Brand 覆写是最后一层值，不是第四个 CSS 引擎。**
- `.folio-shell` 上本地声明的阅读/首页宽度覆盖根继承，不能误将根级同名覆盖列成已支持。FOL-049 应提供可工作的公开布局覆盖路径或明确保留为结构实现细节，避免“只改 Token”但实际无效。

## 4. 三套视觉方向与两套代码色板的合同

| 预设 / 色板 | 核心语言 | 实施规则 |
|---|---|---|
| **Pearl 珍珠白**（Preset） | 暖白纸张、墨色文字、细边界、留白与 CJK 阅读 | **新一代默认视觉候选**；参考 [tomzlab-web 视觉资产](https://github.com/uichat-mira/tomzlab-web/blob/prod/assets/css/site.css)，但不复制站点品牌；需有效 light/dark |
| **Editorial 刊物**（Preset） | 强调排版和刊物式字体层级 | 作为正式可选预设；与 Editorial 首页模板独立组合 |
| **Graphite 石墨**（Preset） | 暗色优先、克制的技术信息层级 | 独立 Preset，非 `Color Scheme.dark`，须在 light/dark 都可读 |
| **Xuanzhi Light 宣纸**（Syntax Palette） | 浅色代码与语法色 | 可显式选择，或 `auto` + light |
| **Xuanmo Dark 玄墨**（Syntax Palette） | 深色代码与语法色 | 可显式选择，或 `auto` + dark；允许浅页深代码 |

**[P] 新默认目标**：`home.template="portal"`、`appearance.preset="pearl"`、`appearance.scheme="system"`、`appearance.codePalette="auto"`。这些是尚未实现的产品目标，不能误报为当前 `dev` 已支持。

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

**[P] FOL-050 完成后**，不写 `home.template` 也会默认采用 Portal；显式写 `template: "portal"` 仅用于让配置意图更清晰。站点不需要自建 React 首页或复制 `staticRoutes.routes`。如另需品牌定制，再由 FOL-049 的 Preset/Token 承担，不触碰文档导航逻辑。

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

**[P]** 新一代默认 Portal / Pearl；显式选择同名模板和预设仅为固定站点设计意图。消费者的具体 Logo、介绍与文案仍由自身提供；Pearl 不等于 tomzlab 品牌直接移植。

### 场景 C：个人刊物 / Editorial（正式可选）

下面是**当前真实支持**的结构化内容配置示例，但当前版本尚未支持模板选择字段：

```ts
import { defineFolioConfig } from "@uichat-mira/folio";
export const config = defineFolioConfig({
  title: "个人刊物",
  description: "文字、观察与收藏。",
  collections: [{ path: "/essays", title: "文章" }],
  home: {
    meta: { left: "ESSAYS", right: "NOTES" },
    sections: [
      { type: "intro", kicker: "文字与观察" },
      { type: "featured", collection: "/essays" },
      { type: "recent", collection: "/essays" },
    ],
  },
});
```

**[P]** 下一代要刊物首页则显式添加 `home.template="editorial"`；还希望采用刊物色彩则独立添加 `appearance.preset="editorial"`。不为了某个第一代试验站增加隐藏默认分支。

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

**[P] FOL-050 负责结构**：[Issue #183](https://github.com/uichat-mira/folio/issues/183)。基于 `resolveFolioHome` 复用已有内容模型，实现**默认 Portal / 显式 Editorial** 首页；维护 React/静态内容等价、转义与路由，无历史站点专用特判。不能改官方示例站 `apps/site` 品牌首页。

**[P] 合同验收矩阵**：

| 维度 | FOL-049 要证明 | FOL-050 要证明 |
|---|---|---|
| 下一代默认 | 缺省 Pearl + system + 自动代码色板，无影子 legacy theme | 缺省 Portal、无个人日志默认文案；Editorial 显式选用 |
| 新消费者 | Pearl/Editorial/Graphite 与 scheme 独立，代码亮暗可组合 | 只加模板配置即得 Portal；不需要复制首页组件 |
| React | 首屏有效 preset/scheme、主题切换、品牌色覆盖及 Mermaid | 模板 DOM、区块、链接、空态 |
| 静态 / 无 JS | 构建出的 CSS 语义和 scheme 降级可读（不假装已有站点 Header） | 首页模块/文案/路由与 React 对齐 |
| 组合 | 代码色板不改变整站 scheme、Preset 不更改路由 | 换模板不更改 Markdown、Footer、搜索、TOC |
| 产物 | `release:check`、`styles:verify`、Windows、真实 tarball CSS | `home.test.mjs`、`static.test.mjs`、真实 tarball 与反向兼容路径 |

**[F] FOL-030 已完成首页内容与静态根路由覆写**：不重新造这层功能。**[P]** 两张卡可以在本合同审读后并行施工，但共享 CSS 主题角色先协调；不要因为“主题三套”再生三张相同工程卡。CI/自动化证明技术合同，不能代替具体视觉取舍的维护者判断。

## 8. 不能在本次治理 PR 中做的事

- 不修改 `packages/folio/src/**`、`styles/contract.mjs`、`styles/manifest.mjs`、`apps/site` 或任何下游站点。
- 不引入 `config.appearance`、`home.template` 等**拟议字段**到实际 TypeScript；这些必须由 FOL-049/FOL-050 的实施 PR 实现与测试。
- 不发布 npm、不部署测试/生产；旧试验站的锁定版本不进入新一代默认行为验收。
- 不将无 JS 静态页面的 Markdown 可读性误报为完整 React 交互可用；也不把现有 Code/Mermaid 固定色误报为已实现动态主题。
- 不以本设计文档替代未来的 npm tarball、Windows、React/静态输出和必要无障碍/视觉验证。

**设计成功的判据**：维护者仅从本合同就能分清“什么现在能配置、什么尚不存在、谁在什么文件实现、为何 Portal 是新默认、Editorial 如何显式选择”。最终的页面视觉效果由有实际输出的实施 PR 决定。
