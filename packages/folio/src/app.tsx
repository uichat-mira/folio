import {
  useEffect,
  useLayoutEffect,
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
import { FolioHeader } from "./ui/header";
import { FolioFooter } from "./ui/footer";
import { resolveFolioReaderKind, shouldShowFolioPageFooter } from "./ui/page-presentation";
import { FolioDocsShell } from "./docs-shell";
import { FolioNavigationStateProvider } from "./ui/tree-nav/NavigationState";

import { SearchIcon } from "./icons";
import { FolioDocumentBody } from "./document-body";
import { FolioToc } from "./ui/toc";
import { searchFolioDocs } from "./core/search";
import {
  folioCollectionIndexes,
  selectFolioCollectionDocs,
  assertNoFolioCollectionConflicts,
  type FolioCollectionIndex,
} from "./core/collection-index";
import { resolveFolioHome, type FolioHomeSection } from "./core/home";
import { FolioEntryList, type FolioEntryTagLink } from "./ui/entry-list";
import {
  buildFolioArticleArchiveModel,
  FolioArchiveCategoryRow,
  FolioArticleArchivePage,
  FolioArticleTags,
  type FolioArticleArchiveCollection,
} from "./ui/article-archive";
import type { FolioArticleArchiveGroup } from "./core/article-archive";
import type { FolioDoc, FolioConfig } from "./types";
import type {
  FolioAppProps,
  FolioSlots,
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
  tags,
}: {
  doc: FolioDoc;
  footer?: ReactNode;
  tags?: readonly FolioEntryTagLink[];
}) {
  const articleToc = doc.type === "article" && doc.headings.length > 0;
  const mobileTocRef = useRef<HTMLDetailsElement>(null);
  const body = (
    <main className={"folio-doc-page" + (articleToc ? " folio-article-main" : "")}>
      {doc.type === "article" ? <FolioArticleTags links={tags} /> : null}
      <FolioDocumentBody doc={doc} />
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

function DefaultHome({
  docs,
  config,
}: {
  docs: FolioDoc[];
  config: FolioConfig;
}) {
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
            <FolioEntryList entries={recent} headingLevel="h3" />
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
                  <FolioEntryList entries={entries} headingLevel="h3" />
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

function ConfiguredHome({
  docs,
  config,
}: {
  docs: FolioDoc[];
  config: FolioConfig;
}) {
  const model = resolveFolioHome(config, docs);

  function renderSection(section: FolioHomeSection, index: number) {
    switch (section.type) {
      case "intro":
        return (
          <section className="folio-editorial-lead folio-editorial-lead--single" key={"intro-" + index}>
            <div className="folio-editorial-intro">
              <div className="folio-editorial-kicker">
                <span className="folio-editorial-kicker-line" aria-hidden="true" />
                {section.kicker}
              </div>
              <h1>{section.title}</h1>
              <p>{section.description}</p>
              {section.collection && (
                <Link className="folio-editorial-hero-link" to={section.collection.path}>
                  浏览{section.collection.title} <span aria-hidden="true">↗</span>
                </Link>
              )}
            </div>
          </section>
        );
      case "featured":
        return (
          <section className="folio-editorial-lead folio-editorial-lead--single" key={"featured-" + index}>
            <Link className="folio-editorial-feature" to={href(section.doc.path)}>
              <span className="folio-editorial-feature-label">
                <span aria-hidden="true">✳</span> {section.label}
              </span>
              <span className="folio-editorial-feature-body">
                <span className="folio-editorial-feature-no">
                  {String(section.number).padStart(2, "0")} / {String(section.total).padStart(2, "0")}
                </span>
                <h2>{section.doc.title}</h2>
                {section.doc.description && <p>{section.doc.description}</p>}
              </span>
              <span className="folio-editorial-feature-bottom">
                {section.readLabel} <span aria-hidden="true">↗</span>
              </span>
            </Link>
          </section>
        );
      case "recent":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"recent-" + index}>
            <section className="folio-editorial-recent" aria-label="文章选读">
              <div className="folio-editorial-section-heading">
                <div>
                  <span className="folio-editorial-section-label">{section.label}</span>
                  <h2>{section.title}</h2>
                </div>
                {section.collection && (
                  <Link to={section.collection.path} className="folio-editorial-view-all">
                    全部{section.collection.title} <span aria-hidden="true">↗</span>
                  </Link>
                )}
              </div>
              {section.docs.length ? (
                <FolioEntryList entries={section.docs} headingLevel="h3" />
              ) : section.hadEntries ? (
                <p className="folio-editorial-endnote">{section.endMessage}</p>
              ) : (
                <p className="folio-collection-empty">{section.emptyMessage}</p>
              )}
            </section>
          </section>
        );
      case "collections":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"collections-" + index}>
            <div className="folio-editorial-aside">
              {section.collections.map((entry, entryIndex) => (
                <section className="folio-editorial-side-section" key={entry.collection.path}>
                  <div className="folio-editorial-section-heading">
                    <div>
                      <span className="folio-editorial-section-label">
                        {String(entryIndex + 2).padStart(2, "0")} / COLLECTION
                      </span>
                      <h2>{entry.collection.title}</h2>
                    </div>
                    <Link
                      to={entry.collection.path}
                      className="folio-editorial-view-all"
                      aria-label={"全部" + entry.collection.title}
                    >
                      ↗
                    </Link>
                  </div>
                  {entry.docs.length ? (
                    <FolioEntryList entries={entry.docs} headingLevel="h3" />
                  ) : (
                    <p className="folio-collection-empty">{entry.emptyMessage}</p>
                  )}
                </section>
              ))}
            </div>
          </section>
        );
      case "about":
        return (
          <section className="folio-editorial-lower folio-editorial-lower--single" key={"about-" + index}>
            <aside className="folio-editorial-about">
              <span className="folio-editorial-section-label">A LITTLE ABOUT</span>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              <Link to={href(section.doc.path)}>
                {section.linkLabel} <span aria-hidden="true">↗</span>
              </Link>
            </aside>
          </section>
        );
    }
  }

  return (
    <main className="folio-home folio-journal-home folio-editorial-home">
      {model.meta && (
        <div className="folio-editorial-meta" aria-label="站点首页">
          <span>{model.meta.left}</span>
          <span>{model.meta.right}</span>
        </div>
      )}
      {model.sections.map(renderSection)}
    </main>
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
  return config.home
    ? <ConfiguredHome docs={docs} config={config} />
    : <DefaultHome docs={docs} config={config} />;
}

