# FOL-003 · Markdown 原始 HTML 信任边界（研究结论）

- **Issue**: [FOL-003 #47](https://github.com/uichat-mira/folio/issues/47)
- **性质**：研究与决策建议；不是生产代码变更、修复授权或 npm 发布验收
- **复现基线**：Folio `dev` @ `de368cbbebf9ce53c496a4fe722f992da99abdc1`
- **运行探针提交**：`c96e170c188a906fbfc38adc2301292532d677a0`（仅添加临时测试，未修改生产行为）
- **运行证据**：[GitHub Actions Validate #41229211119](https://github.com/uichat-mira/folio/actions/runs/41229211119)，Linux `npm run release:check`，日志过滤关键字 `FOL003_PROBE`
- **日期**：2026-11-01

## 1. 结论

当前 Folio **保留受信任 Markdown 内的原始 HTML**，而**没有不可信内容所需的 HTML 清理/危险 URL 过滤边界**。这是已经通过真实包构建和代码路径验证的技术事实，不是“当前站点已经受到 XSS 攻击”的宣称。

**建议**：对 0.1.0 首发先采用 **受信任内容专用** 的明确范围，不以 Folio 处理不可信用户投稿为卖点；在产品和文档中说明审核责任。若要接入未经人工审核的 PR 内容、远程抓取或用户投稿，则必须先另行决策和实施独立的安全渲染模式，不得直接复用当前默认路径。此研究不擅自改变已有公共 API 或受信任 HTML 行为。

## 2. 实际数据与渲染路径

| 路径 | 实际代码 | 当前边界 |
| --- | --- | --- |
| Markdown 解析 | `packages/folio/src/markdown.ts` 的 `renderFolioMarkdown` | 保护围栏代码，抽取 `::: html`，再调用 `marked.parse`；HTML 块被**原样插回**，Callout 正文也经另一次 `marked.parse`。只对代码、Mermaid 文本和生成的部分属性做转义，**没有全局 sanitizer 或 URL scheme policy**。 |
| React UI | `packages/folio/src/markdown-react.tsx` 的 `FolioMarkdown`；`app.tsx` / `docs-shell.tsx` 使用组件 | `useMemo(renderFolioMarkdown)`，随后 `dangerouslySetInnerHTML={{__html:html}}` 写入页面。React 的普通 JSX 自动转义不保护这条原始 HTML 注入路径。 |
| 静态站 | `packages/folio/src/static.ts` 的 `defaultRoutes` / `renderStaticDocShell` / `renderFolioStaticHtml` | `renderFolioMarkdown(doc.body)` 生成内容，放进 `route.body`，再替换 HTML 模板中的 root。此处对页面标题与元数据做了转义，**但不会清理 Markdown 产生的 HTML 正文**。 |
| 输入来源 | `packages/folio/src/vite.ts` 的 `readManifest` | 从仓库 Markdown 文件解析正文；`parseFolioDoc` 生成内容模型。源文件“在 Git 中”不自动等于所有提交者和内容都可信。 |

此外，`staticRoutes.routes()` 消费者可自行提供原始 HTML body；这是一条**消费者自行构造 HTML** 的公开功能，和本卡 Markdown 信任问题不同，不据此扩大研究或擅自改变 API。

## 3. 最小复现及实际输出

在临时隔离研究提交 `c96e170` 中创建 `packages/folio/test/fol-003-temp-probe.test.mjs`，使用**同仓库的真实 `dist/index.js` / `dist/vite.js`** 和 `react-dom/server` 运行受控 Node 测试。探针从不使用真实令牌，也不打开浏览器执行事件处理器；`window.__folio_probe=1` 只是用于识别输出的惰性标记。

复现输入（只在测试中传给解析器，不发布到真实站点）：

~~~text
<img src=x onerror="window.__folio_probe=1">

::: html
<img src=x onerror="window.__folio_probe=1">
:::

::: warning
<img src=x onerror="window.__folio_probe=1">
:::

[open](javascript:window.__folio_probe=1)

```html
<img src=x onerror="window.__folio_probe=1">
```
~~~

实测结果（Actions 日志记录的输出布尔标记）：

| 测试输入 / 出口 | 观察到的输出 | 结论 |
| --- | --- | --- |
| 普通原始 `<img>` | `literalImgTag=true`、`eventAttribute=true` | HTML 事件属性被保留 |
| `::: html` 中的同一输入 | `literalImgTag=true`、`eventAttribute=true` | 专用 HTML 块按可信内容直通 |
| `::: warning` 中的同一输入 | `callout=true`、`eventAttribute=true` | Callout 不是安全清理边界 |
| `[open](javascript:window.__folio_probe=1)` | `jsHref=true` | 危险 URL scheme 未被拒绝 |
| HTML 代码围栏中的 `<img>` | `literalImgTag=false`、`escapedTag=true` | 围栏内容按代码转义，**未**形成 HTML 节点 |
| 代码围栏中的 Callout 语法 | `callout=false` | 不会误转换为活动 Callout |
| 可信 `::: html` 自定义 `div` / SVG | `htmlClass=true` | 现有自定义 HTML 能力有效 |
| `FolioMarkdown` 的 React SSR 输出 | `literalImgTag=true`、`eventAttribute=true` | React HTML 注入路径携带相同属性 |
| `writeFolioStaticSite` 的实际 `docs/unsafe/index.html` | `literalImgTag=true`、`eventAttribute=true` | 静态产物携带同一属性 |

Linux 实测三组新子测试全部 `ok`，整个 package test **44 pass / 0 fail**；本次临时探针只用于建立安全行为的事实，不宜作为永久回归测试，因为未来修复该行为时正确结果应改变。研究结束应从最终 PR 删除该临时测试，保留本文件与可追溯的运行日志 SHA。

**证据边界**：这证明不安全 HTML/URL 字符串穿过真实渲染和静态构建链路；**没有**在浏览器执行攻击事件、窃取数据，也没有测浏览器 CSP、站点可达性或实际生产攻击。HTML 字符串包含事件属性并不等于已经发生利用，但在接收不可信输入时足以建立需要防护的风险路径。特别注意：通过 `innerHTML` 插入的 `<script>` 通常不会直接运行，不能用这个现象宣称事件属性或危险链接安全。

## 4. 威胁模型和兼容约束

| 输入模式 | 可信假设 | 风险判断 |
| --- | --- | --- |
| 维护者审阅、受控合并的仓库 Markdown | 站点运维者本就允许该作者发布 HTML | 可把原始 HTML 当成受信任高级能力；仍须保护发布和仓库权限 |
| 官方导入的历史设计系统示例 | 来源在进入仓库前审核且内容固定 | 必须保留对布局标签、`class`、`id`、内联 `style` 和 SVG 的支持 |
| 未经审核的外部 PR / Markdown 拉取请求预览 | 作者不一定有发布站点脚本的权限 | 不可在正式域名或带授权态的预览站点直接渲染未经审核的 HTML |
| 远程抓取、用户提交、开放协作文档 | 内容编辑者通常不等于可执行脚本的受信任站点开发者 | **当前默认渲染器不安全，不应直接接入**；需独立信任策略和防护 |
| 公开 npm 消费者自行传入任意字符串 | 由消费者拥有数据来源与使用场景 | 当前 Folio 没有向调用方提供不可信输入安全保证，使用文档应明确这一边界 |

在 `apps/site/content/api/examples/product-design-system.md` 中，可见大量真实的 `<div>`、`<section>`、`<svg>`、`class`、`style` 和锚点。这意味着直接默认转义/删除所有原始 HTML 会产生实质兼容退化；现有 `removeH1` / `headingAnchors` 参数也不是安全策略开关。

第三方资料：
- [Marked 官方警告](https://marked.js.org/)：Marked 不负责清理输出 HTML；使用可能不安全的输入必须额外防护。
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet)：不可信 HTML 应进行维护良好的清理，危险 URL 应验证协议，CSP 仅是附加防御，不能替代内容清理。

## 5. 有限决策方案

### A · 0.1.0 仅承诺可信仓库内容（推荐的近期最小方案）

- 明确声明 `renderFolioMarkdown`、`FolioMarkdown` 和静态构建**保留原始 HTML，均不保证可安全呈现不可信输入**。
- 使用者负责内容提交审核、预览域隔离与生产发布控制；不要将未经审核的外部 Markdown 直接发布在用户登录态或可信域名。
- 保留当前 HTML、Callout、Mermaid 和既有设计系统示例的兼容性；无需为了本研究修改运行时或增加依赖。
- 代价：消费者若误将不可信内容当作可信内容使用，仍存在 XSS 风险；文档警告不是沙箱。**只允许在可信内容范围内宣称 0.1.0 发布可用。**

最小后续施工（若批准）：在包 README / 公共 API 的 Markdown 说明及首发说明中统一写出**trusted-content-only** 使用合同，辅以一条不可信内容禁用警示。不需要先引入完整 sanitizer。

### B · 在 Folio 中正式支持不可信 Markdown（需要独立设计/实施，不在 FOL-003 中施工）

- 设计明确的 API 信任策略（例如显式 `htmlPolicy: "trusted" | "sanitize"`，**只是候选命名，尚未获批准**），决定新旧消费的默认值与兼容规则；不能让“未传参数”悄悄改变既有设计系统示例。
- 在 Markdown 解析、HTML 块和 Callout 全部拼装完成后，于统一边界执行经过维护的 HTML sanitization + URL 协议白名单，并让 React 和静态生成共用这条结果。不能先 sanitizer、后又插入未清理的 `::: html`。
- 独立验证 `onerror` / `onclick`、`javascript:`、危险 SVG/MathML、`iframe/srcdoc`、协议绕过及可信案例回归；覆盖真实 `dist`、tarball、React HTML 与静态页面；同时评估浏览器/Node 环境的 sanitizer 成本与依赖。
- Mermaid `securityLevel: "strict"` 只能保护 Mermaid 自身的渲染边界，不能替代 Markdown 清理；其异步 `innerHTML` 插入逻辑亦需要在安全模式评审中验证。
- 若产品决定将不可信输入作为 0.1.0 承诺功能，则**在首发前阻断并完成 B**，不能用研究卡结论冒充已提供防护。

**明确不推荐**：直接关闭 `::: html`、对所有 HTML 做简单正则删除、只限制 `<script>`、把 React 的 JSX 转义或 Mermaid strict 当作整个 Markdown 渲染的 XSS 保障，以及只依赖 CSP 或 WAF。

## 6. 可供维护者作出的决定

**产品决定（维护者于 2026-11-01 明确同意）：采用方案 A，Folio 0.1.0 只承诺处理经审核的可信仓库内容。** 保留原始 HTML、`::: html`、Callout 和既有设计系统示例，不更改当前 Markdown 渲染行为或公共 API；**不承诺安全渲染未经审核的投稿、抓取或多租户内容**，不得将其直接送入当前 HTML 渲染链路。

**首发前仍须完成的最小交付**：在包 README、对外 Markdown/API 使用说明和发布说明中准确写明 trusted-content-only 合同及消费者审核责任。这是发布文档工作，**尚未由 FOL-003 执行完成**；本决议本身也不构成 npm 发版授权。

如未来决定支持不可信输入，必须另行批准 B 的 API/安全策略与独立实测，不自动创建施工卡。FOL-003 的研究与决策目标已经满足，PR 合并及 Issue 关闭仍需另外授权。

本 PR 不更改 `markdown.ts`、`markdown-react.tsx`、`static.ts`、依赖、公共 API、CI 门禁、Release 或生产站点。