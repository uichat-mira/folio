---
title: Folio 设计系统：秩序与气质
description: 从内容、语义 Token 到可组合模板，解释 Folio 如何让同一系统承载不同网站气质。
collection: 参考
section: 设计
group: 设计
order: 10
type: doc
status: published
tags: [Design System, Theme, Folio]
---

> **设计系统不是一张漂亮截图，而是一份关于变化的契约。** 如果一套系统只能在设计稿中的一页成立，那它还不是系统。
>
> 本文写的是 Folio **当前 dev 实现的设计思想与使用边界**。交互 API 尚未发布到 npm 0.1.1；实际 CSS、类型与代码以文末链接的源码为准，不以文档快照为准。

## 一、为内容建立秩序，而不是为界面固定气质

内容发布引擎有一个特殊问题：它今天可能是软件文档，明天是期刊，后天又是团队门户。若每次变化都要复制一份组件、重写整个主题，维护者很快就会面对三套不相干的系统。

Folio 要保留的是**关系**：标题与正文的层级、正文与注解的密度、动作与状态的区分、导航与内容的归属、静态与动态输出的一致。可以改变的，是**表达**：字体偏好、色彩氛围、页面排布、代码阅读环境。

这也是它和一份单纯的品牌视觉手册最大的区别。品牌可以覆盖视觉，但不能取消语义；模板可以改变文章如何进入视野，却不应该另建一套文章数据和路由。

<div class="design-ref-fallback-swatches" role="img" aria-label="随着实际主题改变的 Folio 语义色带：主色、画布、墨色、强调色">
  <span style="background:var(--folio-primary)"></span>
  <span style="background:var(--folio-canvas)"></span>
  <span style="background:var(--folio-ink)"></span>
  <span style="background:var(--folio-accent-teal)"></span>
</div>

上面不是手填的色卡：每块色彩都读取正在生效的 `--folio-*` 变量。切换 Header 明暗时，它们会随 CSS 一起改变。更完整的 [实时 Token 图鉴](/reference/design/tokens) 甚至直接读取浏览器计算样式，**文档不会维护另一份十六进制色库**。

## 二、四条正交的设计轴

Folio 不把“石墨色”和“深色模式”绑死，也不会把“刊物首页”等同于“刊物配色”。四条轴分别解决四个问题：

| 轴 | 可选值 | 决定什么 | 不决定什么 |
| --- | --- | --- | --- |
| Visual Preset | Pearl / Editorial / Graphite | 整站的语义色、表面、字体气质 | 路由、内容结构、用户系统明暗偏好 |
| Scheme | System / Light / Dark | 此刻应用什么明暗层级 | 代码必须使用明码还是暗码 |
| Code Palette | Auto / Xuanzhi / Xuanmo | 代码块表面和 highlight.js 语法角色 | 页面背景、Header 或 Footer |
| Home Template | Portal / Editorial | 内置首页的布局和内容呈现 | 官网自定义 `slots.home` 的品牌首页 |

这提供了 **3 × 3 × 3 × 2 = 54 种选择组合**。其中 `System` 和 `Auto` 会随环境解析到实际明暗，因此不应将 54 解释成 54 套手工绘制的 CSS。

**Pearl** 以克制的珍珠白与阅读优先的关系构成默认体验，不等于“所有组件都必须是白色”。**Editorial** 保留温暖的出版气质与强调层级，更接近刊物。**Graphite** 则用冷静、精密的对比表达工具与技术内容。这是当前三套产品化预设，而不是对审美的最终裁决。

**Portal** 是入口组织：先回答“去哪里”。**Editorial** 是叙事组织：先回答“读什么”。它们使用同一个 `resolveFolioHome()` 数据模型，由公开 `FolioHome` 组件渲染；内容排序、导航和 basePath 不需要重新实现。

## 三、在真实页面上试，而不是在孤立色板上猜

下面的 HTML 容器会在 Folio 官网 React 运行时通过**公共** `useFolioAppearance()`、`FolioHome` 增强。改变 Preset 或 Scheme，当前文档、全局 Header 和 Footer 的 Token 都会真正变化；切换 Home Template 只切换局部内置首页。没有运行时脚本时，保留容器内的说明，不提供一组失效按钮。

<div class="design-ref-slot" id="design-ref-theme-slot" aria-label="Folio 主题与首页模板实时实验">
  <div class="design-ref-fallback">
    <p><strong>Live Theme Studio · 交互增强区</strong></p>
    <p>静态文档保留本说明。进入可运行的 Folio 官网后，本区域提供四维组合选择、真实首页组件预览、恢复偏好与复制配置；它不执行 Markdown 里的任意脚本，也不维护一套模仿主题的 HTML。</p>
    <div class="design-ref-fallback-swatches" role="img" aria-label="基于 Folio 当前 Token 的语义色">
      <span style="background:var(--folio-primary)"></span>
      <span style="background:var(--folio-surface-soft)"></span>
      <span style="background:var(--folio-ink)"></span>
      <span style="background:var(--folio-accent-amber)"></span>
    </div>
    <details>
      <summary>为什么静态页面不提供四维选择按钮？</summary>
      <p>因为切换真实站点主题属于 FolioApp 的运行时能力。无 JavaScript 时依然保留内容与颜色示意，不制造没有作用的控件。</p>
    </details>
  </div>
