import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { FolioShareButton } from "../../share";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { GithubIcon, MenuIcon, SearchIcon, ThemeIcon } from "../../icons";
import { resolveFolioNavigation } from "../../core/navigation";
import type {
  FolioConfig,
  FolioDoc,
  FolioNavigationItem,
} from "../../types";

export type FolioHeaderProps = {
  config: FolioConfig;
  navigation?: FolioNavigationItem[];
  /**
   * Content used to resolve `navigation[].collection` shorthand to its first
   * document. Without docs the collection entry falls back to its index route.
   */
  docs?: readonly FolioDoc[];
  currentDoc?: FolioDoc;
  searchEnabled?: boolean;
  themeEnabled?: boolean;
  shareEnabled?: boolean;
  darkMode?: boolean;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  brand?: ReactNode;
  actions?: ReactNode;
};

// A short close delay keeps a diagonal pointer path from the trigger into the
// panel from flashing the menu shut. The panel also covers the gap with a
// transparent bridge in CSS, so this is a safety net, not the only guard.
const MENU_CLOSE_DELAY = 140;

export function FolioHeader({
  config,
  navigation = config.navigation ?? [],
  docs,
  currentDoc,
  searchEnabled = true,
  themeEnabled = true,
  shareEnabled = true,
  darkMode = false,
  onSearch,
  onToggleTheme,
  brand,
  actions,
}: FolioHeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const idBase = useId();

  const items = useMemo(
    () => resolveFolioNavigation(navigation, docs),
    [navigation, docs],
  );

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current === undefined) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);

  const closeMenu = useCallback(() => {
    cancelScheduledClose();
    setOpenMenu(null);
  }, [cancelScheduledClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  // Escape and outside-pointer dismissal are owned by the header itself rather
  // than a backdrop, so the panel never traps clicks meant for the page.
  useEffect(() => {
    if (openMenu === null && !mobileOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      // The mobile panel is a sibling of the nav cluster (it is fixed to the
      // viewport, not nested in the header rail), so both containers have to
      // count as "inside" or the first tap in the panel closes it.
      const target = event.target as Node;
      if (navRef.current?.contains(target)) return;
      if (mobilePanelRef.current?.contains(target)) return;
      cancelScheduledClose();
      setOpenMenu(null);
      setMobileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelScheduledClose();
      setOpenMenu(null);
      setMobileOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu, mobileOpen, cancelScheduledClose]);

  // A route change means the reader navigated: any open surface is stale.
  useEffect(() => {
    cancelScheduledClose();
    setMobileOpen(false);
    setOpenMenu(null);
    setMobileGroup(null);
  }, [location.pathname, cancelScheduledClose]);

  const openSearch = () => {
    setMobileOpen(false);
    setOpenMenu(null);
    onSearch?.();
  };

  const panelId = (label: string) =>
    `${idBase}-menu-${label.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  const mobilePanelId = `${idBase}-mobile`;

  return (
    <header className={"folio-header" + (isHome ? "" : " folio-header--interior")}>
      <div className="folio-header__wrap">
        <Link to="/" className="folio-brand">
          {brand ?? <>{config.logo ? <img src={config.logo} alt="" /> : null}<span>{config.title}</span></>}
        </Link>

        {/* Navigation and utility actions are one right-hand cluster. The nav
            is the only element that gets `margin-left: auto`, so the brand
            stays left and everything else forms a continuous right rail. */}
        <div
          className={"folio-header__nav" + (openMenu !== null ? " is-mega-open" : "")}
          ref={navRef as RefObject<HTMLDivElement>}
          onPointerLeave={(event) => {
            // The panel can be narrower than its trigger's horizontal position.
            // Keep the menu open across the shared nav-to-panel hover bridge,
            // rather than closing when the cursor leaves the trigger itself.
            if (event.pointerType !== "mouse" || openMenu === null) return;
            cancelScheduledClose();
            closeTimer.current = window.setTimeout(() => {
              closeTimer.current = undefined;
              setOpenMenu(null);
            }, MENU_CLOSE_DELAY);
          }}
        >
          <DesktopNav
            items={items}
            pathname={location.pathname}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            panelId={panelId}
            cancelScheduledClose={cancelScheduledClose}
            closeMenu={closeMenu}
          />

          <div className="folio-header-actions">
            {actions ? <div className="folio-consumer-header-actions">{actions}</div> : null}

            <button
              type="button"
              className="folio-mobile-menu-button"
              aria-label={mobileOpen ? "关闭导航" : "打开导航"}
              aria-expanded={mobileOpen}
              aria-controls={mobilePanelId}
              onClick={() => {
                setMobileOpen((value) => !value);
                setOpenMenu(null);
              }}
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
          </div>
        </div>
      </div>

      {/* The mobile panel stays mounted so it can animate in and out; the
          closed state is `visibility: hidden`, which also removes it from the
          tab order without unmounting the disclosure state. */}
      <div
        className={"folio-mobile-panel" + (mobileOpen ? " is-open" : "")}
        id={mobilePanelId}
        ref={mobilePanelRef}
      >
        <MobileNav
          items={items}
          pathname={location.pathname}
          mobilePanelId={mobilePanelId}
          mobileGroup={mobileGroup}
          setMobileGroup={setMobileGroup}
          onEntryClick={() => {
            setMobileOpen(false);
            setMobileGroup(null);
          }}
        />
        {actions ? <div className="folio-mobile-panel__custom-actions">{actions}</div> : null}
        <div className="folio-mobile-panel__actions" aria-label="页面工具">
          {searchEnabled && onSearch ? (
            <button type="button" onClick={openSearch} aria-label="搜索" title="搜索">
              <SearchIcon />
            </button>
          ) : null}
          {themeEnabled && onToggleTheme ? (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={darkMode ? "切换到浅色模式" : "切换到暗色模式"}
              title={darkMode ? "浅色模式" : "暗色模式"}
            >
              <ThemeIcon dark={darkMode} />
            </button>
          ) : null}
          {shareEnabled ? (
            <FolioShareButton
              title={currentDoc?.title ?? config.title}
              text={currentDoc?.description ?? config.description}
              className="folio-mobile-tool-share"
              compact
            />
          ) : null}
          {config.github ? (
            <a href={config.github} aria-label="GitHub" title="GitHub">
              <GithubIcon />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
