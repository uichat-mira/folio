# FOL-008 导航对照 fixture

这个目录不属于生产实现，只是 FOL-008（Issue #52）的最小对照输入与复现工具。
它同时构建同一条内容语料的两种真实呈现：

- **A. 静态 HTML**：Vite + `folio` 插件，`staticRoutes: true`，因此静态页面来自
  `packages/folio/src/static.ts` 的默认 `defaultRoutes`（文档侧栏、TOC、分页）。
- **B. React 文档视图**：同一个 bundle 的 `FolioApp` 公开入口，在真实浏览器里渲染，
  通过 `chrome --headless --dump-dom` 取渲染后的 DOM。

两种模式使用同一批 Markdown、同一个 base path 配置，因此链接差异来自实现而不是内容。

## 语料

`content/docs/guide/` 下三篇文档，同一 `collection: Core`：

| 文档 | route | order | section | 覆盖点 |
| --- | --- | --- | --- | --- |
| intro.md | `/docs/guide/intro` | 1 | Basics | h2/h3/h4、重复标题、行内代码标题、显式 `<h2 id>` |
| second.md | `/docs/guide/second` | 2 | Basics | 同一分组内上一篇/下一篇、重复标题 |
| third.md | `/docs/guide/third` | 3 | Advanced | 跨 section 相邻关系、Pages 子路径相关标题 |

## 复现

以下命令在仓库根目录执行（Node 24 / npm 11，Windows 或 Linux 均可；浏览器仅影响
React 运行时证据）。

```bash
npm ci --no-audit --no-fund
npm run build -w @uichat-mira/folio

cd docs/research/fol-008/fixture

# A1. 根路径静态产物
FOLIO_FIXTURE_BASE=/      FOLIO_FIXTURE_OUT=dist-root  node ../../../../node_modules/vite/bin/vite.js build

# A2. GitHub Pages 子路径静态产物
FOLIO_FIXTURE_BASE=/folio/ FOLIO_FIXTURE_OUT=dist-pages node ../../../../node_modules/vite/bin/vite.js build

# 目录服务器（模拟 GitHub Pages：目录 URL 提供 index.html，无尾斜杠目录 301，
# 未知路径返回 404.html，没有 SPA catch-all）
node serve.mjs dist-root 4201

# 子路径服务器：把 dist-pages 放到 serve-pages/folio，再以 serve-pages 为根提供 /folio/
mkdir -p serve-pages
cp -r dist-pages serve-pages/folio
node serve.mjs serve-pages 4202
```

浏览器证据（Windows 上 Chrome 路径按本机调整；Linux 用 `google-chrome`）：

```bash
for spec in "" "docs/guide/intro" "docs/guide/second" "docs/guide/third"; do
  name=${spec//\//-}; name=${name:-index}
  chrome --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom \
    "http://127.0.0.1:4201/$spec/" > "dumps-root/$name.html"
  chrome --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom \
    "http://127.0.0.1:4202/folio/$spec/" > "dumps-pages/$name.html"
done
```

对照分析（会打印完整 JSON，并写入 `results/`）：

```bash
node analyze.mjs --out dist-root  --base /       --dumps dumps-root  --label root  --json results/root.json
node analyze.mjs --out dist-pages --base /folio/ --dumps dumps-pages --label pages --json results/pages.json
node summarize.mjs results/root.json results/pages.json

# TOC href 是否命中正文 heading id（对静态产物或浏览器 dump 均可）
node toc-check.mjs dist-root/docs/guide/intro/index.html dumps-root/docs-guide-intro.html

# 附加边界探测：TOC id（extractHeadings）与正文 id（renderFolioMarkdown）是否一致
node edge-probe.mjs --json results/edge-probe.json
```

`dist-*`、`dumps-*`、`serve-pages/` 是本地生成物，已在 `.gitignore` 中忽略；
`results/*.json` 是提交的研究证据。

## 判定口径

- `analyze.mjs` 只导出事实（链接、顺序、锚点命中、静态目标文件是否存在），不写结论。
- 结论与分类见 `../fol-008-navigation-parity.md`。
