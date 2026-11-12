import type { FolioDoc } from "@uichat-mira/folio";
import { Link } from "react-router-dom";
import { ThemeExplorerGate } from "./ThemeExplorer";

type HomePageProps = { docs: FolioDoc[] };

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      {diagonal ? (
        <path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const portalModes = [
  { number: "01", label: "PRODUCT / ORGANIZATION", title: "产品与组织门户",
    description: "介绍产品、组织内容、发布官方信息。清晰的入口，比堆砌页面更重要。",
    href: "/about", action: "了解 Folio", variant: "product" },
  { number: "02", label: "DOCS / KNOWLEDGE", title: "文档与知识中心",
    description: "导航、集合、页内目录与搜索，让信息有结构，也让人找得到。",
    href: "/guide/introduction", action: "进入文档指南", variant: "knowledge" },
  { number: "03", label: "JOURNAL / UPDATES", title: "文章与内容发布",
    description: "从一篇 Markdown 到一组持续生长的内容，版本与来源都留在 Git。",
    href: "/blogs/why-folio", action: "阅读一篇文章", variant: "journal" },
] as const;

const publishSteps = [
  { number: "01", title: "提出需求", detail: "用自然语言描述要发布什么" },
  { number: "02", title: "AI 编写", detail: "生成或修改 Markdown 与配置" },
  { number: "03", title: "内容校验", detail: "验证契约、资源与链接" },
  { number: "04", title: "Git 审核", detail: "留下 Diff、记录与权限边界" },
  { number: "05", title: "构建发布", detail: "确定性产物，进入门户" },
] as const;

export function HomePage({ docs }: HomePageProps) {
  const reading = ["/guide/getting-started", "/blogs/why-folio", "/reference/overview"]
    .map((path) => docs.find((doc) => doc.path === path))
    .filter((doc): doc is FolioDoc => doc !== undefined);

  return (
    <main className="folio-portal-home">
      <section className="portal-hero" aria-labelledby="portal-title">
        <div className="portal-container portal-hero__grid">
          <div className="portal-hero__copy">
            <div className="portal-eyebrow"><span className="portal-eyebrow__dot" /> THE CONTENT & PORTAL ENGINE</div>
            <h1 id="portal-title">让内容，<br />成为<span className="portal-hero__accent">门户。</span></h1>
            <p className="portal-hero__lead">
              Folio 是 Git-native 的内容与门户发布引擎。以 Markdown 为内容源，
              在构建时完成组织、渲染与静态发布。从一个产品页面，到整个组织的信息世界。
            </p>
            <div className="portal-hero__actions">
              <Link className="portal-button portal-button--primary" to="/about">
                认识 Folio <Arrow />
              </Link>
              <Link className="portal-button portal-button--outline" to="/guide/getting-started">
                快速开始 <Arrow diagonal />
              </Link>
            </div>
            <div className="portal-hero__metadata">
              <span>Markdown-first</span><i aria-hidden="true" />
              <span>Git-native</span><i aria-hidden="true" />
              <span>Build-time publishing</span>
            </div>
          </div>
          <div className="portal-stage" aria-label="门户页面布局示意">
            <div className="portal-stage__aura" aria-hidden="true" />
            <div className="portal-stage__window">
              <div className="portal-stage__chrome">
                <span className="portal-stage__dots" aria-hidden="true"><i /><i /><i /></span>
                <span>folio / portal preview</span>
                <span className="portal-stage__chrome-right">↗</span>
              </div>
              <div className="portal-stage__page">
                <div className="portal-stage__nav">
                  <strong>folio<span>.</span></strong>
                  <span>STORIES &nbsp; / &nbsp; GUIDES &nbsp; / &nbsp; ABOUT</span>
                </div>
                <div className="portal-stage__eyebrow">A HOME FOR EVERY IDEA <span>— 001</span></div>
                <div className="portal-stage__title">Content is<br />a living <em>thing.</em></div>
                <div className="portal-stage__story">
                  <div className="portal-stage__art" aria-hidden="true">
                    <span className="portal-stage__orbit portal-stage__orbit--one" />
                    <span className="portal-stage__orbit portal-stage__orbit--two" />
                    <span className="portal-stage__sun" />
                    <span className="portal-stage__art-caption">F / 01</span>
                  </div>
                  <div className="portal-stage__story-copy">
                    <span>FEATURED STORY</span>
                    <strong>From files<br />to places.</strong>
                    <p>One source. Many ways to tell a story.</p>
                  </div>
                </div>
                <div className="portal-stage__foot">
                  <span>DESIGNED TO EVOLVE</span><span>01 — 03</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="portal-container portal-hero__baseline">
          <span>FOLIO / 01</span><span>为结构化内容，创造自由表达。</span>
          <a href="#portal-capabilities" aria-label="向下了解 Folio 的门户能力">
            DISCOVER <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="portal-capabilities portal-section" id="portal-capabilities" aria-labelledby="portal-capabilities-title">
        <div className="portal-container">
          <div className="portal-section__heading">
            <div>
              <p className="portal-section__index">01 / WHAT FOLIO BUILDS</p>
              <h2 id="portal-capabilities-title">信息有不同形状。<br /><em>不必有不同底座。</em></h2>
            </div>
            <p className="portal-section__aside">
              不只是一套文档页面。产品、知识与持续更新的内容，可以被组织成各自需要的门户。
            </p>
          </div>
          <div className="portal-modes">
            {portalModes.map((mode) => (
              <Link className={"portal-mode portal-mode--" + mode.variant} to={mode.href} key={mode.number}>
                <div className="portal-mode__top"><span>{mode.number}</span><Arrow diagonal /></div>
                <div className={"portal-mode__figure portal-mode__figure--" + mode.variant} aria-hidden="true">
                  <span className="portal-mode__figure-line" />
                  <span className="portal-mode__figure-panel" />
                  <span className="portal-mode__figure-detail" />
                </div>
                <p className="portal-mode__label">{mode.label}</p>
                <h3>{mode.title}</h3>
                <p className="portal-mode__description">{mode.description}</p>
                <span className="portal-mode__link">{mode.action} <Arrow /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="portal-composition portal-section" aria-labelledby="portal-composition-title">
        <div className="portal-container portal-composition__grid">
          <div className="portal-composition__copy">
            <p className="portal-section__index">02 / COMPOSE, DON'T REBUILD</p>
            <h2 id="portal-composition-title">首页从内容出发，<br /><em>不必从零构建。</em></h2>
            <p>
              Folio 已提供内容类型、集合索引、内置首页区块及公开组合入口。
              常规内容由结构化配置组织，特殊门户界面依然可以通过 React 自定义。
            </p>
            <div className="portal-composition__api-list" aria-label="当前提供的首页相关 API">
              <div><code>config.home.sections</code><span>声明首页内容与顺序</span></div>
              <div><code>resolveFolioHome()</code><span>从真实内容解析首页模型</span></div>
              <div><code>slots.home</code><span>组合专属门户界面</span></div>
            </div>
            <Link className="portal-text-link" to="/guide/configuration">
              查看当前配置能力 <Arrow />
            </Link>
          </div>
          <div className="portal-config" aria-label="Folio 已支持的首页配置示例">
            <div className="portal-config__bar">
              <span><i aria-hidden="true" /> folio.config.ts</span>
              <small>PUBLIC API / EXAMPLE</small>
            </div>
            <pre><code>
              <span className="portal-code-comment">// 首页信息层级，可以由数据决定</span>{"\n"}
              <span className="portal-code-key">home</span>: {"{"}{"\n"}
              {"  "}<span className="portal-code-key">sections</span>: [{"\n"}
              {"    "}{"{"} type: <span className="portal-code-string">"intro"</span>, title: <span className="portal-code-string">"欢迎来到 Folio"</span> {"}"},{"\n"}
              {"    "}{"{"} type: <span className="portal-code-string">"featured"</span>,{"\n"}
              {"      "}path: <span className="portal-code-string">"/blogs/why-folio"</span> {"}"},{"\n"}
              {"    "}{"{"} type: <span className="portal-code-string">"collections"</span>,{"\n"}
              {"      "}paths: [<span className="portal-code-string">"/guide"</span>, <span className="portal-code-string">"/reference"</span>] {"}"},{"\n"}
              {"  "}],{"\n"}
              {"}"}
            </code></pre>
            <div className="portal-config__foot">
              <span className="portal-config__check" aria-hidden="true">✓</span>
              <span>已有 API · 首页组合能力仍在扩展</span>
              <Link to="/guide/organizing-content" aria-label="查看内容组织实践"><Arrow diagonal /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-workflow portal-section" aria-labelledby="portal-workflow-title">
        <div className="portal-container">
          <div className="portal-workflow__intro">
            <div>
              <p className="portal-section__index">03 / BUILT FOR THE AI ERA</p>
              <div className="portal-workflow__status"><span aria-hidden="true" /> NEXT RELEASE · IN DEVELOPMENT</div>
              <h2 id="portal-workflow-title">从一句需求，<br />到一次可信的<em>发布。</em></h2>
            </div>
            <p>
              下一版正在建设 AI 驱动的内容写作、变更与发布编排。
              人负责意图和决策，AI 负责执行，Git 保留可检查的事实。
            </p>
          </div>
          <ol className="portal-workflow__steps">
            {publishSteps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span><strong>{step.title}</strong><small>{step.detail}</small>
              </li>
            ))}
          </ol>
          <div className="portal-workflow__bottom">
            <span>CONTENT AS CODE <i aria-hidden="true" /> REVIEWABLE CHANGES <i aria-hidden="true" /> REPRODUCIBLE BUILDS</span>
            <p>当前已具备 Git / Markdown 构建发布基础；完整 AI 操作链路是本轮版本开发目标。</p>
          </div>
        </div>
      </section>

      <section className="portal-design portal-section" aria-labelledby="portal-design-title">
        <div className="portal-container">
          <div className="portal-section__heading">
            <div>
              <p className="portal-section__index">04 / A SYSTEM, NOT A TEMPLATE</p>
              <h2 id="portal-design-title">保持同一种秩序。<br /><em>拥有不一样的气质。</em></h2>
            </div>
            <p className="portal-section__aside">
              设计系统负责一致性，站点负责表达。Folio 提供基础 Token 与组件能力，门户布局模式继续生长。
            </p>
          </div>
          <div className="portal-design__grid">
            <div className="portal-design-card portal-design-card--type">
              <div className="portal-design-card__top"><span>FOUNDATION / TYPE</span><span>01</span></div>
              <div className="portal-design-card__specimen"><span>Ag</span><strong>字，有风骨。</strong></div>
              <div className="portal-design-card__bottom"><strong>排版与节奏</strong><span>清晰的层级，克制的语言</span></div>
            </div>
            <div className="portal-design-card portal-design-card--color">
              <div className="portal-design-card__top"><span>FOUNDATION / TOKENS</span><span>02</span></div>
              <div className="portal-design-card__swatches" role="img" aria-label="当前主题的主色、辅助色、文字墨色、强调色和卡片背景">
                <span /><span /><span /><span /><span />
              </div>
              <div className="portal-design-card__bottom"><strong>统一而可配置</strong><span>颜色、间距与视觉契约</span></div>
            </div>
            <div className="portal-design-card portal-design-card--ui">
              <div className="portal-design-card__top"><span>COMPONENTS / PATTERNS</span><span>03</span></div>
              <div className="portal-design-card__mini-ui" aria-hidden="true">
                <span className="portal-design-card__mini-header"><i /><i /><i /></span>
                <span className="portal-design-card__mini-title" />
                <span className="portal-design-card__mini-copy" />
                <span className="portal-design-card__mini-copy portal-design-card__mini-copy--short" />
                <span className="portal-design-card__mini-actions"><i /><i /></span>
              </div>
              <div className="portal-design-card__bottom"><strong>组合而非复制</strong><span>Header、Popover 与可演进的布局</span></div>
            </div>
          </div>
          <ThemeExplorerGate docs={docs} />
        </div>
      </section>

      <section className="portal-audience portal-section" aria-labelledby="portal-audience-title">
        <div className="portal-container">
          <div className="portal-section__heading portal-section__heading--compact">
            <div>
              <p className="portal-section__index">05 / WHO IT'S FOR</p>
              <h2 id="portal-audience-title">由 Mira 实践。<br /><em>向更多创作者开放。</em></h2>
            </div>
          </div>
          <div className="portal-audience__grid">
            <article className="portal-audience__panel portal-audience__panel--mira">
              <span className="portal-audience__number">01 / MIRA ORGANIZATION</span>
              <div className="portal-audience__symbol" aria-hidden="true">M.</div>
              <div>
                <h3>组织的官方信息发布底座</h3>
                <p>产品介绍、技术文档、文章与公告，用一套可信的内容链路持续维护。</p>
                <span className="portal-audience__footnote">真实需求驱动引擎演进</span>
              </div>
            </article>
            <article className="portal-audience__panel portal-audience__panel--builders">
              <span className="portal-audience__number">02 / BUILDERS & CREATORS</span>
              <div className="portal-audience__symbol portal-audience__symbol--builders" aria-hidden="true">{"{ F }"}</div>
              <div>
                <h3>为自己的内容，构建自己的表达</h3>
                <p>从内置模型开始，也可以通过公开 API 和 React 组合出独特的站点。</p>
                <Link to="/guide/runtime-composition" className="portal-audience__link">探索组合能力 <Arrow /></Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="portal-closing" aria-labelledby="portal-closing-title">
        <div className="portal-container portal-closing__inner">
          <div>
            <span>BUILD SOMETHING THAT LASTS.</span>
            <h2 id="portal-closing-title">故事值得被记录。<br /><em>也值得被看见。</em></h2>
          </div>
          <div className="portal-closing__actions">
            <Link className="portal-button portal-button--light" to="/guide/getting-started">开始使用 Folio <Arrow /></Link>
            <a className="portal-button portal-button--ghost" href="https://github.com/uichat-mira/folio" target="_blank" rel="noopener noreferrer">GitHub 源码 <Arrow diagonal /></a>
          </div>
        </div>
      </section>
      <div className="portal-container portal-read-next" aria-label="继续阅读">
        <span>KEEP EXPLORING /</span>
        {reading.map((doc) => (
          <Link to={doc.path} key={doc.path}>{doc.title} <Arrow diagonal /></Link>
        ))}
      </div>
    </main>
  );
}
