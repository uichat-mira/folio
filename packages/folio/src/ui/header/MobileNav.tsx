import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ChevronDownIcon } from "../../icons";
import {
  isFolioNavItemActive,
  type FolioResolvedNavItem,
} from "../../core/navigation";

type MobileNavProps = {
  items: FolioResolvedNavItem[];
  pathname: string;
  mobilePanelId: string;
  mobileGroup: string | null;
  setMobileGroup: Dispatch<SetStateAction<string | null>>;
  onEntryClick: () => void;
};

/** Header-internal mobile accordion. Header owns all dismissal and route state. */
export function MobileNav({
  items,
  pathname,
  mobilePanelId,
  mobileGroup,
  setMobileGroup,
  onEntryClick,
}: MobileNavProps) {
  return (
    <nav aria-label="移动端主导航">
      {items.map((item, index) => {
        const active = isFolioNavItemActive(item, pathname);

        if (item.kind === "link") {
          return (
            <Link
              key={item.href + item.label}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              to={item.href}
            >
              {item.label}
            </Link>
          );
        }

        const groupId = `${mobilePanelId}-group-${index}`;
        const groupOpen = mobileGroup === groupId;
        return (
          <div className="folio-mobile-group" key={item.href + item.label}>
            <button
              type="button"
              className={
                "folio-mobile-group__trigger" + (active ? " active" : "")
              }
              aria-expanded={groupOpen}
              aria-controls={groupId}
              onClick={() =>
                setMobileGroup((value) => (value === groupId ? null : groupId))
              }
            >
              <span>{item.label}</span>
              <ChevronDownIcon />
            </button>
            <div
              className={
                "folio-mobile-group__panel" + (groupOpen ? " is-open" : "")
              }
              id={groupId}
            >
              <div className="folio-mobile-group__inner">
                {item.groups.map((group) => (
                  <div
                    className="folio-mobile-group__section"
                    key={group.label ?? "__ungrouped"}
                  >
                    {group.label ? (
                      <span className="folio-mobile-group__label">{group.label}</span>
                    ) : null}
                    {group.entries.map((entry) => (
                      <Link
                        key={entry.href + entry.label}
                        to={entry.href}
                        onClick={onEntryClick}
                      >
                        <span>{entry.label}</span>
                        {entry.description ? <small>{entry.description}</small> : null}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
