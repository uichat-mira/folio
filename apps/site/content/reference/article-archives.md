---
title: Article 分类与标签归档
description: Folio 的 collections[].archive 数据契约、React/静态输出、URL 规则与回退行为。
group: API
collection: 参考
order: 45
type: doc
status: published
tags:
  - Archive
  - Article
  - Category
  - Tag
---

Article 分类与标签归档（FOL-040 / FOL-041）是按集合启用的阅读面：`collections[].archive` 打开后，Folio 从文章自己的 `category` / `tags` 推导归档页。

## 版本状态

该能力在当前 `dev` 源码中实现，**尚未发布到 npm**。已发布的 `@uichat-mira/folio@0.1.1` 没有 `config.collections`，没有 `archive` 配置，也没有 `buildFolioArticleArchiveIndex()` 等 Core 导出；按本页示例在 `0.1.1` 上配置不会产生归档 route。本轮核对基线为 `origin/dev` 的 `f49557c`。

## 分类不是栏目

- `category` 只是一个可选的归档维度，不是栏目、目录、树节点或导航层级；
- `tags` 仍是零个或多个主题标签；
- 两者都不改变文章的 `path`、`collection`、`group`、`section`、搜索行为或既有 permalink；
- 归档页不是新的内容目录：文章仍由集合的 route 前缀发现，归档只是同一批文章的另一种索引；
- 归档入口不会注入全站顶栏导航；默认 React UI 只把它放在集合索引与文章信息区。

## 数据契约

```md
---
title: 为什么内容要留在 Git
type: article
category: 工程实践          # 可选；一个非空字符串
tags:                       # 可选；零个或多个字符串
  - Git
  - Content
---
```

- 只有 `type: article` 的文档进入归档；`doc`、`page` 与其他类型保持原行为。
- 分类身份由 Frontmatter 值规范化：NFC、去首尾空白、折叠连续空白、转小写，再 NFC 一次。`Frontend` 与 `frontend` 因此是同一个归档；中文标签保留。
- `category: ""`、非字符串或缺失表示“未分类”；没有标签表示“无标签”。两者都只会进入 `uncategorized` / `untagged`，不会生成空归档组。
- URL 标识（`slug`）沿用仓库的 `slugify`：中文保留、ASCII 小写、标点去除。两个不同身份折叠到同一 slug（例如 `C++` / `C#`）会让索引构建抛错（静态构建失败，React 派生时同样报错），而不是共享一个归档 URL。
- 归档组按 slug 的码点顺序排序；组内文章使用现有文章排序（`date` 降序、缺失日期排后，再按 `order`，最后按 `path`），因此相同内容总是得到相同顺序。
- `archive: { categoryLabels: { ... } }` 可以改分类的显示标题，但归档 `id` 与 URL 仍来自 Frontmatter 值：改显示名不会改路由。

专用函数：

```ts
import {
  buildFolioArticleArchiveIndex,
  findFolioArticleArchiveGroup,
  normalizeFolioArticleArchiveId,
  folioArticleArchiveSlug,
} from "@uichat-mira/folio";

const index = buildFolioArticleArchiveIndex(docs, { categoryLabels: { frontend: "前端" } });
// docs 可以来自 virtual:folio/content，也可以来自静态 context.docs。
```

`buildFolioArticleArchiveIndex(docs, config)` 返回 `{ categories, tags, uncategorized, untagged }`，其中每个组是 `{ kind, id, slug, title, docs }`。它只分组调用者传入的 `FolioDoc[]`，不读文件、不渲染、也不持久化第二份内容索引。

## 最小配置

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "My site",
  description: "Writing and things",
  collections: [
    {
      path: "/blogs",
      title: "博客",
      archive: true, // 或 { categoryLabels: { frontend: "前端" } }
    },
  ],
});
```

`archive` 省略或为 `false` 时，该集合没有归档 route、入口或标签链接。

## URL 与静态路径

| 页面 | URL |
| --- | --- |
| 集合索引 | `<collection>` |
| 分类归档 | `<collection>/category/<slug>` |
| 标签归档 | `<collection>/tag/<slug>` |
| 文章 | 原有 `doc.path`，不变 |

以 `/blogs` 为例，静态产物是：

```text
blogs/category/工程实践/index.html
blogs/tag/folio/index.html
```

`<slug>` 正好是一个路径段。非 ASCII slug 在请求 URL 中需要百分号编码（`/blogs/tag/%E8%AE%BE%E8%AE%A1/` 对应 `设计`）；自己拼归档链接时必须 `encodeURIComponent` 该段。浏览器请求后会解码到与写出时相同的目录。

## React 输出

`FolioApp` 自动读取 `collections[].archive`：

- 开启归档的集合索引增加一行紧凑的分类入口（仅当存在分类时），首项为 `全部`；普通左键点击只在当前集合列表内切换分类，不改变路由、不新增历史记录，分类切换与列表共用同一个阅读图层；
- 分类行滚动时吸顶在站点 Header 下方（`top: var(--folio-header-height)`），复用 Header 的磨砂画布表面并向列表方向渐隐，不画贯穿内容列的下横线，条目经过时自然虚化；
- 切换分类后列表自动复位到筛选结果的开头（位于吸顶行下方）；如果读者本来就在列表上方，则不会向下跳转，较短的筛选结果也不会把人留在页脚；
- 分类 chip 保留真实的归档 URL，因此中键 / 修饰键点击、爬虫和无 JavaScript 的静态页仍然能到达 `<collection>/category/<slug>`；
- 该集合的文章卡片与文章元信息把标签渲染为归档链接；
- `<collection>/category/<slug>` 与 `<collection>/tag/<slug>` 渲染归档条目列表，并提供返回集合的链接；
- 未知归档 slug 走普通 not-found；
- 分类入口与标签链接**不会**进入全站顶栏导航。

默认归档 UI（`FolioArticleArchivePage` 等）是 `FolioApp` 内部实现，不从包入口导出。需要自定义渲染时，使用上面的 Core 索引自行组合页面，不要复制分组逻辑。

## 静态输出

### 默认路由集

`staticRoutes: true`（或传入 `FolioStaticBuildOptions` 但不提供 `routes`）时，默认静态路由集会为每个开启归档的集合写出归档页：

- 标题、描述与 canonical 来自归档 route，继承 `base` 与 `config.siteUrl`；
- 归档 URL 会进入 `sitemap.xml`；
- `siteIndexing: "noindex"` 对归档页与其他默认页面同样生效；
- 归档页无 JavaScript 也能阅读，条目列表与排序和 React 一致，链接使用静态目录 URL；
- 集合索引的静态 HTML 首项是处于选中态的 `全部` chip，各 chip 都是普通归档链接；React 运行时加载后，分类行升级为上面的原地筛选。

### 自定义路由集

传入 `routes` 后，route 集完全由 consumer 负责，默认归档页不会被自动加入。可以复用同一份 Core 索引：

```ts
import {
  buildFolioArticleArchiveIndex,
  selectFolioCollectionDocs,
} from "@uichat-mira/folio";
import {
  folioEscapeHtml,
  type FolioStaticRoute,
} from "@uichat-mira/folio/vite";

