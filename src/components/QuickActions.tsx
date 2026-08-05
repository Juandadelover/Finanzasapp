"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useUI } from "@/context/UIContext";

export function QuickActions() {
  const { openNewTransaction } = useUI();

  return (
    <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => openNewTransaction("expense")}
        className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-5 transition hover:bg-[var(--color-surface-2)] active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
          <TrendingDown size={20} />
        </span>
        <span className="text-sm font-semibold">Gasto</span>
        <span className="text-xs text-[var(--color-text-faint)]">Manual</span>
      </button>
      <button
        type="button"
        onClick={() => openNewTransaction("income")}
        className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-5 transition hover:bg-[var(--color-surface-2)] active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
          <TrendingUp size={20} />
        </span>
        <span className="text-sm font-semibold">Ingreso</span>
        <span className="text-xs text-[var(--color-text-faint)]">Manual</span>
      </button>
    </div>
  );
}
