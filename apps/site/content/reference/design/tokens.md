---
title: Folio Token 图鉴：语义、代码与主题治理
description: 以运行中的 CSS 变量为唯一事实源，浏览语义色、字体、尺度、代码语法和覆盖边界。
collection: 参考
section: 设计
group: 设计
order: 20
type: doc
status: published
tags: [Design Tokens, CSS, Code Theme]
---

> **Token 不是颜色名字的缩写，而是“何时、何处、由谁负责”的语言。**
>
> 本页不是另一份 theme.json。下方图鉴从**当前页面实际计算出的 `--folio-*` CSS 变量**读取名称和值；不同 Preset、Scheme 与 Code Palette 的结果随框架更新。文中表格只陈述**语义角色与使用规则**，不复制任何一套固定十六进制色板。

## 一、先看真实结果：活的 Token 与代码主题

<div class="design-ref-slot" id="design-ref-tokens-slot" aria-label="Folio 设计 Token 与代码主题实时图鉴">
  <div class="design-ref-fallback">
    <p><strong>Live Token Atlas · 交互增强区</strong></p>
    <p>HTML 静态预渲染直接消费下方 CSS 变量，显示当前站点的色彩关系。官网 React 启动后，页面会列出浏览器计算得到的所有 `--folio-*` 变量，并能分别调整网站外观和代码色板。</p>
    <div class="design-ref-fallback-swatches" role="img" aria-label="来自 Folio Token 的色彩样本：画布、主要文字、主交互色与代码背景">
      <span style="background:var(--folio-canvas)"></span>
      <span style="background:var(--folio-ink)"></span>
      <span style="background:var(--folio-primary)"></span>
      <span style="background:var(--folio-code-bg)"></span>
    </div>
    <details>
      <summary>没有 JavaScript 时如何检查 Token？</summary>
      <p>静态色带和下面的公开 Token 角色说明仍然可读。色值的真实声明请查看仓库中的 styles.css；不依赖插入一段会在 React 导航后失效的文档 script。</p>
    </details>
  </div>
</div>

交互模式的两个重要事实：

- **Site Theme** 对阅读框架、界面和内容生效。Preset 负责视觉气质，Scheme 负责最终明暗。
- **Code Theme** 只负责代码表面、基础文字和语法角色。Code Palette 设为 `auto` 时，在有效浅色模式选择 **Xuanzhi（宣纸）**，有效深色模式选择 **Xuanmo（玄墨）**；也可以明确指定一个与网站明暗不同的色板。

上方代码示例来自真正的 `FolioMarkdown` 与 `highlight.js` 输出，**没有手写 `.hljs-* ` 色值**。它不是 PNG，也不是专门为文档造的代码模型。

## 二、颜色：用“职责”识别，而不是用色相识别

Folio 根 Token 的名字本身就在传达设计契约。下表只给出角色和用途，所有当前数值都通过上方实时图鉴或 [源码](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/styles.css) 查询。

| 角色 | CSS Token | 使用时机 |
| --- | --- | --- |
| 主交互 | `--folio-primary`、`--folio-primary-active`、`--folio-primary-disabled`、`--folio-on-primary` | 主按钮、交互强调、禁用与反色前景；不要直接拿品牌色代表错误状态 |
| 文字层级 | `--folio-ink`、`--folio-body`、`--folio-body-strong` | 主标题、长文正文、强调文字 |
| 弱化文本 | `--folio-muted`、`--folio-muted-soft` | 元信息、注解、占位与次级信息；不等于可以无限降低对比度 |
| 页面与层级 | `--folio-canvas`、`--folio-surface-soft`、`--folio-surface-card` | 阅读背景、轻分区、卡片与承载面 |
| 反色表面 | `--folio-surface-dark`、`--folio-surface-dark-elevated`、`--folio-on-dark`、`--folio-on-dark-soft` | 深色衬底与对应文字 |
| 分隔 | `--folio-hairline`、`--folio-hairline-soft` | 列表、导航与面板边界 |
| 点缀 | `--folio-accent-teal`、`--folio-accent-amber` | 罕量强调、图表与视觉提示 |
| 状态 | `--folio-success`、`--folio-warning`、`--folio-error` | 成功、警告与错误；与品牌动作保持独立 |

