# FOL-014 消费者 fixture

[`run.mjs`](run.mjs) 会把本目录复制到仓库外的临时目录，安装真实的
`@uichat-mira/folio` tarball，然后跑类型检查、`vite build` 与 headless Chrome 验收。
本目录里的代码**不是**仓库的一部分构建目标，也不引用仓库内部实现。

| 路径 | 作用 |
| --- | --- |
| `consumer/content/docs/*.md` | 3 篇文档，覆盖侧栏分组、页内目录、表格、代码块、引用与分页 |
| `consumer/src/main.tsx` | 消费者入口：`FolioApp` + `styles.css` + `virtual:folio/content` |
| `consumer/vite.config.ts` | 消费者 Vite 配置：`@uichat-mira/folio/vite` 的 `folio()` 插件 |
| `consumer/types/virtual-folio.d.ts` | 消费者侧的虚拟模块声明（包未发布该声明，见报告第 4 节） |
| `consumer/tsconfig*.json` | 5 个真实 `tsc` 工程：app、根入口、`/vite` 入口、虚拟模块基线、虚拟模块带声明 |

运行：

```bash
node docs/research/fol-014/run.mjs
```

产物写在 `results/`：`acceptance.json`（原始数据）、`screenshots/`（6 张真实截图）、
`dom-*.html`（渲染后的 DOM）。报告见
[`../fol-014-default-ui-acceptance.md`](../fol-014-default-ui-acceptance.md)。
