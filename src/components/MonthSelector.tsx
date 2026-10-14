"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { monthLabel } from "@/lib/format";

export function MonthSelector() {
  const { selectedYear, selectedMonth, goToPreviousMonth, goToNextMonth } = useFinance();

  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:justify-start">
      <button
        type="button"
        onClick={goToPreviousMonth}
        aria-label="Mes anterior"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.95] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <ChevronLeft size={20} />
      </button>
      <span aria-live="polite" className="min-w-32 text-center text-sm font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
        {monthLabel(selectedYear, selectedMonth)}
      </span>
      <button
        type="button"
        onClick={goToNextMonth}
        aria-label="Mes siguiente"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.95] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
