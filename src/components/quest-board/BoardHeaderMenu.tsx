"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type BoardHeaderMenuProps = {
  children: ReactNode;
};

export function BoardHeaderMenu({ children }: BoardHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="western-btn western-btn-ghost western-btn-sm"
      >
        Menu {open ? "▴" : "▾"}
      </button>

      {open && (
        <div
          role="menu"
          className="board-header-dropdown western-panel absolute right-0 top-full z-[60] mt-1.5 min-w-[12rem] py-1.5"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function BoardHeaderMenuItem({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect?: () => void;
}) {
  return (
    <div role="none" className="px-1.5" onClick={onSelect} onKeyDown={undefined}>
      {children}
    </div>
  );
}

export function boardHeaderMenuLinkClassName() {
  return "western-btn western-btn-ghost w-full justify-start border-0 shadow-none px-3 py-2 text-left normal-case";
}

export function boardHeaderMenuButtonClassName() {
  return "western-btn western-btn-ghost w-full justify-start border-0 shadow-none px-3 py-2 text-left normal-case";
}
