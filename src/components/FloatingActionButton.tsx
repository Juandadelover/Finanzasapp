"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const { openNewTransaction } = useUI();
  const { permissions } = useFinance();
  const { canCreateIncome, canCreateExpense } = permissions;

  function handleSelect(type: "expense" | "income") {
    setOpen(false);
    openNewTransaction(type);
  }

  // Solo en las pantallas de movimientos: en las demás tapaba botones de acción.
  const pathname = usePathname();
  if (!["/", "/movimientos", "/estadisticas"].includes(pathname)) return null;
  if (!canCreateIncome && !canCreateExpense) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex flex-col items-end gap-2">
          {canCreateIncome ? (
          <button
            type="button"
            onClick={() => handleSelect("income")}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] min-h-11 py-2 pl-4 pr-3 text-sm font-medium text-[var(--color-text)] shadow-lg transition hover:bg-[var(--color-surface-3)]"
          >
            Ingreso
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
              <TrendingUp size={16} />
            </span>
          </button>
          ) : null}
          {canCreateExpense ? (
          <button
            type="button"
            onClick={() => handleSelect("expense")}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] min-h-11 py-2 pl-4 pr-3 text-sm font-medium text-[var(--color-text)] shadow-lg transition hover:bg-[var(--color-surface-3)]"
          >
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
        className={cn(
          "gradient-brand flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-brand-fab)] transition-transform motion-reduce:transition-none",
          open && "rotate-45"
        )}
      >
        {open ? <X size={24} /> : <Plus size={26} />}
      </button>
    </div>
  );
}
