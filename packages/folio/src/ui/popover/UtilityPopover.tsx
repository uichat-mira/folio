import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type FolioUtilityPopoverProps = {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * A compact disclosure for consumer-owned header utilities.
 * It deliberately uses ordinary focusable links/buttons, not an ARIA menu:
 * the contents can be informational, navigational, or interactive.
 */
export function FolioUtilityPopover({
  label,
  trigger,
  children,
  className,
}: FolioUtilityPopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  return (
    <div
      className={["folio-utility-popover", className].filter(Boolean).join(" ")}
      ref={root}
      onKeyDown={(event) => {
        // Escape dismisses the innermost utility first when it sits inside
        // the mobile navigation disclosure.
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }}
    >
      <button
        type="button"
        className="folio-utility-popover__trigger"
        ref={button}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      <div
        id={id}
        className={"folio-utility-popover__panel" + (open ? " is-open" : "")}
        role="group"
        aria-label={label}
        // A normal link in the disclosure closes it; the browser keeps native
        // navigation and modified-click semantics.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