**为什么相同色值不能合并两个 Token？** 因为 `on-dark` 与 `canvas` 今天可能一样，明天却可能分叉；“用在什么位置”比“现在是什么色”更值得长期保存。设计系统应当能在后续主题调整中承担变化，而不是把所有组件绑在某个十六进制数上。

当前 CSS 包含 Root 的基础值、三个 Preset 的覆写、显式深色、静态系统深色回退；浏览器最终使用的**计算值**才是实际表现。请勿拿旧研究文档的截图数值覆盖当前源码。

## 三、字体、尺度、布局：什么时候要 Token

| 类型 | Token | 设计边界 |
| --- | --- | --- |
| 字族 | `--folio-font-sans`、`--folio-font-display`、`--folio-font-mono` | 界面、标题和代码；用真实系统 fallback，中文与英文分别核查 |
| 圆角 | `--folio-radius-sm / md / lg / xl / pill` | 供组件一致消费；圆角不是一张统一值的命令 |
| 间距 | `--folio-space-xs / sm / md / lg / xl / 2xl` | 公开尺度；部分当前包内组件仍使用局部尺寸，不宣称全部间距均已 Token 化 |
| 框架宽度 | `--folio-home-frame-width`、`--folio-reading-frame-width` | 入口页面与阅读页面的独立宽度 |
| Header | `--folio-header-height` | 阅读壳、固定导航的高度契约 |

**不要伪造断点 Token。** CSS `@media` 目前不能直接把普通 CSS custom property 当查询阈值。移动端结构断点属于组件响应式规则；改了 CSS 变量不等于改了所有排版断点。设计系统尊重 CSS 能力边界，而不是在文档里发明一个并不存在的 API。

展示字体与中文 fallback 也不能靠强制一种西文衬线字体来解决。Folio 的两类页面有不同需要：技术参考更看重密度与扫描，刊物型首页更看重节奏与叙事。两种判断仍可在同一份类型与 Token 合同上共存。

## 四、代码主题：表面与语法是两张表

**Code Surface** 决定“代码被放在哪张纸上”，**Syntax Palette** 决定“这张纸上的词如何分辨”。二者共同受 `codePalette` 控制，却独立于网站 `preset`：

| 层级 | Token | 对应职责 |
| --- | --- | --- |
| 代码表面 | `--folio-code-bg`、`--folio-code-fg`、`--folio-code-border` | 代码块底色、一般文字、边界 |
| 一般语法文字 | `--folio-syntax-text` | 代码高亮的默认前景 |
| 注释 | `--folio-syntax-comment` | 辅助信息及注释 |
| 关键字 | `--folio-syntax-keyword` | 语言关键字、字面量与选择器 |
| 函数 | `--folio-syntax-function` | 函数名与标题 |
| 字符串 | `--folio-syntax-string` | 字符串与属性值 |
| 数字 | `--folio-syntax-number` | 数值与标量 |
| 类型 | `--folio-syntax-type` | 类型与内建类型 |
| 标点 | `--folio-syntax-punctuation` | 标点、meta 与语法辅助 |

Folio 的 `marked` + `highlight.js` 负责从 Markdown 产生标准的高亮类；CSS 再将 `.hljs-*` 映射到上面这些 Token。**渲染器和配色分开治理**，主题变更不需要复制 Markdown AST 或运行两套 syntax highlighter。

这并不意味着把 Mermaid 图表也绑到代码色板。Mermaid 消费的是页面语义颜色（画布、文字、线条等），属于阅读内容的一部分；语法高亮只是代码呈现层。静态 Mermaid 保留可读源码，浏览器增强成功后才会替换 SVG。

## 五、覆盖规则：消费站可以设计，但不能争抢所有权

官方站已经证明：品牌站可以拥有自己的 Logo、排版和首页，**同时**让真实 UI 使用 Folio 语义 Token。消费者可建立自己的 `--site-*` 透明别名，保留业务品牌层：

~~~css
/* 假设消费站自己已提供 --brand-accent。
   这只是角色映射示例，不复制 Folio 内部色板。 */
:root {
  --folio-primary: var(--brand-accent);
}
~~~

使用这类覆盖时请注意：

