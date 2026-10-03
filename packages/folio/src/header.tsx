import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { FolioShareButton } from "./share";
import type {
  FolioConfig,
  FolioDoc,
  FolioNavigationItem,
} from "./types";

export type FolioHeaderProps = {
  config: FolioConfig;
  navigation?: FolioNavigationItem[];
  currentDoc?: FolioDoc;
  searchEnabled?: boolean;
  themeEnabled?: boolean;
  shareEnabled?: boolean;
  darkMode?: boolean;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  actions?: ReactNode;
};

function routeHref(path: string): string {
  return path === "/" ? "/" : path.replace(/\/$/, "");
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

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.05-.02-1.9-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.95a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.35 4.79-4.58 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

export function FolioHeader({
  config,
  navigation = config.navigation ?? [],
  currentDoc,
  searchEnabled = true,
  themeEnabled = true,
  shareEnabled = true,
  darkMode = false,
  onSearch,
  onToggleTheme,
  actions,
}: FolioHeaderProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const openSearch = () => {
    setMobileOpen(false);
    onSearch?.();
  };

  const isActive = (item: FolioNavigationItem) => {
    const target = routeHref(item.href);
    return (
      location.pathname === target ||
      (target !== "/" && location.pathname.startsWith(target + "/"))
    );
  };

  return (
    <header className="folio-header">
      <div className="folio-header__wrap">
        <Link to="/" className="folio-brand">
          {config.logo ? <img src={config.logo} alt="" /> : null}
          <span>{config.title}</span>
        </Link>

        <nav className="folio-desktop-nav" aria-label="主导航">
          {navigation.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                to={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="folio-header-actions">
          {shareEnabled && currentDoc ? (
            <div className="folio-mobile-doc-share">
              <FolioShareButton
                title={currentDoc.title}
                text={currentDoc.description}
                className="folio-icon-button folio-mobile-share-button"
                compact
              />
            </div>
          ) : null}

          <button
            type="button"
            className="folio-mobile-menu-button"
            aria-label={mobileOpen ? "关闭导航" : "打开导航"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <MenuIcon open={mobileOpen} />
          </button>

          {themeEnabled && onToggleTheme ? (
            <button
              type="button"
              className="folio-icon-button folio-theme-toggle"
              onClick={onToggleTheme}
              aria-label={darkMode ? "切换到浅色模式" : "切换到暗色模式"}
              title={darkMode ? "浅色模式" : "暗色模式"}
            >
              <ThemeIcon dark={darkMode} />
            </button>
          ) : null}

          {searchEnabled && onSearch ? (
            <button
              type="button"
              className="folio-search-trigger"
              onClick={openSearch}
            >
              <SearchIcon />
              <span>搜索</span>
              <kbd>⌘K</kbd>
            </button>
          ) : null}

          {config.github ? (
            <a
              className="folio-icon-button folio-github-link"
              href={config.github}
              aria-label="GitHub"
              title="GitHub"
            >
              <GithubIcon />
            </a>
          ) : null}

          {actions ? <div className="folio-consumer-header-actions">{actions}</div> : null}
        </div>
      </div>

      {mobileOpen ? (
        <div className="folio-mobile-panel">
          <nav aria-label="移动端主导航">
            {navigation.map((item) => (
              <Link
                key={item.href}
                className={isActive(item) ? "active" : ""}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div>
            {searchEnabled && onSearch ? (
              <button type="button" onClick={openSearch}>搜索</button>
            ) : null}
            {themeEnabled && onToggleTheme ? (
              <button type="button" onClick={onToggleTheme}>
                {darkMode ? "浅色模式" : "暗色模式"}
              </button>
            ) : null}
            {config.github ? (
              <a href={config.github}>GitHub ↗</a>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
