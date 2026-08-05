"use client";

import { useState } from "react";
import { Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const { openNewTransaction } = useUI();

  function handleSelect(type: "expense" | "income") {
    setOpen(false);
    openNewTransaction(type);
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => handleSelect("income")}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-4 pr-3 text-sm font-medium text-[var(--color-text)] shadow-lg transition hover:bg-[var(--color-surface-3)]"
          >
            Ingreso
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
              <TrendingUp size={16} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect("expense")}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-4 pr-3 text-sm font-medium text-[var(--color-text)] shadow-lg transition hover:bg-[var(--color-surface-3)]"
          >
            Gasto
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
              <TrendingDown size={16} />
            </span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Agregar movimiento"}
        className={cn(
          "gradient-brand flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_30px_rgba(18,184,134,0.45)] transition-transform",
          open && "rotate-45"
        )}
      >
        {open ? <X size={24} /> : <Plus size={26} />}
      </button>
    </div>
  );
}
