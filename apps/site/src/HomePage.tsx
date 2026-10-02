import type { FolioDoc } from "@uichat-mira/folio";

type HomePageProps = {
  docs: FolioDoc[];
  basePath: string;
};

const TYPE_META = [
  {
    type: "doc",
    label: "Docs",
    kicker: "结构化知识",
    href: "/docs/introduction",
    copy: "把 Markdown 变成稳定的文档路由、导航与标题结构。",
  },
  {
    type: "article",
    label: "Articles",
    kicker: "公开写作",
    href: "/blogs/why-folio",
    copy: "同一套内容协议，也能承载文章、日期、标签与发布状态。",
  },
  {
    type: "project",
    label: "Projects",
    kicker: "项目门户",
    href: "/projects/folio",
    copy: "项目状态和路线仍然留在 Git，而不是另造一套后台。",
  },
  {
    type: "page",
    label: "Pages",
    kicker: "自由页面",
    href: "/reference/site",
    copy: "需要自定义语义时继续扩展，而不是把所有东西塞进 doc。",
  },
] as const;

function href(basePath: string, path: string): string {
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const route = path.startsWith("/") ? path.slice(1) : path;
  return route ? base + route : base;
}

function typeCount(docs: FolioDoc[], type: string): number {
  return docs.filter((doc) => doc.type === type).length;
}

