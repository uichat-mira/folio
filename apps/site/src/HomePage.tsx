import type { FolioDoc } from "@uichat-mira/folio";
import { Link } from "react-router-dom";
import config from "../folio.config";
import { buildShowcaseHome } from "./home-model";

type HomePageProps = {
  docs: FolioDoc[];
};

const TYPE_COUNT_LABEL: Record<string, string> = {
  doc: "连续阅读",
  article: "长文专题",
  project: "项目档案",
  page: "独立参考",
};

export function HomePage({ docs }: HomePageProps) {
  const model = buildShowcaseHome(config, docs);
  const counts = new Map<string, number>();
  for (const doc of docs) counts.set(doc.type, (counts.get(doc.type) ?? 0) + 1);

  return (
    <main className="showcase-home">
      <section className="showcase-hero">
        <div className="showcase-hero__copy">
          <span className="showcase-eyebrow">Reference implementation · dev</span>
          <h1>先体验内容组织。<br />再判断 Folio 能做什么。</h1>
          <p>
            这个官网只消费 Folio 的公开 package entrypoints。
            首页、文档、文章、项目档案、独立页面与集合索引全部来自同一份
            {" "}<code>virtual:folio/content</code> manifest，没有第二套内容数据库。
          </p>
          <div className="showcase-actions">
            <Link className="showcase-btn showcase-btn--primary" to="/showcase">
              进入能力展厅
            </Link>
            <Link className="showcase-btn showcase-btn--secondary" to="/showcase/content-map">
              查看内容图谱
            </Link>
          </div>
          <div className="showcase-trust">
            <span>Public API only</span>
            <span>Manifest-driven entries</span>
            <span>Static HTML + React</span>
          </div>
        </div>

        <div className="showcase-code-card">
          <div className="showcase-code-card__bar">
            <span>home-model.ts</span>
            <small>docs -&gt; entries</small>
          </div>
          <pre><code>{`import docs from "virtual:folio/content";
import { folioCollectionIndexes } from "@uichat-mira/folio";

const collections = folioCollectionIndexes(config);
const guides = docs.filter((doc) => doc.type === "doc");
const articles = docs.filter((doc) => doc.type === "article");`}</code></pre>
        </div>
      </section>

      <section className="showcase-stats" aria-label="Live Folio content metrics">
        <div><strong>{model.stats.docs}</strong><span>内容条目</span></div>
        <div><strong>{model.stats.collections}</strong><span>集合索引</span></div>
        <div><strong>{model.stats.headings}</strong><span>提取标题</span></div>
        <div><strong>{model.stats.tags}</strong><span>Frontmatter 标签</span></div>
      </section>

      <section className="showcase-section" aria-labelledby="content-types">
        <div className="showcase-section__head">
          <span className="showcase-eyebrow">Four content types</span>
          <h2 id="content-types">四类内容，四种阅读方式。</h2>
          <p>
            类型不是标签。文档进入带侧边导航的文档壳，文章按日期排序并出现页内目录，
            项目档案记录范围与决策，独立页面承担图谱和参考入口。
          </p>
        </div>
        <div className="showcase-type-grid">
          {model.groups.map((group) => (
            <article className={"showcase-type-card showcase-type-card--" + group.type} key={group.type}>
              <header>
                <code>{group.type}</code>
                <span>{counts.get(group.type) ?? 0} 条 · {TYPE_COUNT_LABEL[group.type]}</span>
              </header>
              <h3>{group.label}</h3>
              <p>{group.purpose}</p>
              <ul>
                {group.docs.map((doc) => (
                  <li key={doc.path}>
                    <Link to={doc.path}>{doc.title}</Link>
                    <small>{doc.description}</small>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="showcase-section showcase-section--soft" aria-labelledby="reader-paths">
        <div className="showcase-section__head">
          <span className="showcase-eyebrow">Reader paths</span>
          <h2 id="reader-paths">不要只看卡片，沿着路径走一遍。</h2>
          <p>下面三条路径的每一步都指向真实内容 route，而不是首页临时拼出来的假链接。</p>
        </div>
        <ol className="showcase-path-list">
          {model.paths.map((path) => (
            <li key={path.label}>
              <span>{path.label}</span>
              <div>
                {path.docs.map((doc, index) => (
                  <span className="showcase-path-step" key={doc.path}>
                    {index > 0 ? <b aria-hidden="true">→</b> : null}
                    <Link to={doc.path}>{doc.title}</Link>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="showcase-section" aria-labelledby="collections">
        <div className="showcase-section__head">
          <span className="showcase-eyebrow">Collections</span>
          <h2 id="collections">集合索引来自配置，而不是另写一份列表。</h2>
          <p>
            这些入口由 <code>folio.config.ts</code> 的 <code>collections</code> 生成，
            按路由前缀递归收录内容。点进去可以看到该路径下的全部条目。
          </p>
        </div>
        <div className="showcase-collection-grid">
          {model.collections.map((collection) => (
            <Link to={collection.path} key={collection.path}>
              <code>{collection.path}</code>
              <h3>{collection.title}</h3>
              <p>{collection.description}</p>
              <ul>
                {collection.docs.map((doc) => (
                  <li key={doc.path}>{doc.title}</li>
                ))}
              </ul>
              <small>打开集合 →</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="showcase-dark">
        <div>
          <span className="showcase-eyebrow showcase-eyebrow--dark">Boundary</span>
          <h2>站点可以换皮，运行时不必 fork。</h2>
          <p>
            首页、文章尾部与静态 route body 都由站点层组合。
            Folio 继续负责内容模型、集合、路由与构建契约。当前页面没有从
            <code> packages/folio/src </code> 导入任何内部实现。
          </p>
        </div>
        <div className="showcase-layer-list">
          <div><span>01</span><strong>Git + Markdown</strong><small>source of truth</small></div>
          <div><span>02</span><strong>Folio contract</strong><small>content · route · build</small></div>
          <div><span>03</span><strong>apps/site</strong><small>brand · layout · entry</small></div>
        </div>
      </section>

      <section className="showcase-cta">
        <div>
          <span className="showcase-eyebrow">Boundaries are visible</span>
          <h2>支持什么、缺失什么，都写在真实页面里。</h2>
          <p>
            搜索、TOC、集合索引和静态输出可以亲自验证；标签聚合、搜索分面和 Mermaid
            无 JS 图形则明确记录为未实现，不用假交互凑数。
          </p>
        </div>
        <Link className="showcase-btn showcase-btn--primary" to="/showcase/from-file-to-page">
          跟踪一条内容链路
        </Link>
      </section>
    </main>
  );
}