</div>

如果这张预览以后出现一套和首页主体不同步的“样板皮肤”，那是实现退化。**展示必须是实际组件和实际 CSS 的消费结果**，不能成为第二套模拟 Folio。

## 四、Token 的三层权力

大型系统通常会把设计变化按 **Reference / Primitive → Semantic → Component** 分层处理。Folio 的设计治理沿用这个判断框架，但必须区分“方向”和“已发布实现”：

- **Primitive / Reference（治理方向）**：色相、数值与尺度的原始材料。它们不该被按钮和表格直接用作“语义”。
- **Semantic（当前稳定的消费入口）**：`--folio-ink` 表示主要阅读文字，`--folio-canvas` 表示页面画布，`--folio-primary` 表示主交互强调。使用者应该根据职责覆盖，而不是根据它今天看起来像哪种颜色覆盖。
- **Component（局部实现）**：表格滚动、树形导航、搜索、Popover 的具体尺寸和交互。只有被验证的跨组件复用需求，才值得新增公开 Component Token。

这里的三层是**工程上的权责方向**，不是声称 Folio 已经公开了一份全新的 `--folio-ref-*` API。当前发布的变量名、Scope 与值仍以 [Folio 源样式](https://github.com/uichat-mira/folio/blob/dev/packages/folio/src/styles.css) 为准。

举例说，某个预设里 `primary-disabled` 和 `hairline` 碰巧等色，不代表它们的职能相同；下一套预设或对比度调整就可能让它们分开。设计系统保留的是这种**允许未来分化的语义**。

## 五、字体、节奏与中文阅读

Folio 暴露三种字族角色：

| 角色 | 公开 Token | 用途 |
| --- | --- | --- |
| Interface / Sans | `--folio-font-sans` | 顶栏、操作、正文的界面基调 |
| Display | `--folio-font-display` | 标题、刊物中的强调表达 |
| Mono | `--folio-font-mono` | 代码、日期、元信息与索引 |

这些是 CSS 字族**回退链**，不是对终端设备必定安装某个字体的承诺。中文宋体、英文字体、数字宽度和标点的表现需要在实际终端核对；纯英文衬线字体不应被当作中文标题的唯一渲染依据。

正文关注的是**可阅读的长度**，而不是把 Header 与文章强制压成同一宽度。Folio 分离首页框架与阅读框架，也允许消费站用自己的内容密度、插画与空白组织视觉。组件尺度中有意保留局部值；不应为了“所有值都有 Token”机械抽象每一个像素。

## 六、语义必须经受住真实世界

设计验收不止是“看起来统一”，至少要回答下面这些问题：

1. **可读性**：主文字、次级文字、代码语法色在各预设与明暗组合中是否足够辨认？当前官网有聚焦对比度回归测试，但它不等于任意屏幕的完整无障碍认证。
2. **键盘与焦点**：Select、按钮、内部滚动区是否可用；屏幕阅读器是否能辨认控件的目的？
3. **内容完整性**：代码长行和宽表格在小屏幕中是否**局部滚动**，而不是把整页撑破？
4. **系统偏好与恢复**：读者主动选择的明暗优先于网站默认；临时主题探索不等于永久修改偏好。
5. **渐进增强**：静态 HTML 先承载内容，交互是增强层。Mermaid 失败时保留源码，网页不能因一段图形脚本失去文本。

**不能为了视觉一致性破坏这些约束。** 在 Folio，设计系统同时要对发布可靠性和访问边界负责。

## 七、Brand 与 Runtime 谁说了算

消费站可以在官网外壳里自由设计 Logo、插画、首页章节和文案，例如官方站通过 `slots.home` 自定义整个首页；但它不能借此要求读取 `packages/folio/src/*` 的私有组件。没有公开 API，就应回到框架确认扩展点，而不是复制实现。

运行时的外观状态由 `FolioApp` 单独维护：

- `preview(partial)` 只覆盖本次会话的选项；
- `resetPreview()` 恢复已保存的主动明暗偏好，其次是配置和系统；
- Header 主动明暗切换才写入用户的选择；
- 静态构建依据配置与 CSS media query 保留无 JS 的表现。

由此，品牌表达与设计规则可以共存，而不是相互吞噬。

## 八、下一步该怎样继续生长

我们不会因为已经有三套 Preset，就宣称 Folio 已经拥有完整的主题市场或拖拽设计器。当前真正需要长期维护的是：公开 Token 的向后兼容、代码色板的独立性、内容与模板模型的复用、真实站点消费测试，以及每一次视觉变化是否伤害可访问性。

要查看每一条当前生效的 CSS 变量、代码色板与覆盖方式，请继续阅读 **[Folio Token 图鉴：语义、代码与主题治理](/reference/design/tokens)**。

**版本说明**：本篇针对 `dev` 的 FOL-049～053 设计链，**不是 npm 0.1.1 的发布说明**。准确 API 版本以 [消费者契约](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md) 与发行记录为准。