function CollectionIndex({
  docs,
  collection,
  categories,
  tagLinks,
}: {
  docs: FolioDoc[];
  collection: FolioCollectionIndex;
  categories?: FolioArticleArchiveCollection["index"]["categories"];
  tagLinks?: ReadonlyMap<string, readonly FolioEntryTagLink[]>;
}) {
  // Category switching is one layer: the chips filter this list in place and
  // never change the route. Archive URLs stay available to crawlers, new-tab
  // links and the no-JS static collection page.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const categoryRowRef = useRef<HTMLElement>(null);
  const resetScroll = useRef(false);
  const activeCategory = categories?.find(
    (group) => group.id === activeCategoryId,
  );
  const entries = activeCategory?.docs ?? selectFolioCollectionDocs(docs, collection.path);

  // A shorter filtered list otherwise clamps the reader near the footer. Once
  // the new list is committed, bring its beginning back under the sticky
  // header + category row, but never jump down when the reader is already above
  // the list (for example while clicking chips at the top of the page).
  useLayoutEffect(() => {
    if (!resetScroll.current) return;
    resetScroll.current = false;
    const list = listRef.current;
    const row = categoryRowRef.current;
    if (!list || !row) return;
    const stickyTop = Number.parseFloat(getComputedStyle(row).top) || 0;
    const target =
      window.scrollY +
      list.getBoundingClientRect().top -
      stickyTop -
      row.getBoundingClientRect().height -
      12;
    if (target >= window.scrollY) return;
    window.scrollTo({
      top: target,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth",
    });
  }, [activeCategoryId]);

  const selectCategory = (group: FolioArticleArchiveGroup | null) => {
    const next = group?.id ?? null;
    if (next === activeCategoryId) return;
    resetScroll.current = true;
    setActiveCategoryId(next);
  };

  return (
    <main className="folio-home folio-collection-page">
      <header className="folio-journal-hero folio-collection-hero">
        <span className="folio-journal-kicker">COLLECTION</span>
        <h1>{collection.title}</h1>
        {collection.description ? <p>{collection.description}</p> : null}
      </header>
      <FolioArchiveCategoryRow
        collection={collection}
        groups={categories ?? []}
        activeId={activeCategory?.id ?? null}
        onSelect={selectCategory}
        rowRef={categoryRowRef}
      />
      <div ref={listRef}>
        {entries.length ? (
          <FolioEntryList
            entries={entries}
            headingLevel="h2"
            tagLinks={tagLinks}
          />
        ) : (
          <p className="folio-collection-empty">{collection.emptyMessage}</p>
        )}
      </div>
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
  // Opt-in only: without `collections[].archive` this model has no routes,
  // no tag links and no category rows, so existing consumers are unchanged.
  const archive = useMemo(
    () => buildFolioArticleArchiveModel(docs, config),
    [docs, config],
  );
  const current = docs.find((doc) => href(doc.path) === href(location.pathname));
  const navigation = config.navigation ?? [
    { label: "文档", href: "/docs" },
    { label: "博客", href: "/blogs" },
  ];
  const searchEnabled = ui?.search !== false;
  const themeEnabled = ui?.theme !== false;
  const shareEnabled = ui?.share !== false;
  const docsShellEnabled = ui?.docsShell !== false;
  // The same page presentation decision owns both footer surfaces.
  // Content type is resolved once into a reader kind, not reinterpreted here.
  const footerVisible = (doc?: FolioDoc) => shouldShowFolioPageFooter(
    resolveFolioReaderKind(doc, docsShellEnabled),
    ui?.footerOnDocs,
  );
  const showSiteFooter = footerVisible(current);
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
        docs={docs}
        currentDoc={current}
        searchEnabled={searchEnabled}
        themeEnabled={themeEnabled}
        shareEnabled={shareEnabled}
        darkMode={theme === "dark"}
        onSearch={openSearch}
        onToggleTheme={toggleTheme}
        brand={slots?.headerBrand}
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
                  categories={archive.byCollection.get(collection.path)?.index.categories}
                  tagLinks={
                    archive.byCollection.has(collection.path)
                      ? archive.tagsByDoc
                      : undefined
                  }
                />
              }
            />
          ))}
          {archive.routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <FolioArticleArchivePage
                  collection={route.collection}
                  group={route.group}
                  tagLinks={archive.tagsByDoc}
                />
              }
            />
          ))}
          {docs.map((doc) => {
            const reader = resolveFolioReaderKind(doc, docsShellEnabled);
            const articleFooter = footerVisible(doc) ? slots?.articleFooter : undefined;
            return (
              <Route
                key={doc.path}
                path={href(doc.path)}
                element={
                  reader === "document" ? (
                    <FolioDocsShell
                      doc={doc}
                      docs={docs}
                      footer={articleFooter}
                      renderNav={slots?.navigation}
                      renderToc={slots?.docToc}
                    />
                  ) : (
                    <DocumentPage
                      doc={doc}
                      footer={articleFooter}
                      tags={archive.tagsByDoc.get(doc.path)}
                    />
                  )
                }
              />
            );
          })}
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
        {showSiteFooter ? (
          slots?.footer !== undefined ? slots.footer : (
            <FolioFooter footer={config.footer} siteTitle={config.title} />
          )
        ) : null}
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
      <FolioNavigationStateProvider>
        <Shell config={config} docs={docs} slots={slots} ui={ui} />
      </FolioNavigationStateProvider>
    </BrowserRouter>
  );
}
