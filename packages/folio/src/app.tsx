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
import { normalizeBasePath } from "./config";
import { FolioMarkdown } from "./markdown-react";
import { searchFolioDocs } from "./search";
import { getFolioDocNeighbors } from "./navigation";
import type {
  FolioAppProps,
  FolioDoc,
  FolioThemePreference,
  FolioUiOptions,
} from "./types";

function href(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function groupDocs(docs: FolioDoc[]): Array<[string, FolioDoc[]]> {
  const groups = new Map<string, FolioDoc[]>();
  for (const doc of docs) {
    const current = groups.get(doc.group) ?? [];
    current.push(doc);
    groups.set(doc.group, current);
  }
  return [...groups.entries()];
}

function resolveInitialTheme(preference: FolioThemePreference): "light" | "dark" {
  if (typeof window === "undefined") return preference === "dark" ? "dark" : "light";
  const saved = window.localStorage.getItem("folio-theme");
  if (saved === "light" || saved === "dark") return saved;
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

function ShareButton({ doc }: { doc: FolioDoc }) {
  const [label, setLabel] = useState("分享");

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: doc.title,
          text: doc.description || doc.title,
          url,
        });
        setLabel("已分享");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setLabel("链接已复制");
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        setLabel("链接已复制");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLabel("分享失败");
    }
    window.setTimeout(() => setLabel("分享"), 1800);
  }

  return (
    <button type="button" className="folio-share-button" onClick={() => void share()}>
      {label}
    </button>
  );
}

