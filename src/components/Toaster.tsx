"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Success mark: the disc scales in and the tick draws itself (see .check-pop / .check-draw). */
function SuccessCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <circle className="check-pop" cx="10" cy="10" r="9" fill="var(--color-income)" fillOpacity="0.18" style={{ transformOrigin: "center" }} />
      <path
        className="check-draw"
        d="M6 10.5l2.7 2.7L14 7.5"
        stroke="var(--color-income)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      style={{ zIndex: "var(--z-toast)" }}
      icons={{ success: <SuccessCheck /> }}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3.5 text-sm text-[var(--color-text)] shadow-lg",
          title: "text-[var(--color-text)] font-medium",
          description: "text-[var(--color-text-muted)]",
          closeButton:
            "!bg-[var(--color-surface-3)] !border-[var(--color-border)] !text-[var(--color-text-muted)]",
          error: "!border-[var(--color-expense)]/40",
          success: "!border-[var(--color-income)]/40",
        },
      }}
    />
  );
}
