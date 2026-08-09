"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
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