function archiveRoutes(context): FolioStaticRoute[] {
  const index = buildFolioArticleArchiveIndex(
    selectFolioCollectionDocs(context.docs, "/blogs"),
    true,
  );
  // 静态正文里的站内链接必须手动带部署 base。
  const href = (path: string) =>
    `${context.base.replace(/\/$/, "")}${path === "/" ? "/" : `${path}/`}`;

  const page = (
    kind: "category" | "tag",
    group: (typeof index.categories)[number],
  ): FolioStaticRoute => ({
    path: `/blogs/${kind}/${group.slug}`,
    title: `${kind === "category" ? "分类" : "标签"}：${group.title}`,
    description: `共 ${group.docs.length} 篇文章`,
    type: "website",
    body:
      `<main class="folio-archive-page"><h1>${folioEscapeHtml(group.title)}</h1><ul>` +
      group.docs
        .map(
          (doc) =>
            `<li><a href="${href(doc.path)}">${folioEscapeHtml(doc.title)}</a></li>`,
        )
        .join("") +
      "</ul></main>",
  });

  return [
    ...index.categories.map((group) => page("category", group)),
    ...index.tags.map((group) => page("tag", group)),
    // 还必须加入集合索引、文档页、首页等其他 route：
    // 自定义 routes 会替换整个默认路由集。
  ];
}
```

在自定义静态路由中解析请求路径时，把解码后的单段交给 Core 匹配：

```ts
const group = findFolioArticleArchiveGroup(index, "category", decodeURIComponent(segment));
```

自定义路由的正文标记与路由集合由 consumer 负责；canonical、Open Graph、JSON-LD、robots 与 sitemap 收录仍由 Folio 按 route 数据生成（显式 `route.robots` / `route.lastmod` 优先）。

## 回退与冲突

- 未配置 `archive`：没有归档 route、没有分类入口、没有标签链接。
- 未分类 / 无标签：只出现在 `uncategorized` / `untagged`，不生成空组或空路由。
- 未知 slug：静态托管返回真实 `404.html`；React 渲染普通 not-found 页面。
- 路由冲突：文章、集合索引或其他自定义 route 已占用同一路径时，静态构建在写第一个文件前失败；React 派生 route 也会以 `folio article archive route conflict` 失败，而不是静默遮蔽文档。
- slug 冲突：两个不同分类/标签折叠到同一 URL 标识时，Core 直接抛错，不会共享归档。
- 没有重定向：修改文章 Frontmatter 的 `category` 会改变归档 URL；修改显示标签不会。Folio 不生成旧归档 URL 的跳转页，需要保留外链时由站点自行处理。

## 边界

- 归档不是分页器：每组输出全量条目，没有分页、排序参数或搜索过滤。
- 归档不是 CMS 分类系统：没有父子分类、重命名历史、批量迁移或权限模型。
- 归档不进入 feed：`feeds` 按 route 目录选择**文档**，归档页不是文档，不会成为 feed 条目。
- 归档不改变文章 permalink，也不改变集合递归、侧边栏与站内搜索。

## 适用与不适用

适用：

- 集合里已有稳定的 `category` / `tags` Frontmatter，希望读者按主题浏览文章；
- 想复用默认 React 与静态归档页，不新增导航层级；
- 需要在 sitemap 中出现归档 URL，并让 `siteIndexing` 统一管理预览索引。

不适用：

- 需要栏目、父子分类、分页、排序参数或搜索过滤；
- 需要归档页进入顶栏导航或成为新的内容目录；
- 依赖重命名后的旧归档 URL 自动跳转；
- 文章类型不是 `article`，或内容没有稳定的分类/标签事实。

## 官方站示例

官方站的 `/blogs` 集合设置了 `archive: true`，因此 `apps/site` 的构建里同时存在分类与标签归档页；它用 Core 索引自行渲染静态 route，并让 React 使用同一份分组结果。参考实现的代码在 `apps/site/src/archive.ts` 与 `apps/site/src/static-routes.ts`。

## 相关文档

- [静态构建与 SEO](/reference/seo)：归档页的 canonical、sitemap 与索引策略。
- [静态发布](/guide/static-publishing)：归档页在产物中的位置与部署。
- [Vite 构建集成](/reference/build-integration)：`staticRoutes` 与自定义 route 的边界。
