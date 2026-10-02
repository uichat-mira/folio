import type { FolioDoc } from "@uichat-mira/folio";

type HomePageProps = {
  docs: FolioDoc[];
  basePath: string;
};

function href(basePath: string, path: string): string {
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const route = path.startsWith("/") ? path.slice(1) : path;
  return route ? base + route : base;
}

const CAPABILITIES = [
  ["CONTENT", "统一内容模型", "Markdown、Frontmatter、heading 与自定义字段进入同一个 FolioDoc。"],
  ["VITE", "Virtual manifest", "通过 virtual:folio/content 提供可热更新的内容清单。"],
  ["REACT", "可组合运行时", "默认壳直接可用，也能通过 slots 交给 consumer 自己表达。"],
  ["STATIC", "静态发布", "为真实 route 生成 HTML、404、sitemap、robots 与 schema。"],
  ["SEO", "Route metadata", "canonical、Open Graph、Twitter Card 与 JSON-LD 跟随内容生成。"],
  ["DEPLOY", "Pages aware", "同一套构建契约支持根域与 GitHub Pages 项目子路径。"],
] as const;

export function HomePage({ docs, basePath }: HomePageProps) {
  const headingCount = docs.reduce((sum, doc) => sum + doc.headings.length, 0);
  const tags = [...new Set(docs.flatMap((doc) => doc.tags))];
  const groups = [...new Set(docs.map((doc) => doc.group).filter(Boolean))].length;
  const featured = docs
    .filter((doc) => doc.path !== "/")
    .sort((a, b) => a.order - b.order)
    .slice(0, 6);

  return (
    <main className="showcase-home">
      <section className="showcase-hero">
        <div className="showcase-hero__copy">
          <span className="showcase-eyebrow">Git-native content runtime</span>
          <h1>内容留在 Git。<br />站点保持可组合。</h1>
          <p>
            Folio 为 Vite 与 React 提供内容模型、运行时与静态发布契约。
            这个官网本身只使用 Folio 的公开 API，是一份持续运行的 reference implementation。
          </p>
          <div className="showcase-actions">
            <a className="showcase-btn showcase-btn--primary" href={href(basePath, "/docs/introduction")}>
              开始使用
            </a>
            <a className="showcase-btn showcase-btn--secondary" href={href(basePath, "/api/guide/what-is-folio")}>
              API Reference
            </a>
          </div>
          <div className="showcase-trust">
            <span>Public API only</span>
            <span>Git as source of truth</span>
            <span>Static output included</span>
          </div>
        </div>

        <div className="showcase-code-card">
          <div className="showcase-code-card__bar">
            <span>consumer.tsx</span>
            <small>public API</small>
          </div>
          <pre><code>{`import { FolioApp } from "@uichat-mira/folio";
import docs from "virtual:folio/content";

<FolioApp
  config={config}
  docs={docs}
  slots={{ home, headerActions }}
/>`}</code></pre>
        </div>
      </section>

      <section className="showcase-stats" aria-label="Live Folio content metrics">
        <div><strong>{docs.length}</strong><span>内容条目</span></div>
        <div><strong>{groups}</strong><span>内容分组</span></div>
        <div><strong>{headingCount}</strong><span>提取标题</span></div>
        <div><strong>{tags.length}</strong><span>Frontmatter 标签</span></div>
      </section>

      <section className="showcase-section">
        <div className="showcase-section__head">
          <span className="showcase-eyebrow">Core capabilities</span>
          <h2>一套很薄，但完整的内容与发布契约。</h2>
          <p>Folio 不替 consumer 决定品牌，也不把 GitHub、CMS 或部署平台塞进 runtime。</p>
        </div>
        <div className="showcase-capability-grid">
          {CAPABILITIES.map(([label, title, copy]) => (
            <article key={label}>
              <span>{label}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="showcase-section showcase-section--soft">
        <div className="showcase-section__head">
          <span className="showcase-eyebrow">Reference content</span>
          <h2>这个站点本身就是文档、案例和内容模型的样本。</h2>
          <p>首页不维护第二份内容数据库，下面的条目直接来自 Folio manifest。</p>
        </div>
        <div className="showcase-content-grid">
          {featured.map((doc) => (
            <a href={href(basePath, doc.path)} key={doc.path}>
              <span>{doc.group}</span>
              <h3>{doc.title}</h3>
              <p>{doc.description}</p>
              <small>打开内容 →</small>
            </a>
          ))}
        </div>
      </section>

      <section className="showcase-dark">
        <div>
          <span className="showcase-eyebrow showcase-eyebrow--dark">Consumer freedom</span>
          <h2>默认可用，也允许完全换皮。</h2>
          <p>
            Folio 负责内容、route 和 build contract；站点可以保留自己的布局、品牌与交互，
            而不需要 fork runtime。
          </p>
        </div>
        <div className="showcase-layer-list">
          <div><span>01</span><strong>Git + Markdown</strong><small>source of truth</small></div>
          <div><span>02</span><strong>Folio contract</strong><small>content · route · build</small></div>
          <div><span>03</span><strong>Consumer layer</strong><small>brand · layout · interaction</small></div>
        </div>
      </section>

      <section className="showcase-cta">
        <div>
          <span className="showcase-eyebrow">Reference implementation</span>
          <h2>先看内容，再看它如何被 Folio 组织起来。</h2>
        </div>
        <a className="showcase-btn showcase-btn--primary" href={href(basePath, "/api/examples/product-design-system")}>
          查看设计系统
        </a>
      </section>
    </main>
  );
}