export function HomePage({ docs, basePath }: HomePageProps) {
  const headingCount = docs.reduce((sum, doc) => sum + doc.headings.length, 0);
  const tags = [...new Set(docs.flatMap((doc) => doc.tags))];
  const referencePage = docs.find((doc) => doc.type === "page");
  const featured = docs
    .filter((doc) => doc.path !== "/")
    .sort((left, right) => left.order - right.order)
    .slice(0, 6);

  return (
    <main className="showcase-home">
      <section className="showcase-hero">
        <div className="showcase-hero__copy">
          <div className="showcase-kicker">
            <span className="showcase-kicker__dot" />
            Official reference implementation
          </div>
          <h1>
            把内容留在 Git，
            <br />
            <em>把表达交给组合。</em>
          </h1>
          <p>
            Folio 是一个给 Vite 与 React 使用的 Git-native 内容与静态发布运行时。
            这个网站不是专门为官网开的后门：它只消费 Folio 的公开 package
            entrypoints，然后把品牌、布局与内容选择留在 consumer layer。
          </p>
          <div className="showcase-actions">
            <a
              className="showcase-button showcase-button--primary"
              href={href(basePath, "/docs/introduction")}
            >
              从这里开始
              <span aria-hidden="true">↗</span>
            </a>
            <a
              className="showcase-button"
              href="https://github.com/uichat-mira/folio"
            >
              GitHub
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="showcase-proofline">
            <span>PUBLIC API ONLY</span>
            <span>0 PRIVATE IMPORTS</span>
            <span>SELF-HOSTED ON PAGES</span>
          </div>
        </div>

        <div className="showcase-terminal" aria-label="Folio public API example">
          <div className="showcase-terminal__bar">
            <span />
            <span />
            <span />
            <strong>consumer.tsx</strong>
          </div>
          <pre>
            <code>{"import { FolioApp } from \"@uichat-mira/folio\";\nimport docs from \"virtual:folio/content\";\n\n<FolioApp\n  config={config}\n  docs={docs}\n  slots={{ home, headerActions }}\n/>"}</code>
          </pre>
          <div className="showcase-terminal__status">
            <span>runtime</span>
            <strong>@uichat-mira/folio</strong>
            <span className="showcase-live">live contract</span>
          </div>
        </div>
      </section>

      <section className="showcase-metrics" aria-label="Live content manifest metrics">
        <div>
          <strong>{docs.length}</strong>
          <span>content entries</span>
        </div>
        <div>
          <strong>{TYPE_META.filter((item) => typeCount(docs, item.type) > 0).length}</strong>
          <span>entry types</span>
        </div>
        <div>
          <strong>{headingCount}</strong>
          <span>extracted headings</span>
        </div>
        <div>
          <strong>{tags.length}</strong>
          <span>frontmatter tags</span>
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-section__heading">
          <span>01 / CONTENT GRAPH</span>
          <h2>不是只有“文档”这一种东西。</h2>
          <p>
            Folio 从同一个 Markdown 内容图里归一出不同 entry type。
            下面这些数字不是写死的宣传文案，它们直接来自
            <code>virtual:folio/content</code>。
          </p>
        </div>

        <div className="showcase-type-grid">
          {TYPE_META.map((item, index) => (
            <a
              className="showcase-type-card"
              href={href(basePath, item.href)}
              key={item.type}
            >
              <div className="showcase-type-card__top">
                <span>{"0" + (index + 1)}</span>
                <strong>{typeCount(docs, item.type)}</strong>
              </div>
              <div>
                <small>{item.kicker}</small>
                <h3>{item.label}</h3>
                <p>{item.copy}</p>
              </div>
              <span className="showcase-card-link">查看真实条目 ↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="showcase-section showcase-section--dark">
        <div className="showcase-section__heading">
          <span>02 / CAPABILITY SURFACE</span>
          <h2>官网把本体能力吃满，而不是给自己开特权。</h2>
          <p>
            运行时负责稳定契约；这个站负责证明这些契约足以做出一个完整产品面。
          </p>
        </div>

        <div className="showcase-capability-grid">
          <article>
            <span>CONTENT</span>
            <h3>Frontmatter + Markdown</h3>
            <p>稳定字段归一，未知字段仍保留在 data 中，方便产品自己扩展。</p>
            <code>parseFolioDoc()</code>
          </article>
          <article>
            <span>VITE</span>
            <h3>Virtual manifest</h3>
            <p>内容发现、热更新、roots 与排序都由公开 Vite 插件提供。</p>
            <code>virtual:folio/content</code>
          </article>
          <article>
            <span>REACT</span>
            <h3>Runtime + slots</h3>
            <p>默认壳能直接用；首页、header action 和文章尾部可由 consumer 组合。</p>
            <code>{"<FolioApp slots={...} />"}</code>
          </article>
          <article>
            <span>STATIC</span>
            <h3>Route-level output</h3>
            <p>构建阶段生成真实 HTML，而不是只扔一个空的 SPA shell 上线。</p>
            <code>FolioStaticBuildOptions</code>
          </article>
          <article>
            <span>SEO</span>
            <h3>Metadata contract</h3>
            <p>canonical、Open Graph、Twitter、JSON-LD 与 noindex 规则跟着 route 生成。</p>
            <code>renderFolioStaticHtml()</code>
          </article>
          <article>
            <span>SHIP</span>
            <h3>Pages-aware paths</h3>
            <p>项目站与根域路径由 runtime 解析，本案例直接跑在 /folio/ 子路径。</p>
            <code>resolveGithubPagesBase()</code>
          </article>
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-split">
          <div className="showcase-section__heading">
            <span>03 / CONSUMER FREEDOM</span>
            <h2>换皮，不 fork。</h2>
            <p>
              Folio 不应该决定你的品牌长什么样。它提供 content、route 和 static
              build contract；具体站点可以像这里一样，用自己的 CSS 和组件把表达做完。
            </p>
            <a
              className="showcase-text-link"
              href={href(basePath, "/docs/runtime-composition")}
            >
              看这个站如何组合公开 API ↗
            </a>
          </div>

          <div className="showcase-layer-stack">
            <div className="showcase-layer showcase-layer--consumer">
              <span>CONSUMER LAYER</span>
              <strong>Brand · Layout · Interaction</strong>
              <p>HomePage.tsx / site.css / content choices</p>
            </div>
            <div className="showcase-layer showcase-layer--contract">
              <span>FOLIO CONTRACT</span>
              <strong>Content · Route · Build</strong>
              <p>@uichat-mira/folio · @uichat-mira/folio/vite</p>
            </div>
            <div className="showcase-layer showcase-layer--git">
              <span>SOURCE OF TRUTH</span>
              <strong>Git + Markdown</strong>
              <p>reviewable · versioned · portable</p>
            </div>
          </div>
        </div>
      </section>

      <section className="showcase-section showcase-section--evidence">
        <div className="showcase-section__heading">
          <span>04 / BUILD EVIDENCE</span>
          <h2>构建完成后，不止一个 index.html。</h2>
          <p>
            当前 production artifact 同时承担可访问路由、搜索引擎元数据与机器可读契约。
          </p>
        </div>

        <div className="showcase-output-grid">
          {[
            ["route/index.html", "每个内容路由都有静态 HTML"],
            ["404.html", "独立 noindex 的错误页"],
            ["sitemap.xml", "跟随真实内容图生成"],
            ["robots.txt", "指向当前部署 sitemap"],
            ["schemas/*.json", "公开内容与配置 schema"],
            ["JSON-LD", "route 级结构化数据"],
          ].map(([name, copy]) => (
            <div key={name}>
              <code>{name}</code>
              <span>{copy}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-split showcase-split--content">
          <div className="showcase-section__heading">
            <span>05 / LIVE REPOSITORY CONTENT</span>
            <h2>这张内容清单也是运行时生成的。</h2>
            <p>
              首页没有维护第二份导航数据库。它直接读取 Folio manifest，展示当前仓库里的真实条目。
            </p>
          </div>

          <div className="showcase-content-list">
            {featured.map((doc) => (
              <a href={href(basePath, doc.path)} key={doc.path}>
                <span>{doc.group}</span>
                <div>
                  <strong>{doc.title}</strong>
                  <p>{doc.description}</p>
                </div>
                <small>↗</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-final">
        <div>
          <span>THIS SITE IS THE TEST</span>
          <h2>案例不是截图。案例本身就应该持续证明本体。</h2>
          <p>
            当前 reference page 的自定义字段：
            <code>{String(referencePage?.data.surface ?? "not-set")}</code>
            。它没有被 Folio 预先认识，却仍然从 Frontmatter 一路保留到了运行时。
          </p>
        </div>
        <a
          className="showcase-button showcase-button--primary"
          href={href(basePath, "/reference/site")}
        >
          查看自证页
          <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}