1. **引用公开角色，而非框架内部组件选择器**。下游不能靠覆盖每一个 `.folio-*` 私有规则建立持久品牌。
2. **覆盖顺序是真实 CSS 顺序**。先导入 `@uichat-mira/folio/styles.css`，再导入站点 CSS；不要随意加 `!important` 争夺优先级。
3. **一个角色的全场景对比度需要复核**。只改 `primary` 未必保证新的 `on-primary` 与 `primary-active` 在所有预设及暗色下仍可读。
4. **不要在消费站自行写 `document.documentElement.dataset.folioTheme` 等根状态**。React 应用应通过 `useFolioAppearance()`；静态 HTML 由 Folio 预渲染与 CSS 回退负责。
5. **代码主题另有独立 Token**。改页面背景并不能推导代码块底色；代码区使用自己的 `--folio-code-*`、`--folio-syntax-*`。

Folio 公开了单独的 `--folio-home-frame-width` 与 `--folio-reading-frame-width`，并调整了其覆盖位置，使外部样式可以真正生效。这比“文档上写着一个 Token，但组件局部作用域把它盖住”更重要。

## 六、运行时选择与读者偏好

当前 `dev` 的配置合同：

~~~ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Field Notes",
  description: "A Git-native publication",
  appearance: {
    preset: "graphite",
    scheme: "system",
    codePalette: "auto",
  },
  home: { template: "editorial" },
});
~~~

- `scheme: "system"` 跟随操作系统，`codePalette: "auto"` 再依据**最终生效**的明暗选择 Xuanzhi 或 Xuanmo；
- 用户经 Header 明确选择过 Light/Dark 时，那个选择应被保留；主题实验区调用的 `preview()` 不持久化；
- `resetPreview()` 恢复读者选择及网站默认值；它**不是**“强行改成浅色”的快捷键；
- `FolioHome` 的 `template` 和整个网站的视觉 Preset 是两条轴，切换模板不是切换品牌色。

阅读真实运行时的组合方式见 [设计系统：秩序与气质](/reference/design/principles) 和 [官网首页交互 Design 区](/#portal-design-title)。

## 七、治理纪律：谁来决定新增一个 Token

增加 Token 时应回答五个问题：**谁消费？它的语义是什么？在哪些主题和状态下变化？有无可访问性代价？当前发布版本如何兼容？**

Folio 当前不承诺完整的 Primitive 或 Component Token DSL。现有公开名仍是权威；`--folio-ref-*`、新格式的 Token JSON、在线编辑器都不应因为“更像大厂设计系统”而被偷偷加入公共 API。

重复颜色不必立即合并，未被框架内部 CSS 消费的空间尺度也不等于死变量。删除前应查真实消费者、发行版本、CSS 聚合门禁和包外使用案例。反过来，只有被真实页面反复需要的组件级角色，才值得抽象。

每次设计变化除了截图，还应留下真正的证据：构建产物、可用路由、键盘与手机布局、明暗与代码色板的可读性、静态文档是否保持原有语义、npm tarball 消费者是否受损。审查工具只提供证据，不能代替设计判断。

## 八、源码、对照研究与版本

- [公共 CSS Token 与主题覆写](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/styles.css)：**数值与覆盖规则的唯一事实源**。
- [Markdown 代码语法角色](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/ui/markdown/markdown.css)：标准语法类如何消费 Token。
- [运行时外观控制 API](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/ui/appearance-react.tsx) · [预设校验](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/core/appearance.ts)。
- [组件 API](/reference/components) · [官方站作为公共消费者](/reference/site)。
- [设计基础治理研究](https://github.com/uichat-mira/folio/blob/dev/docs/design-system/README.md)：历史决策与治理方向，**不要把它当作当前色值表**。
- [第三方 Claude 视觉设计研究](/reference/examples/product-design-system)：借鉴其详尽表达方式，但与 Folio 当前系统及品牌无关，也不是 Folio 的 Token 数据源。

**版本边界**：本文记录的是当前 `dev` 设计系统，不代表 npm `0.1.1` 已包含 Preset、Code Palette、`FolioHome` 或 `useFolioAppearance()`。请以 [消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md) 及实际发布标签为准。
