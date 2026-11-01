import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { normalizeBasePath } from "./core/config";
import { FolioHeader } from "./header";
import { FolioDocsShell } from "./docs-shell";
import { SearchIcon } from "./icons";
import { FolioShareButton } from "./share";
import { FolioMarkdown } from "./markdown-react";
import { FolioToc } from "./toc";
import { searchFolioDocs } from "./core/search";
import {
  folioCollectionIndexes,
  selectFolioCollectionDocs,
  assertNoFolioCollectionConflicts,
  type FolioCollectionIndex,
} from "./core/collection-index";
import type { FolioDoc, FolioConfig } from "./types";
import type {
  FolioAppProps,
  FolioThemePreference,
  FolioUiOptions,
} from "./ui-types";

function href(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function resolveInitialTheme(preference: FolioThemePreference): "light" | "dark" {
  if (typeof window === "undefined") return preference === "dark" ? "dark" : "light";
  const saved = window.localStorage.getItem("folio-theme");
  if (saved === "light" || saved === "dark") return saved;
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function DocumentPage({
  doc,
  footer,
  share,
}: {
  doc: FolioDoc;
  footer?: ReactNode;
  share: boolean;
}) {
  const articleToc = doc.type === "article" && doc.headings.length > 0;
  const mobileTocRef = useRef<HTMLDetailsElement>(null);
  const body = (
    <main className={"folio-doc-page" + (articleToc ? " folio-article-main" : "")}>
      <div className="folio-doc-toolbar">
        <div className="folio-eyebrow">{doc.group}</div>
        {share ? <FolioShareButton title={doc.title} text={doc.description} /> : null}
      </div>
      <h1>{doc.title}</h1>
      {doc.description && <p className="folio-lede">{doc.description}</p>}
      <FolioMarkdown source={doc.body} options={{ removeH1: true }} />
      {footer}
    </main>
  );

  if (!articleToc) return body;
  return (
    <div className="folio-article-layout">
      <details ref={mobileTocRef} className="folio-article-mobile-toc">
        <summary>本页目录</summary>
        <FolioToc headings={doc.headings} onNavigate={() => {
          if (mobileTocRef.current) mobileTocRef.current.open = false;
        }} />
      </details>
      {body}
      <FolioToc headings={doc.headings} />
    </div>
  );
}

function EntryList({
  entries,
  headingLevel,
}: {
  entries: FolioDoc[];
  headingLevel: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className="folio-entry-list">
      {entries.map((doc, index) => (
        <Link to={href(doc.path)} className="folio-entry" key={doc.path}>
          <span className="folio-entry-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="folio-entry-copy">
            {doc.date ? <time className="folio-entry-date" dateTime={doc.date}>{doc.date}</time> : null}
            <Heading className="folio-entry-title">{doc.title}</Heading>
            {doc.description ? <p className="folio-entry-description">{doc.description}</p> : null}
          </div>
          <span className="folio-entry-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  );
}

function Home({
  docs,
  config,
  custom,
}: {
  docs: FolioDoc[];
  config: FolioConfig;
  custom?: ReactNode;
}) {
  if (custom) return <>{custom}</>;
  const collections = folioCollectionIndexes(config);
  const primary = collections[0];
  const primaryDocs = primary
    ? selectFolioCollectionDocs(docs, primary.path)
    : docs.filter((doc) => doc.type !== "page");
  const featured = primaryDocs[0];
  const recent = primaryDocs.slice(1, 5);
  const about = docs.find((doc) => doc.type === "page");

  return (
    <main className="folio-home folio-journal-home folio-editorial-home">
      <div className="folio-editorial-meta" aria-label="站点首页">
        <span>PERSONAL JOURNAL <span aria-hidden="true">✳</span></span>
        <span>READ · COLLECT · REMEMBER</span>
      </div>
      <section className="folio-editorial-lead" aria-label="小站介绍与精选文章">
        <div className="folio-editorial-intro">
          <div className="folio-editorial-kicker">
            <span className="folio-editorial-kicker-line" aria-hidden="true" />
            写给生活的零碎记录
          </div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
          {primary && (
            <Link className="folio-editorial-hero-link" to={primary.path}>
              浏览{primary.title} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        {featured && (
          <Link className="folio-editorial-feature" to={href(featured.path)}>
            <span className="folio-editorial-feature-label">
              <span aria-hidden="true">✳</span> FEATURED STORY
            </span>
            <span className="folio-editorial-feature-body">
              <span className="folio-editorial-feature-no">01 / {String(primaryDocs.length).padStart(2, "0")}</span>
              <h2>{featured.title}</h2>
              {featured.description && <p>{featured.description}</p>}
            </span>
            <span className="folio-editorial-feature-bottom">
              开始阅读 <span aria-hidden="true">↗</span>
            </span>
          </Link>
        )}
      </section>
      <div className="folio-editorial-rule">
        <span>THE NOTEBOOK</span>
        <span>{String(primaryDocs.length).padStart(2, "0")} ENTRIES</span>
      </div>
      <div className="folio-editorial-lower">
        <section className="folio-editorial-recent" aria-label="文章选读">
          <div className="folio-editorial-section-heading">
            <div>
              <span className="folio-editorial-section-label">01 / READING</span>
              <h2>{primary?.title ?? "近期内容"}</h2>
            </div>
            {primary && (
              <Link to={primary.path} className="folio-editorial-view-all">
                全部{primary.title} <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
          {recent.length ? (
            <EntryList entries={recent} headingLevel="h3" />
          ) : !featured ? (
            <p className="folio-collection-empty">这里还没有内容。</p>
          ) : (
            <p className="folio-editorial-endnote">更多记录，正在慢慢写下。</p>
          )}
        </section>
        <div className="folio-editorial-aside">
          {collections.slice(1).map((collection, index) => {
            const entries = selectFolioCollectionDocs(docs, collection.path).slice(0, 3);
            return (
              <section className="folio-editorial-side-section" key={collection.path}>
                <div className="folio-editorial-section-heading">
                  <div>
                    <span className="folio-editorial-section-label">
                      {String(index + 2).padStart(2, "0")} / COLLECTION
                    </span>
                    <h2>{collection.title}</h2>
                  </div>
                  <Link to={collection.path} className="folio-editorial-view-all" aria-label={"全部" + collection.title}>
                    ↗
                  </Link>
                </div>
                {entries.length ? (
                  <EntryList entries={entries} headingLevel="h3" />
                ) : (
                  <p className="folio-collection-empty">{collection.emptyMessage}</p>
                )}
              </section>
            );
          })}
          {about && (
            <aside className="folio-editorial-about">
              <span className="folio-editorial-section-label">A LITTLE ABOUT</span>
              <h2>{about.title}</h2>
              <p>{about.description || config.description}</p>
              <Link to={href(about.path)}>读读关于小站 <span aria-hidden="true">↗</span></Link>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function CollectionIndex({
  docs,
  collection,
}: {
  docs: FolioDoc[];
  collection: FolioCollectionIndex;
}) {
  const entries = selectFolioCollectionDocs(docs, collection.path);
  return (
    <main className="folio-home folio-collection-page">
      <header className="folio-journal-hero folio-collection-hero">
        <span className="folio-journal-kicker">COLLECTION</span>
        <h1>{collection.title}</h1>
        {collection.description ? <p>{collection.description}</p> : null}
      </header>
      {entries.length ? (
        <EntryList entries={entries} headingLevel="h2" />
      ) : (
        <p className="folio-collection-empty">{collection.emptyMessage}</p>
      )}
    </main>
  );
}

function SearchOverlay({
  docs,
  onClose,
}: {
  docs: FolioDoc[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchFolioDocs(docs, query), [docs, query]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActiveIndex(0), [query]);

  function openResult(index: number) {
    const result = results[index];
    if (!result) return;
    navigate(href(result.path));
    onClose();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      openResult(activeIndex);
    }
  }

  return (
    <div
      className="folio-search-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="folio-search-dialog" role="dialog" aria-modal="true" aria-label="搜索内容">
        <div className="folio-search-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索标题、正文、分组或标签..."
            aria-label="搜索内容"
          />
          <button type="button" onClick={onClose}>Esc</button>
        </div>
        <div className="folio-search-results" role="listbox" aria-label="搜索结果">
          {results.length ? results.map((doc, index) => (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? "active" : ""}
              key={doc.path}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => openResult(index)}
            >
              <strong>{doc.title}</strong>
              <span>{doc.group}{doc.description ? " · " + doc.description : ""}</span>
            </button>
          )) : <p className="folio-search-empty">没有找到匹配内容</p>}
        </div>
        <footer className="folio-search-footer">
          <span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  );
}

function NotFound({ searchEnabled, onSearch }: { searchEnabled: boolean; onSearch: () => void }) {
  return (
    <main className="folio-not-found">
      <span>404</span>
      <h1>这条路径没有内容</h1>
      <p>页面可能已经移动、删除，或者地址输入有误。</p>
      <div>
        <Link to="/" className="folio-button folio-button--primary">返回首页</Link>
        {searchEnabled ? (
          <button type="button" className="folio-button" onClick={onSearch}>搜索内容</button>
        ) : null}
      </div>
    </main>
  );
}

function Shell({
  config,
  docs,
  slots,
  ui,
}: Omit<FolioAppProps, "basePath">) {
  assertNoFolioCollectionConflicts(docs, config);
  const location = useLocation();
  const current = docs.find((doc) => href(doc.path) === href(location.pathname));
  const navigation = config.navigation ?? [
    { label: "文档", href: "/docs" },
    { label: "博客", href: "/blogs" },
    { label: "项目", href: "/projects" },
  ];
  const searchEnabled = ui?.search !== false;
  const themeEnabled = ui?.theme !== false;
  const shareEnabled = ui?.share !== false;
  const docsShellEnabled = ui?.docsShell !== false;
  const themePreference = ui?.defaultTheme ?? "system";
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => resolveInitialTheme(themePreference),
  );

  useEffect(() => {
    setSearchOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!themeEnabled) return;
    document.documentElement.dataset.folioTheme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("folio-theme", theme);
  }, [theme, themeEnabled]);

  useEffect(() => {
    if (!searchEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchEnabled]);

  function openSearch() {
    setSearchOpen(true);
  }

  function toggleTheme() {
    setTheme((value) => value === "dark" ? "light" : "dark");
  }

  return (
    <div className="folio-shell">
      <FolioHeader
        config={config}
        navigation={navigation}
        currentDoc={current}
        searchEnabled={searchEnabled}
        themeEnabled={themeEnabled}
        shareEnabled={shareEnabled}
        darkMode={theme === "dark"}
        onSearch={openSearch}
        onToggleTheme={toggleTheme}
        actions={slots?.headerActions}
      />

      <div className="folio-content">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                docs={docs}
                config={config}
                custom={slots?.home}
              />
            }
          />
          {folioCollectionIndexes(config).map((collection) => (
            <Route
              key={collection.path}
              path={collection.path}
              element={
                <CollectionIndex
                  docs={docs}
                  collection={collection}
                />
              }
            />
          ))}
          {docs.map((doc) => (
            <Route
              key={doc.path}
              path={href(doc.path)}
              element={
                docsShellEnabled && doc.type === "doc" ? (
                  <FolioDocsShell
                    doc={doc}
                    docs={docs}
                    footer={slots?.articleFooter}
                    share={shareEnabled}
                  />
                ) : (
                  <DocumentPage
                    doc={doc}
                    footer={slots?.articleFooter}
                    share={shareEnabled}
                  />
                )
              }
            />
          ))}
          <Route
            path="*"
            element={
              <NotFound
                searchEnabled={searchEnabled}
                onSearch={openSearch}
              />
            }
          />
        </Routes>
        <footer className="folio-footer">
          {config.footer ?? "Built with Folio."}
        </footer>
      </div>

      {searchOpen ? <SearchOverlay docs={docs} onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

export function FolioApp({
  config,
  docs,
  basePath = "/",
  slots,
  ui,
}: FolioAppProps) {
  const basename = normalizeBasePath(basePath);

  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename.replace(/\/$/, "")}>
      <Shell config={config} docs={docs} slots={slots} ui={ui} />
    </BrowserRouter>
  );
}
