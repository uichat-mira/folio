# Folio Design Foundation 与 Token 治理契约（FOL-033）

> **性质**：设计治理／技术契约，不是运行时实现。**证据基线**：`uichat-mira/folio` 的 `dev@36bd168a7df189c4bdd9c5a346babb02f8e87b3e`（2026-11-11）。**任务**：[#137](https://github.com/uichat-mira/folio/issues/137)。
>
> 本文统一使用 **[F] 已核实的源码事实**、**[P] 建议合同，尚未实现**、**[D] 待维护者／FOL-034 裁决** 三类标记。本文是本轮唯一主规范；实际 Token 值和可执行门禁继续以源码为唯一事实源，**不复制第二份 JSON 色板**。

## 0. 结论和审计方法

1. **[F] 根 Token 是 38 个，不是 #137 早期上下文写的 37 个**。当前 [`src/styles.css`](../../packages/folio/src/styles.css) 的 `:root` 定义 38 个 `--folio-*`；`[data-folio-theme="dark"]` 覆盖其中 18 个；[`styles/contract.mjs`](../../packages/folio/styles/contract.mjs) 同步冻结 38 / 18 的顺序。
2. **[F] 21 份 CSS 源已被有序聚合**：按照 [`styles/manifest.mjs`](../../packages/folio/styles/manifest.mjs) 中的 `STYLE_SOURCES` 扫描根 Token 的 `var(--folio-...)` 使用，**有 11 个根 Token 在包内 CSS 无 `var()` 引用**：`primary-disabled`、`hairline-soft`、`surface-dark-elevated`、`accent-amber`、`success`、六个 `space-*`。这不证明它们在外部消费者中无用。
3. **[F] 统计口径**：只计 `src/styles.css` 的 `:root` 直接声明（不把 `.folio-shell` 等局部声明算入根）；对比 `[data-folio-theme="dark"]` 的覆盖；使用关系限定上述 21 份包内 CSS 的 `var()`，不把注释/声明或 TS/JS 字面量算作 CSS `var()` 引用。表中给出**代表性使用源文件**，不是唯一使用点或精确引用次数。
4. **[F] 消费站检查**：[`apps/site/src/site.css`](../../apps/site/src/site.css) 将 16 个 `--site-*` 别名映射到 `--folio-*`，并分别覆写亮／暗 `--folio-primary`、`--folio-primary-active`；这说明官网有真实品牌覆写，但不能断言其余独立消费者没有使用上面 11 个变量。
5. **[P]** 保留现有公开变量作为迁移基础，定义 Primitive → Semantic → Component 的单向引用合同；将 Reading Typography、Code Surface、Syntax Palette 分开治理，避免主题变成大量 CSS 选择器覆盖。
6. **[D]** 首批产品方向 Pearl 珍珠白／Editorial／Graphite 与 Xuanzhi Light／Xuanmo Dark 语法色板，是**未来主题候选**。不在本卡把名字写进 API，也不修改默认视觉。

历史证据：[FOL-017 架构与 CSS 所有权](../research/fol-017/architecture-baseline.md)、[FOL-019 独立 tarball 消费者 UI 基线](../research/fol-019-default-ui-baseline.md)、[FOL-020 CSS 聚合门禁](../research/fol-020/README.md)。这些是各自 SHA 的证据，**不是当前分支新的浏览器实测**。

## 1. 38 个 Token 完整映射

类别：`S` = 当前建议保留在 Semantic / 公共语义角色；`P` = 数值尺度，未来可由 Primitive 供值，但旧变量需兼容；`*` = 本次 21 CSS 源扫描中没有内部 `var()` 引用，外部消费者**尚未穷尽调查**；`—` = 未发现包内 CSS `var()` 消费。`目标角色` 不是已实现的新 CSS 属性。

| 当前声明 | 默认值 | Dark 覆盖 | 类别 | Folio CSS 内消费者示例 | 目标角色 / 处理建议 |
|---|---|:---:|:---:|---|---|
| `--folio-primary` | `#cc785c` | 是 | S | header、markdown、app | `action.primary`：交互主强调 |
| `--folio-primary-active` | `#a9583e` | 是 | S | header、editorial、导航 | `action.active`：选中/悬停 |
| `--folio-primary-disabled` | `#e6dfd8` | 是 | S* | — | `action.disabled`：候选禁用态；核对外部消费者后决定 |
| `--folio-ink` | `#141413` | 是 | S | root、header、editorial | `text.primary`：正文主墨色 |
| `--folio-body` | `#3d3d3a` | 是 | S | header、markdown、docs-shell | `text.body`：正文文字 |
| `--folio-body-strong` | `#252523` | 是 | S | article-archive、doc-meta | `text.strong`：强调文字 |
| `--folio-muted` | `#6c6a64` | 是 | S | header、search、footer | `text.secondary`：次级文字 |
| `--folio-muted-soft` | `#8e8b82` | 是 | S | header、tree-nav、toc | `text.subtle`：弱化文字 |
| `--folio-hairline` | `#e6dfd8` | 是 | S | header、docs-shell、toc | `border.default`：基础分隔线 |
| `--folio-hairline-soft` | `#ebe6df` | 是 | S* | — | `border.subtle`：弱分隔线候选 |
| `--folio-canvas` | `#faf9f5` | 是 | S | root、docs-shell、app | `surface.canvas`：页面底色 |
| `--folio-surface-soft` | `#f5f0e8` | 是 | S | header、home、footer | `surface.soft`：浅层表面 |
| `--folio-surface-card` | `#efe9de` | 是 | S | markdown、home、tree-nav | `surface.card`：卡片及当前行内代码 |
| `--folio-surface-dark` | `#181715` | 是 | S | markdown、editorial | `surface.inverse`：反色面及当前代码块 |
| `--folio-surface-dark-elevated` | `#252320` | 是 | S* | — | `surface.inverse-elevated`：深浮层候选 |
| `--folio-on-primary` | `#fff` | 是 | S | app | `text.on-action`：动作反色文字 |
| `--folio-on-dark` | `#faf9f5` | 是 | S | editorial | `text.on-inverse`：反色正文 |
| `--folio-on-dark-soft` | `#a09d96` | 是 | S | markdown | `text.on-inverse-muted`：反色弱文字 |
| `--folio-accent-teal` | `#5db8a6` | 否 | S | markdown | `accent.informational`：当前提示块颜色 |
| `--folio-accent-amber` | `#e8a55a` | 否 | S* | — | `accent.warm`：预留暖色点缀 |
| `--folio-success` | `#5db872` | 否 | S* | — | `status.success`：预留成功语义 |
| `--folio-warning` | `#d4a017` | 否 | S | markdown | `status.warning`：警告语义 |
| `--folio-error` | `#c64545` | 否 | S | markdown | `status.danger`：危险语义 |
| `--folio-font-sans` | `"Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | 否 | S | root、header、document-body | `typography.sans`：正文/界面字族 |
| `--folio-font-display` | `"Cormorant Garamond", Garamond, "Times New Roman", serif` | 否 | S | header、markdown、docs-shell | `typography.display`：展示标题字族 |
| `--folio-font-mono` | `"JetBrains Mono", "SFMono-Regular", Consolas, monospace` | 否 | S | header、markdown、search | `typography.mono`：代码与元数据字族 |
| `--folio-header-height` | `64px` | 否 | S | header、docs-shell、toc | `layout.header-height`：跨组件定位尺寸 |
| `--folio-radius-sm` | `6px` | 否 | P | header、markdown、tree-nav | `radius.sm`：数值尺度，保留旧名 |
| `--folio-radius-md` | `8px` | 否 | P | header、markdown、popover | `radius.md`：数值尺度，保留旧名 |
| `--folio-radius-lg` | `12px` | 否 | P | markdown、docs-shell | `radius.lg`：数值尺度，保留旧名 |
| `--folio-radius-xl` | `16px` | 否 | P | home、search | `radius.xl`：数值尺度，保留旧名 |
| `--folio-radius-pill` | `999px` | 否 | P | markdown、entry-list、archive | `radius.pill`：药丸语义不机械改成 px |
| `--folio-space-xs` | `8px` | 否 | P* | — | `space.xs`：当前无包内 var 消费 |
| `--folio-space-sm` | `12px` | 否 | P* | — | `space.sm`：当前无包内 var 消费 |
| `--folio-space-md` | `16px` | 否 | P* | — | `space.md`：当前无包内 var 消费 |
| `--folio-space-lg` | `24px` | 否 | P* | — | `space.lg`：当前无包内 var 消费 |
| `--folio-space-xl` | `32px` | 否 | P* | — | `space.xl`：当前无包内 var 消费 |
| `--folio-space-2xl` | `48px` | 否 | P* | — | `space.2xl`：当前无包内 var 消费 |

**[F] 重复值不等于重复用途**。例如 `--folio-primary-disabled` 与 `--folio-hairline` 的默认值都为 `#e6dfd8`；`--folio-on-dark` 与亮色 `--folio-canvas` 同为 `#faf9f5`。不同语义角色不得因为色值相同就合并；暗色覆盖也不可直接推导为另一角色。

**[P] 未消费项的处理**：以上 11 项一律标记**候选公开扩展点／待核查消费者**，绝不宣称“死 Token”。未来若确需删除，先查消费站和历史版本，提供兼容 alias、迁移说明及独立授权。尤其六个 `space-*` 在组件中未使用，不等于消费者不能使用。

## 2. 分层、命名、引用和弃用纪律

| 层级 | 定义 | 拟议命名例（当前不存在） | 覆盖边界 |
|---|---|---|---|
| **Primitive / Reference** | 原始颜色、数值间距、圆角基数、基础字体栈；不带按钮、危险等用途 | `--folio-ref-color-neutral-900`、`--folio-ref-space-md` | 原则上包内使用，不作为消费者必需依赖 |
| **Semantic** | 画布/表面、主次正文、边框、交互、状态、排版等**用途语义** | `--folio-color-text-primary`、`--folio-color-surface-canvas`、`--folio-color-action-primary` | 消费站的首选、稳定覆写点；当前 `--folio-ink` 等旧名仍有效 |
| **Component** | 特定组件确有独立用途、不能由公共语义表达时才增加 | `--folio-code-border-radius` | 只公开有真实需要的少量项；组件不得消费其他组件私有变量 |

**[P] 引用方向**：原值/Primitive → Semantic → 组件默认实现／极少 Component 局部别名；组件不得绕开 Semantic 直接把某个原始红色当成错误/品牌两种用途；不得引用另一组件内部 Token。新增 Token 前需核实真实消费路径、两种 Color Scheme、语义归属与跨平台可用性；不要为了整理而对全部 `px`、字体、颜色做机械替换。

**[P] 命名与兼容**：新语义名称使用小写连字符和可辨识的 `--folio-{role}-{purpose}`；Primitive 候选 `--folio-ref-*`；组件私有用 `--folio-{component}-*`。目前的 38 个 `--folio-*` 不重命名、不删除；迁移用**单一原值＋受控 alias**，避免旧新两组变量同时独立配置而漂移。增加/弃用需给出使用点、亮暗值、对比度、版本策略、真实 tarball 消费者验证和机器门禁更新。

## 3. 最小 Design Foundation

| 范围 | 当前事实 [F] | 建议治理 [P] / 允许例外 |
|---|---|---|
| **颜色** | 23 个根色彩角色，18 个 dark 覆盖；相同值可能表达不同语义 | 文本、画布、容器、边框、动作、危险分别定义；不要把品牌红直接当危险红 |
| **字体/CJK** | `font-sans`、`font-display`、`font-mono` 三类；[Editorial](../../packages/folio/src/ui/home/editorial.css) 单独写宋体字族 | 明确中英 fallback 和数字、标点表现。`PingFang SC`、`Microsoft YaHei`、`Songti SC`、`Noto Serif CJK SC`、`SimSun` 作为核验候选，不能假设全部设备可用，也不能假设消费站加载了外部网络字体 |
| **字号/行高/字重/字距** | [Markdown CSS](../../packages/folio/src/ui/markdown/markdown.css) 正文 `16px / 1.78`、h2 `26px`、h3 `17px`，各组件有很多 `12–14px` 字面量 | 为正文、H1–H4、注解和 UI label 建精简语义尺度；独特刊物标题、代码和数据徽标可以保留局部例外 |
| **间距** | 根 8/12/16/24/32/48px 六档，目前包内 CSS 无 `var()` 消费 | 先保留，再迁移确有重复语义的边距；定位、响应式计算值可以保持局部数字 |
| **布局宽度** | [根样式](../../packages/folio/src/styles.css) 的 `.folio-shell` 内有 `--folio-home-frame-width:1440px` 和 `--folio-reading-frame-width:1280px`，非根 Token；[DocsShell](../../packages/folio/src/ui/docs-shell/docs-shell.css) / [Footer](../../packages/folio/src/ui/footer/footer.css) 消费 | 仅在 `:root` 覆写**无法保证生效**，因为 `.folio-shell` 的局部声明遮蔽继承值。后续应给出真正稳定的布局覆盖路径 |
| **断点** | 780px 主移动断点，420 / 1000 / 1100px 等局部断点 | 属响应式结构规则，普通 `@media` 不能直接使用 CSS custom property，不要伪造可覆写的断点 Token |
| **圆角/边框** | 五档 radius 已被多个组件消费，hairline 有实际消费者 | 保留圆角尺度、分隔/焦点边框语义；药丸 999px 不是应该统一成普通圆角的“重复” |
| **阴影/z-index** | 多数为组件局部设定 | 先治理真实 overlay、drawer、popover 的叠层关系；无消费者的“完整阴影与层级尺”不建立 |
| **动效/交互** | 多处 hover、focus、reduced-motion 规则 | 保留键盘焦点、必要状态反馈与 `prefers-reduced-motion`；时长/缓动只在有实际复用时升级成 Token |

## 4. Markdown、Code Surface 和 Syntax Palette

### 4.1 Reading Typography

**[F]** [`src/ui/markdown/markdown.css`](../../packages/folio/src/ui/markdown/markdown.css) 拥有标题/正文、链接、列表、引用、行内代码、代码块、表格、Callout、锚点和 Mermaid 容器。`blockquote` 当前借用展示字族；对中文长篇阅读和系统标点并非天然可靠。移动 `.folio-table-scroll` 目前拥有键盘焦点和内部横滚，避免长代码撑宽页面。

**[P]** 建立阅读域语义：标题 h1–h4、段落、次级文本、链接交互、列表/引用、表格、图注、正文选区、行内代码。正文阅读宽度不要直接等同于 DocsShell 网格宽度。中文、英文、混排均需检查实际字形、行高与断行；视觉改动不得改变 H2–H4 生成的锚点、目录和静态 HTML 语义结构。

### 4.2 Code Surface

**[F]** `.folio-markdown pre` 当前为 `--folio-surface-dark` 背景，`13px/1.7` 等宽字体；`pre code` 默认色以及 `.hljs-*` 均有硬编码 hex。行内代码为 `12px` 与 `--folio-surface-card` 背景。浅色页面也显示深色代码块，这是当前外观，不是已经实现的“代码配色选择器”。

**[P]** 拆分 `code.surface`（块背景、文字、边框、圆角、字体、行高、选区、滚动和焦点）与 `inline-code`（行内背景、文字、字重、换行）；允许未来独立选择「浅页面＋深代码」或同步页面明暗。该未来选项不能擅自更改整个站点的 `color-scheme`。

### 4.3 Syntax Palette

**[F]** [`src/core/markdown.ts`](../../packages/folio/src/core/markdown.ts) 使用 `marked` 和 `highlight.js/lib/common`：已知语言高亮，否则 `highlightAuto`；输出 `hljs` 类。下列是[当前 Markdown CSS](../../packages/folio/src/ui/markdown/markdown.css) 的实际固定语法色，尚无相应 Token：

| 当前角色 / `hljs` 选择器 | 默认色 | 建议未来 Token |
|---|---|---|
| 基础代码前景 | `#e8e4dc` | `--folio-syntax-text` |
| comment / quote | `#7f8b86` | `--folio-syntax-comment` |
| keyword / literal / selector-tag | `#72d8c1` | `--folio-syntax-keyword` |
| title / function / section | `#f0b58a` | `--folio-syntax-function` |
| string / attr / template-variable | `#e7c27d` | `--folio-syntax-string` |
| number / variable / symbol | `#9fc4f2` | `--folio-syntax-number` |
| built_in / type | `#d8a8e8` | `--folio-syntax-type` |
| meta / punctuation | `#a9aaa5` | `--folio-syntax-punctuation` |

**[P]** 语法角色必须独立于页面/品牌色，代码语义适配层将角色映射到 `.hljs-*`，消费站不应长期覆写每一个内部选择器。[Inkstone 设计约束](https://github.com/Konata9/inkstone/blob/main/docs/design.md) 的「同一语义骨架、多变体光线、对比度/彩度预算」可借鉴，但它的编辑器语法槽位**不等于** highlight.js 的一一映射；Xuanzhi Light 和 Xuanmo Dark 只是候选色板。

**[D]** 第一阶段保留 highlight.js；若语言范围、语义细粒度或静态输出出现真实缺口，再独立评估 Shiki。主题换肤不是自动批准替换渲染器。

## 5. 复杂内容的归属与质量边界

| 表面 | 当前事实 [F] | 建议 [P] |
|---|---|---|
| **Callout** | `tip/info/note/warning/danger` 五类，通过 `.md-custom-block` 使用 teal、primary、warning、error 色彩混合 | 信息／警告／危险／成功角色分开；主品牌色不应无条件等于危险或信息状态 |
| **表格** | GFM table 外包可聚焦、横滚的 `.folio-table-scroll`；手机端减小单元格内边距 | 表头/分隔/背景/焦点拥有语义角色；不能退回整页横滚 |
| **Mermaid** | [`markdown-react.tsx`](../../packages/folio/src/markdown-react.tsx) 根据 `data-folio-theme` 选 `base`（浅）或 Mermaid `dark`，浅色的 fontFamily、primaryColor、lineColor 等是 **JS 硬编码**；MutationObserver 在主题变更后重绘 | 为图表文字/底色/连线提供从已解析 Semantic 推导的颜色；与代码 Syntax Palette 分离；保留失败时源码 |
| **React / 无 JS 静态** | [`static.ts`](../../packages/folio/src/static.ts) 和 React 共用 `renderFolioMarkdown`；静态 Mermaid 保留源代码，不自动变 SVG | 保证样式与语义一致，不将「增强后的 SVG」假冒静态预渲染能力 |
| **数学** | 当前 `core/markdown.ts` 没有可证实的 KaTeX/MathJax 路径 | 标记为**未来内容扩展需求**，本卡不声称已经支持数学公式 |
| **图片/原始 HTML** | Markdown 图片约束 `max-width:100%`；[写作指南](../../apps/site/content/guide/markdown-runtime.md) 允许可信内容原样 HTML | 图注/媒体模块和第三方 SVG 应有所有权，不将未经净化的 HTML 误当安全输入 |

**[F] 可信内容边界**：现有 `renderFolioMarkdown` 不执行通用 HTML sanitization；设计治理不改变此事实，也不会把视觉测试当安全测试。

## 6. Theme、Color Scheme、Brand 和覆盖顺序

- **[F]** [`ui-types.ts`](../../packages/folio/src/ui-types.ts) 的 `FolioThemePreference` 仅为 `light | dark | system`；[`app.tsx`](../../packages/folio/src/app.tsx) 最终设置根元素 `data-folio-theme`、`colorScheme` 和本地存储。Color Scheme **不是** Theme Preset。
- **[F]** [FOL-019](../research/fol-019-default-ui-baseline.md) 历史测试发现无 JS 静态 HTML 缺少 `data-folio-theme`、系统暗色偏好仍显示亮色，这是已记录 WARN，**不是本次重新跑出的结论**。
- **[P]** `Template` 负责页面结构，`Theme Preset` 负责成组的语义 Token，`Brand` 负责站名、Logo、品牌资产、有限覆写，`Color Scheme` 负责亮暗/系统偏好。这四项正交；配置 API 和模板问题归 [FOL-034](https://github.com/uichat-mira/folio/issues/138)。
- **[P]** 覆盖优先级（逻辑）：包基础语义 → 选定 Preset + 有效 Color Scheme → 消费站 Brand 的公开 Token 覆写 → 明确开放的组件局部覆写。现实 CSS 应在 Folio `styles.css` **之后**导入品牌 CSS，并针对暗色使用相应选择器；不靠一片 `!important` 修改内部类名。
- **[F]** `.folio-shell` 内声明的 `--folio-home-frame-width` 和 `--folio-reading-frame-width` 会覆盖根级继承变量；`--folio-docs-mobile-bar-height` 也是组件局部值。不能声称当前消费者只在 `:root` 修改布局宽度就一定生效；后续实施须给出稳定扩展点。
- **[F]** `--site-*` 是官方网站的别名，不是 Folio 发行包内置的双重 Token 来源。消费站品牌 CSS 不负责重定义 `src/styles.css` 的全局 `body/a/button` 规则。

**[P] 明暗成对与跨模式固定值的明确边界**：

| 类别 | Light/Dark 义务 | 代表角色（现有名称或未来语义） |
|---|---|---|
| 文字、画布、表面、边框、交互、反色内容 | **必须逐模式声明或显式证明复用同值满足对比度**，不能靠原色恰巧可读 | `--folio-ink`、`--folio-body`、`--folio-muted`、`--folio-canvas`、`--folio-surface-*`、`--folio-hairline`、`--folio-primary*`、`--folio-on-*` |
| 状态、信息 Callout、代码容器与 Syntax Palette、Mermaid 文本/背景/连线 | **必须按最终使用背景验证 Light/Dark 组合**；即使值相同也需有逐模式证据。当前 warning/error/success 等只有根值，不表示暗色可读性已通过 | `--folio-success`、`--folio-warning`、`--folio-error`、未来 `--folio-syntax-*`、图表语义 |
| 字族、间距、圆角、结构尺寸、响应式阈值 | **默认跨模式固定**；仅当布局/可达性场景有明确证据时引入模式差异。它们可以随 Brand/Preset 变，但不应仅因 Light/Dark 切换而变化 | `--folio-font-*`、`--folio-space-*`、`--folio-radius-*`、`--folio-header-height`、组件布局宽度和断点 |

**[F/P 区分]** 当前机器合同只要求既有 **18** 个 dark 覆盖名及顺序；上表是**后续主题实施的检查合同**，不是声称当前其他颜色已实现暗色对值，也不授权本卡修改 `styles/contract.mjs`。

### 两个重点的真实参照

**Pearl / 珍珠白**：现有 [`tomzlab-web@prod`](https://github.com/uichat-mira/tomzlab-web/blob/prod/assets/css/site.css) 为独立网站设计，`--paper:#faf9f6`、`--white:#fffefa`、`--ink:#252522`、`--line:#e7e6e0`，强调柔和纸张、细边界、CJK 字体回退和留白；**并非已通过 Folio 公开 API 实现的主题**。后续实现应以「不复制 Folio 组件源代码也能表现相近品牌视觉」作为真实消费者验收。

**Inkstone / 墨观**：[源码](https://github.com/Konata9/inkstone)及[设计约束](https://github.com/Konata9/inkstone/blob/main/docs/design.md)提供传统色可追溯、语义色槽位、多个亮暗变体及色彩审计的参考；本卡不引入依赖，不直接复制编辑器颜色检查阈值，也不强制所有 Folio 消费站采用中国传统色。

## 7. CSS 所有权和单一发布合同

| 所有者 | 负责 | 不负责 |
|---|---|---|
| `src/styles.css` | 38 个根 Token、18 个暗色覆盖及既有全局基础规则 | 站点 Logo、Editorial 专属组合 |
| `src/styles/content.css` | 共享 `.folio-content`、`.folio-doc-page`、`.folio-home` 页面框架，受 `ownership:content` 门禁约束 | Header/Markdown/Search/DocsShell 私有规则 |
| `src/ui/**` 的组件 CSS | 自己的状态、排版、布局和少量组件私有值 | 对别的组件作全局 CSS 接管 |
| `core/markdown.ts`、`static.ts` | 共享 Markdown HTML 语义、静态阅读输出 | 依赖任意 ReactNode 自动静态化 |
| `markdown-react.tsx` | Mermaid 渐进增强、错误回退 | 第二套独立品牌色真相源 |
| `apps/site/src/site.css`／其他消费者 | 品牌标识、消费者内容和**正式开放**的覆盖接口 | 持续克隆/替换 Folio 组件 CSS |

**[F]** 公开 CSS 仍只有 `@uichat-mira/folio/styles.css`；[`manifest.mjs`](../../packages/folio/styles/manifest.mjs) 确定有序级联，包验证由 [`contract.mjs`](../../packages/folio/styles/contract.mjs) 和 [FOL-020](../research/fol-020/README.md) 的真实 tarball 检查守护。**[P]** 未来对外应声明可覆写变量白名单，而非默认把全部 `.folio-*` 内部类作为稳定 API。`@layer` 或新构建器会改变级联，必须独立论证、实现、验证，不能夹带在主题施工中。

## 8. 质量条件、最小迁移计划与待裁决

**[P] 后续实施验证矩阵**：正文、弱化文字、链接、交互、代码语法颜色分别在亮/暗模式下测实际对比度；一般正文目标 ≥4.5:1，焦点/必要非文本视觉目标 ≥3:1（按适用 WCAG 成功准则区分）。检查 CJK／英文／混排、长代码、320/375/390 移动宽度、768/1024/1440 桌面宽度、键盘焦点、`prefers-reduced-motion`。保留表格容器内部滚动，不扩展整个页面；静态 HTML 与 React 共享 CSS；Mermaid 无 JS 时源代码可读。**这些是未来验收要求，本卡没有执行这些浏览器检查。**

**[P] 逐步落地，不一次性重写**：

1. **FOL-033**：本规范——审计、映射、分层、Reading/Code/Syntax 归属，单一文档；不动 CSS、运行时、公开 API。
2. **FOL-034**：裁决 Pearl/Editorial/Graphite 是否为正式 Preset；确定通用默认、Moyu 兼容、Template/Brand/Color Scheme、代码亮暗如何组合。
3. **实施 A**：最小公共 Semantic / Reading Token，修正 `.folio-shell` 布局扩展性；用 Pearl 独立消费者验证，不复制内部选择器。
4. **实施 B**：Code Surface 与 Syntax Palette；优先保持 highlight.js，验证 Xuanzhi Light/Xuanmo Dark 角色映射。
5. **实施 C**：按真实证据修 Mermaid 配色与静态降级，并验证官方站、个人刊物和文档站；不先造大型 Theme Engine。

**[D] 需要维护者在 FOL-034 裁决的事**：Pearl 是否成为通用默认还是 opt-in；Editorial 如何保留给 Moyu；Graphite 的深色定位；代码块默认跟随网站明暗还是独立可选；通用默认首页是否继续携带个人日志语义。本文只陈列选项与后续证据路径。

**本卡边界/验证声明**：只新增这份 `docs/design-system/README.md`。无 `styles.css`、`contract.mjs`、CSS manifest、JS/TS、`apps/site`、公开 API 修改；无 npm 发布/部署。对当前源码与历史研究进行定向审计，**未实际运行新的全量构建、浏览器视觉验收或对比度自动化测试**；所需实现检查仍应使用已有 `styles:verify`、`pack:verify`、`pack:consumer`、Windows package 与真实消费者验收，不以本文文本代替其运行证据。

