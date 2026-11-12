import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type ThemeOption<T extends string> = { value: T; name: string };

type ThemeSelectProps<T extends string> = {
  id: string;
  label: string;
  hint: string;
  value: T;
  options: readonly ThemeOption<T>[];
  onChange: (value: T) => void;
};

/**
 * Site-only theme selector: a semantic combobox controlling one listbox.
 * Focus stays on the trigger, so arrow-key navigation and screen readers
 * refer to the active option via aria-activedescendant.
 */
export function ThemeSelect<T extends string>({
  id, label, hint, value, options, onChange,
}: ThemeSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options[currentIndex];
  const labelId = id + "-label";
  const valueId = id + "-value";
  const listId = id + "-listbox";

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function show() {
    setActive(currentIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setActive(currentIndex);
          setOpen(true);
        } else {
          setActive((previous) => (previous + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        }
        return;
      case "Home":
      case "End":
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        setOpen(true);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else show();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
    }
  }

  return (
    <div className="portal-explorer__control" data-open={open ? "true" : undefined} ref={rootRef}>
      <span className="portal-explorer__control-label" id={labelId}>
        {label} <small>{hint}</small>
      </span>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="portal-explorer__select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? listId + "-option-" + active : undefined}
        aria-labelledby={labelId + " " + valueId}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={onKeyboard}
      >
        <span id={valueId} className="portal-explorer__select-value">{current?.name}</span>
        <svg className="portal-explorer__select-chevron" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-labelledby={labelId} className="portal-explorer__select-menu">
          {options.map((option, index) => (
            <li
              id={listId + "-option-" + index}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active ? "true" : undefined}
              className="portal-explorer__select-option"
              onPointerEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.name}</span>
              {option.value === value && (
                <svg width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6"/>
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
