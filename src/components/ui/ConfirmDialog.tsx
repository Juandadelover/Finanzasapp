"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * Accessible replacement for window.confirm. <ConfirmProvider> is mounted in AppShell.
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "¿Eliminar cliente?", description: "No se puede deshacer.",
 *                       confirmLabel: "Eliminar", destructive: true })) { ... }
 * Options: title (required), description?, confirmLabel? ("Confirmar"), cancelLabel? ("Cancelar"), destructive?.
 * Resolves true on confirm, false on cancel / Esc / scrim click. Focus is trapped and restored.
 */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback outside the provider so callers never crash.
    return async (o) => (typeof window !== "undefined" ? window.confirm(o.title) : false);
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setState({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      setState((s) => {
        s?.resolve(value);
        return null;
      });
      returnFocus.current?.focus?.();
    },
    []
  );

  useEffect(() => {
    if (!state) return;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    // Focus the safe action (cancel) first.
    focusables()[0]?.focus();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [state, close]);

  const o = state?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {o && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out] motion-reduce:animate-none"
                onClick={() => close(false)}
              />
              <div
                ref={panelRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby={o.description ? "confirm-desc" : undefined}
                className="relative w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl"
              >
                <h2 id="confirm-title" className="text-base font-semibold">
                  {o.title}
                </h2>
                {o.description ? (
                  <p id="confirm-desc" className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                    {o.description}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => close(false)}>
                    {o.cancelLabel ?? "Cancelar"}
                  </Button>
                  <Button
                    variant={o.destructive ? "danger" : "primary"}
                    className={o.destructive ? "border-[var(--color-expense)]" : undefined}
                    onClick={() => close(true)}
                  >
                    {o.confirmLabel ?? "Confirmar"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmContext.Provider>
  );
}
