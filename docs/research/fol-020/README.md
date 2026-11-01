# FOL-020 · CSS 聚合构建与真实 npm 产物回归门禁

- Issue: [#111](https://github.com/uichat-mira/folio/issues/111)
- 基线: `origin/dev` @ `0396f61549838cb9622728ceeafee623f2e085b5`
- 分支: `feat/fol-020-css-aggregation`
- 记录日期: 2026-11-01
- 环境: Windows x64、Node v24.9.0、npm 11.6.0
- 性质: 施工与门禁证据记录，不是设计变更、发布批准或视觉验收。

## 0. 结论

1. `dist/styles.css` 现在由 `packages/folio/styles/manifest.mjs` 的**显式有序清单**聚合生成（`scripts/build-styles.mjs`），不再是单文件复制；当前清单只有一个源，产物与 `src/styles.css` **字节等价**（23,702 字节，sha256 `2ad01dd2806e3ae0b29596a32f013cfcc42af3602e554e6793a11b25a1e8dd2b`）。
2. 聚合是纯拼接：不压缩、不重写、不注入分隔注释、不生成 `@import`；多源之间只插入恰好一个空行（沿用前一个源的换行符）。因此级联语义等于清单顺序。
3. `pack:verify` 现在校验 CSS **内容与顺序**：`--folio-*` Token 名与顺序、5 组全局规则及其关键声明、Header/DocsShell/Markdown/Search/Share/静态类名的精确选择器规则、Token 块先于组件规则的级联关系、以及打包产物大小与构建产物一致。
4. `pack:consumer` 的真实 tarball 消费者（仓库外临时目录 + `vite build`）现在**导入** `@uichat-mira/folio/styles.css`，并对构建出的 CSS 资产做**精确选择器**断言（10 个代表规则 + 2 个 Token），同时校验 `index.html` 引用了该资产。
5. 受控负例可复现：`styles:selftest` 的 7 个场景全部让门禁非零退出；删除 `.folio-header` 规则的 tarball 负例让 `pack:consumer` 以 `[css] FAIL ... missing 1 default rule(s): .folio-header` 退出，恢复后全绿。
6. `exports["./styles.css"]`、`sideEffects`、`dist/virtual.d.ts` 复制与 `index.d.ts`/`vite.d.ts` 的三斜线引用链、构建入口、Windows 可运行性均未变化；没有组件 CSS 拆分、没有 Token 名/类名/主题/视觉改动、没有新增构建工具链。

## 1. 变更清单

| 文件 | 作用 |
| --- | --- |
| `packages/folio/styles/manifest.mjs` | 新增。显式有序 CSS 源清单；当前仅 `src/styles.css`，未来组件 CSS 只在此登记顺序。 |
| `packages/folio/styles/contract.mjs` | 新增。冻结 Token 顺序/代表值、5 组全局规则、组件与静态选择器族、级联顺序、消费者代表规则。 |
| `packages/folio/scripts/build-styles.mjs` | 新增。`aggregateStyles()` / `writeAggregatedStyles()`，字节保留式拼接；可独立运行生成 `dist/styles.css`。 |
| `packages/folio/scripts/copy-styles.mjs` | 改为调用聚合构建；`virtual.d.ts` 复制与 `.d.ts` 三斜线引用注入保持不变。 |
| `packages/folio/scripts/verify-styles.mjs` | 新增。内容/顺序门禁 + 可重放的 `--self-test` 负例harness；导出 `verifyStylesheet()`、`selectorIndex()`。 |
| `packages/folio/scripts/verify-package.mjs` | `pack:verify` 内调用样式门禁，并断言 tarball 内 `dist/styles.css` 大小等于聚合产物。 |
| `packages/folio/scripts/checks/vite-consumer.mjs` | 真实消费者构建产物 CSS 资产断言（精确选择器 + Token + `index.html` 链接）。 |
| `packages/folio/scripts/fixtures/vite-consumer/src/main.tsx` | 消费者按公开用法 `import "@uichat-mira/folio/styles.css"`。 |
| `packages/folio/scripts/fixtures/vite-consumer/tsconfig.json` | 消费者声明 `types: ["vite/client"]`（Vite 消费者对 `*.css` 的标准类型来源）。 |
| `packages/folio/test/styles.test.mjs` | 新增 10 个测试：单源字节等价、多源顺序、门禁绿、各类负例被拦截、CLI 非零退出。 |
| `packages/folio/package.json` | 新增 `styles:build` / `styles:verify` / `styles:selftest` 脚本；`exports`/`sideEffects`/`files` 未变。 |

## 2. 聚合机制

```text
styles/manifest.mjs   STYLE_SOURCES = ["src/styles.css"]   ← 唯一顺序真相
        │
        ▼
scripts/build-styles.mjs  aggregateStyles()
  · 逐源读取，源内容原样保留（不改换行、不改空白、不加注释）
  · 多源时在文件之间插入恰好一个空行（沿用前一源的 EOL）
  · 单源时输出 === 源文件字节
        │
        ▼
scripts/copy-styles.mjs → dist/styles.css（同时复制 virtual.d.ts、注入三斜线引用）
        │
        ▼
package.json exports["./styles.css"] / sideEffects["./dist/styles.css"]（未改）
```

- **新增一个 CSS 源**：在 `STYLE_SOURCES` 中按期望级联位置追加一行即可，不需要新工具链、不需要 `@import`。
- **为什么没有分隔注释**：注释虽然对级联惰性，但会改变单源产物字节；本卡选择「零注入」，让单源等价成为可字节验证的强约束。多源边界用空行表达，已足够人工定位。
- **单源字节等价证据**：`node -e` 直接比较 `src/styles.css` 与 `dist/styles.css` → `equal true`、同为 23,702 字节、sha256 相同（见 §5）。
- **Token/全局规则优先**：`verify-styles.mjs` 断言 `STYLE_SOURCES[0] === "src/styles.css"`，并在级联检查中要求 `:root` 先于 `[data-folio-theme="dark"]`、`*`、`.folio-shell`、`.folio-header`、`.folio-markdown`、`.folio-search-overlay`、`.folio-docs-shell`、`.folio-prerender`。

## 3. 门禁设计

`verifyStylesheet()` 收集**全部**失败再统一退出，避免只报第一条；每个失败带稳定 id，便于负例断言与排障。

| id | 断言内容 |
| --- | --- |
| `manifest` | 清单非空、路径唯一、可读、首项仍是 `src/styles.css` |
| `aggregate` | `dist/styles.css` 必须等于按清单重新聚合的字节（含首个差异 offset 与上下文） |
| `aggregate:single-source` | 单源清单下必须与源文件字节相同 |
| `sources:order` | 每个源内容按清单顺序出现（多源顺序证据） |
| `parse` | 花括号平衡、无尾随内容、无 `@import`、无空选择器规则 |
| `tokens:root` | `:root` 的 `--folio-*` 声明名与顺序**完全等于** 37 项冻结清单 |
| `tokens:dark` | `[data-folio-theme="dark"]` 的 18 项覆盖名与顺序完全等于冻结清单 |
| `tokens:values` | 代表性 Token 值（primary/ink/canvas/hairline/radius-md/space-lg 等）未变 |
| `globals` | 5 组全局规则存在，且 `box-sizing`、`min-width: 320px`、`font: inherit`、`font-family` 等关键声明仍在 |
| `selectors:<family>` | shell/header/markdown/search/share/docs-shell/static 的精确选择器规则存在；代表性规则还要求其**关键声明**存在（防止基规则被删但 `@media` 覆盖仍提到类名） |
| `order:cascade` | 13 组级联先后关系，Token 块先于组件族，组件族之间保持既有顺序 |

接入点：

- `verify-package.mjs` 调用 `verifyStylesheet()`，并断言 `npm pack` 报告中 `dist/styles.css` 的 `size` 等于构建产物字节数 → 打包产物就是聚合产物。
- `verify-tarball-consumer.mjs` 链中的 `checks/vite-consumer.mjs`：fixture 导入公开样式入口后，`vite build` 必须产出 CSS 资产；用 `selectorIndex()` 解析**精确选择器**（不是 `includes` 子串）匹配 10 个代表规则，并检查 2 个 Token 声明与 `index.html` 的 `<link ... .css>` 引用及其文件存在性。
- 测试 `test/styles.test.mjs` 在 `npm test` 中运行同样的门禁逻辑（含 CLI 非零退出用例），因此单卡无法绕过。

## 4. 受控负例（可重放）

### 4.1 包内样式门禁：`styles:selftest`

```bash
npm run styles:selftest -w @uichat-mira/folio
```

harness 先确认基线全绿，再对**真实 `dist/styles.css` 的副本**做受控破坏，把破坏后的文件写入临时目录，用子进程重跑 `verify-styles.mjs --file <mutated>`，要求「非零退出 + 期望的失败 id」同时成立。

| 场景 | 破坏动作 | 期望失败 id | 实测 |
| --- | --- | --- | --- |
| `delete-docs-shell-rule` | 删除 `.folio-docs-shell { grid-template-columns: 250px ... }` | `selectors:docs-shell` | exit 1 ✔ |
| `delete-markdown-rule` | 删除 `.folio-markdown { ... }` | `selectors:markdown` | exit 1 ✔ |
| `reorder-root-tokens` | 交换 `--folio-primary` 与 `--folio-ink` | `tokens:root` | exit 1 ✔ |
| `remove-root-token` | 删除 `--folio-hairline-soft` 声明 | `tokens:root` | exit 1 ✔ |
| `remove-global-rule` | 删除 `* { box-sizing: border-box; }` | `globals` | exit 1 ✔ |
| `move-markdown-block-after-docs-shell` | 把 `.folio-markdown` 规则块移到文件末尾 | `order:cascade` | exit 1 ✔ |
| `truncate-stylesheet` | 去掉文件最后一个 `}` | `parse` | exit 1 ✔ |

实测输出摘要（`7/7` 全部被拒绝）：

```text
[selftest] ok  delete-docs-shell-rule: exit 1, [selectors:docs-shell] FAIL ... no longer declares the canonical .folio-docs-shell rule (missing grid-template-columns: 250px); the docs-shell component rule was deleted or emptied
[selftest] ok  reorder-root-tokens: exit 1, [tokens:root] FAIL :root token declarations do not match the frozen contract (expected 37 in order, found 37); first mismatch at position 0: expected "--folio-primary", found "--folio-ink"
[selftest] ok  move-markdown-block-after-docs-shell: exit 1, [order:cascade] FAIL cascade order changed: .folio-markdown (rule #160) must precede .folio-search-overlay (rule #69)
...
styles.css self-test passed: 7/7 controlled regressions were rejected by the gate
```

单条命令重放（人工可复现，任意平台）：

```bash
cp packages/folio/dist/styles.css ./broken.css
# 在编辑器中删除 broken.css 里的 ".folio-docs-shell { ... }" 规则（或整段 .folio-markdown）
node packages/folio/scripts/verify-styles.mjs --file ./broken.css
# → 打印 [selectors:docs-shell] FAIL ... 并以 exit 1 结束
```

### 4.2 真实 tarball 消费者：删除组件规则后 `pack:consumer` 失败

```bash
# 1) 临时删除 src/styles.css 中的 .folio-header 规则（该规则 9 行、239 字节，位于文件第 74–82 行）
#    备份/恢复都用 git，避免留下改动：
git diff --stat -- packages/folio/src/styles.css      # 删除后应显示 1 insertion(+), 9 deletions(-)

# 2) 真实 tarball + 仓库外消费者 + vite build（pack:consumer 内部会先重建 dist）
npm run pack:consumer -w @uichat-mira/folio
# → AssertionError: [css] FAIL the consumer's built CSS asset is missing 1 default rule(s): .folio-header
# → npm error code 1（pack:consumer exit=1）

# 3) 恢复并复跑
git checkout -- packages/folio/src/styles.css
npm run pack:consumer -w @uichat-mira/folio   # → Tarball consumer verification passed, exit 0
```

**这条负例在第一次实现时暴露了真实缺陷**：最初消费者检查用 `cssAssetText.includes(".folio-header")`，删除 `.folio-header` 规则后仍然通过，因为 `.folio-header__wrap` 命中了子串。改为 `selectorIndex()` 精确解析选择器后，同一负例才真实失败。这正是本卡要求「不能只断言文件存在」的原因，也说明负例不是形式化的。

## 5. 实际执行的验证（逐项）

在干净工作树（`feat/fol-020-css-aggregation`，基线 `0396f615`）上执行：

| 命令 | 结果 | 关键输出 |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS (exit 0) | added 274 packages |
| `npm run build -w @uichat-mira/folio` | PASS (exit 0) | tsup + `styles: 1 source(s) -> dist/styles.css (23702 bytes)` |
| `npm run typecheck -w @uichat-mira/folio` | PASS (exit 0) | `tsc --noEmit` 无错误 |
| `npm run test -w @uichat-mira/folio` | PASS (exit 0) | 55 tests / 55 pass / 0 fail（含新增 10 个样式测试） |
| `npm run build -w @uichat-mira/folio-site` | PASS (exit 0) | 站点构建与 schemas 复制正常 |
| `npm run pack:verify -w @uichat-mira/folio` | PASS (exit 0) | `styles.css verified: 1 ordered source(s), 23702 bytes, ...`；`npm pack verified: ... 11 files` |
| `npm run pack:consumer -w @uichat-mira/folio` | PASS (exit 0) | `[css] ok 1 CSS asset(s), 10 exact component/static selectors and 2 tokens`；`[static] ...` 全通过 |
| `npm run styles:selftest -w @uichat-mira/folio` | PASS (exit 0) | 7/7 负例被拒绝 |
| `npm run release:check` | PASS (exit 0) | 单次调用通过；FOL-017 §1.2 记录的 TEMP/TMP 冲突本次未复现 |

字节等价直接证据：

```text
src bytes 23702 dist bytes 23702 equal true
src sha256 2ad01dd2806e3ae0b29596a32f013cfcc42af3602e554e6793a11b25a1e8dd2b
dist sha256 2ad01dd2806e3ae0b29596a32f013cfcc42af3602e554e6793a11b25a1e8dd2b
```

执行注意（如实记录）：`pack:consumer` 内部会重新执行 `npm run build`（`tsup --clean` 清空 `dist`），因此**不能与 `pack:verify` / `npm test` 并行**；并行时观察到的失败是 `dist` 竞争，串行重跑全绿。

## 6. 边界、未执行项与风险

1. **未拆分组件 CSS**：`src/styles.css` 内容与顺序未动；C2–C5 只需在 `styles/manifest.mjs` 追加源，并把 `styles/contract.mjs` 的代表规则补到新源对应位置（当前断言已覆盖全部既有类名，新增源不会削弱断言）。
2. **Token 与代表值冻结**：`styles/contract.mjs` 有意把 37 + 18 个 Token 名/顺序与 7 个代表值写成契约；未来任何 Token 变更必须同时改契约（显式授权），不会被构建重构悄悄带过。
3. **消费者 CSS 检查依赖真实用法**：fixture 显式 `import "@uichat-mira/folio/styles.css"`（与 `apps/site/src/main.tsx`、文档一致）。若某消费者不导入样式入口，就不会产生 CSS 资产——这是契约信号而非检查漏洞。
4. **未做视觉回归**：本卡不改变任何声明，视觉等价由 FOL-019 独立消费者视觉基线负责。
5. **未跑 `registry:consumer`**：需要已发布的 npm Registry 版本；发布后由 `publish.yml` 执行，本次未改动该链路。
6. **CI 覆盖**：`validate.yml` 的 ubuntu `release:check` 与 windows `pack:verify` + `pack:consumer` 会执行同一批门禁；本机（Windows）证据见 §5，跨平台结论以 PR CI 为准。