function DocumentPage({
  doc,
  footer,
  share,
  toc,
  pagination,
  previous,
  next,
}: {
  doc: FolioDoc;
  footer?: ReactNode;
  share: boolean;
  toc: boolean;
  pagination: boolean;
  previous?: FolioDoc;
  next?: FolioDoc;
}) {
  const [activeHeading, setActiveHeading] = useState("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const hasToc = toc && doc.headings.length > 0;

  useEffect(() => {
    setMobileTocOpen(false);
    if (!hasToc) {
      setActiveHeading("");
      return;
    }
    const nodes = doc.headings
      .map((heading) => document.getElementById(heading.id))
      .filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px", threshold: [0, 1] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [doc.path, hasToc]);

  const tocList = hasToc ? (
    <ul>
      {doc.headings.map((heading) => (
        <li className={"depth-" + heading.depth} key={heading.id}>
          <a
            className={activeHeading === heading.id ? "active" : ""}
            href={"#" + heading.id}
            onClick={() => setMobileTocOpen(false)}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className="folio-document-shell">
      <main className="folio-doc-page">
        <div className="folio-doc-toolbar">
          <div className="folio-eyebrow">{doc.group}</div>
          <div className="folio-doc-toolbar-actions">
            {hasToc ? (
              <button
                type="button"
                className="folio-mobile-toc-button"
                aria-expanded={mobileTocOpen}
                aria-controls="folio-mobile-toc"
                onClick={() => setMobileTocOpen((value) => !value)}
              >
                页面导航
              </button>
            ) : null}
            {share ? <ShareButton doc={doc} /> : null}
          </div>
        </div>
        {mobileTocOpen && hasToc ? (
          <aside className="folio-mobile-toc" id="folio-mobile-toc">
            <strong>本页目录</strong>
            {tocList}
          </aside>
        ) : null}
        <h1>{doc.title}</h1>
        {doc.description && <p className="folio-lede">{doc.description}</p>}
        <FolioMarkdown source={doc.body} options={{ removeH1: true }} />
        {footer}
        {pagination && (previous || next) ? (
          <nav className="folio-page-nav" aria-label="文档前后导航">
            {previous ? (
              <Link to={href(previous.path)}>
                <span>上一篇</span>
                <strong>{"← " + previous.title}</strong>
              </Link>
            ) : <span />}
            {next ? (
              <Link className="next" to={href(next.path)}>
                <span>下一篇</span>
                <strong>{next.title + " →"}</strong>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
      {hasToc ? (
        <aside className="folio-toc">
          <h2>本页目录</h2>
          {tocList}
        </aside>
      ) : null}
    </div>
  );
}

function Home({
  docs,
  title,
  description,
  custom,
}: {
  docs: FolioDoc[];
  title: string;
  description: string;
  custom?: ReactNode;
}) {
  if (custom) return <>{custom}</>;
  const featured = docs.filter((doc) => doc.path !== "/").slice(0, 8);

  return (
    <main className="folio-home">
      <section className="folio-hero">
        <div className="folio-eyebrow">FOLIO</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <section className="folio-card-grid">
        {featured.map((doc) => (
          <Link key={doc.path} to={href(doc.path)} className="folio-card">
            <span>{doc.group}</span>
            <h2>{doc.title}</h2>
            <p>{doc.description}</p>
          </Link>
        ))}
      </section>
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
  const location = useLocation();
  const groups = groupDocs(docs);
  const current = docs.find((doc) => href(doc.path) === href(location.pathname));
  const navigation = config.navigation ?? [
    { label: "文档", href: "/docs" },
    { label: "博客", href: "/blogs" },
    { label: "项目", href: "/projects" },
  ];
  const searchEnabled = ui?.search !== false;
  const themeEnabled = ui?.theme !== false;
  const shareEnabled = ui?.share !== false;
  const tocEnabled = ui?.toc !== false;
  const paginationEnabled = ui?.pagination !== false;
  const themePreference = ui?.defaultTheme ?? "system";
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => resolveInitialTheme(themePreference),
  );

  useEffect(() => {
    setMobileOpen(false);
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

  function toggleTheme() {
    setTheme((value) => value === "dark" ? "light" : "dark");
  }

  return (
    <div className="folio-shell">
      <header className="folio-header">
        <Link to="/" className="folio-brand">
          {config.logo && <img src={config.logo} alt="" />}
          <span>{config.title}</span>
        </Link>
        <nav className="folio-desktop-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              className={location.pathname === href(item.href) || location.pathname.startsWith(href(item.href) + "/") ? "active" : ""}
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="folio-header-actions">
          <div className="folio-runtime-actions">
            {searchEnabled ? (
              <button type="button" className="folio-search-trigger" onClick={() => setSearchOpen(true)}>
                <SearchIcon /><span>搜索</span><kbd>⌘K</kbd>
              </button>
            ) : null}
            {themeEnabled ? (
              <button
                type="button"
                className="folio-icon-button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "切换到浅色模式" : "切换到暗色模式"}
                title={theme === "dark" ? "浅色模式" : "暗色模式"}
              >
                <ThemeIcon dark={theme === "dark"} />
              </button>
            ) : null}
            {slots?.headerActions}
            <button
              type="button"
              className="folio-mobile-menu-button"
              aria-label={mobileOpen ? "关闭导航" : "打开导航"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="folio-mobile-panel">
            <nav>
              {navigation.map((item) => (
                <Link key={item.href} to={item.href}>{item.label}</Link>
              ))}
            </nav>
            <div>
              {searchEnabled ? <button type="button" onClick={() => setSearchOpen(true)}>搜索</button> : null}
              {themeEnabled ? <button type="button" onClick={toggleTheme}>{theme === "dark" ? "浅色模式" : "暗色模式"}</button> : null}
            </div>
          </div>
        ) : null}
      </header>

      <div className="folio-layout">
        <aside className="folio-sidebar">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h2>{group}</h2>
              {items.map((doc) => (
                <Link
                  key={doc.path}
                  className={current?.path === doc.path ? "active" : ""}
                  to={href(doc.path)}
                >
                  {doc.title}
                </Link>
              ))}
            </section>
          ))}
        </aside>

        <div className="folio-content">
          <Routes>
            <Route
              path="/"
              element={<Home docs={docs} title={config.title} description={config.description} custom={slots?.home} />}
            />
            {docs.map((doc) => {
              const neighbors = getFolioDocNeighbors(docs, doc);
              return (
                <Route
                  key={doc.path}
                  path={href(doc.path)}
                  element={
                    <DocumentPage
                      doc={doc}
                      footer={slots?.articleFooter}
                      share={shareEnabled}
                      toc={tocEnabled}
                      pagination={paginationEnabled}
                      previous={neighbors.previous}
                      next={neighbors.next}
                    />
                  }
                />
              );
            })}
            <Route path="*" element={<NotFound searchEnabled={searchEnabled} onSearch={() => setSearchOpen(true)} />} />
          </Routes>
          <footer className="folio-footer">{config.footer ?? "Built with Folio."}</footer>
        </div>
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
