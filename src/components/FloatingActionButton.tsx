"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { SPRINGS, createSpring, haptic, type Spring } from "@/components/ui/motion";

const ITEM_CLASS =
  "spring-pop flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] min-h-11 py-2 pl-4 pr-3 text-sm font-medium text-[var(--color-text)] shadow-lg transition-colors hover:bg-[var(--color-surface-3)] active:scale-[0.97] active:bg-[var(--color-surface-3)]";

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  // Menu stays mounted while the spring runs back to 0 so exit mirrors entry.
  const [visible, setVisible] = useState(false);
  const { openNewTransaction } = useUI();
  const { permissions } = useFinance();
  const { canCreateIncome, canCreateExpense } = permissions;
  const rootRef = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring | null>(null);

  if (open && !visible) setVisible(true);

  // One spring (0 closed, 1 open) drives the menu items and the plus/close glyph via --p.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!spring.current) {
      spring.current = createSpring(0, (v) => el.style.setProperty("--p", v.toFixed(4)), {
        restDelta: 0.002,
        restSpeed: 0.02,
      });
    }
    if (open || visible) {
      spring.current.to(open ? 1 : 0, SPRINGS.ui, {
        onDone: open ? undefined : () => setVisible(false),
      });
    }
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  function handleSelect(type: "expense" | "income") {
    haptic(8);
    setOpen(false);
    openNewTransaction(type);
  }

  // Solo en las pantallas de movimientos: en las demás tapaba botones de acción.
  const pathname = usePathname();
  if (!["/", "/movimientos", "/estadisticas"].includes(pathname)) return null;
  if (!canCreateIncome && !canCreateExpense) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-40 flex flex-col items-end gap-3"
    >
      {visible ? (
        <div className={`flex flex-col items-end gap-2 ${open ? "" : "pointer-events-none"}`}>
          {canCreateIncome ? (
            <button type="button" onClick={() => handleSelect("income")} className={ITEM_CLASS}>
              Ingreso
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
                <TrendingUp size={16} />
              </span>
            </button>
          ) : null}
          {canCreateExpense ? (
            <button type="button" onClick={() => handleSelect("expense")} className={ITEM_CLASS}>
              Gasto
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
                <TrendingDown size={16} />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Agregar movimiento"}
        aria-expanded={open}
        className="gradient-brand relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-brand-fab)] transition-transform duration-100 active:scale-[0.94]"
      >
        <span
          className="fab-glyph absolute"
          style={{
            opacity: "calc(1 - var(--p, 0))",
            transform: "rotate(calc(var(--p, 0) * 90deg))",
          }}
        >
          <Plus size={26} />
        </span>
        <span
          className="fab-glyph absolute"
          style={{
            opacity: "var(--p, 0)",
            transform: "rotate(calc((var(--p, 0) - 1) * 90deg))",
          }}
        >
          <X size={24} />
        </span>
      </button>
    </div>
  );
}
