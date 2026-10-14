"use client";

import { ExpenseIcon, IncomeIcon } from "@/components/icons/money";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";

export function QuickActions() {
  const { openNewTransaction } = useUI();
  const { permissions } = useFinance();
  const { canCreateIncome, canCreateExpense } = permissions;

  if (!canCreateIncome && !canCreateExpense) return null;

  return (
    <div className={cn("mx-4 mt-4 grid gap-3 lg:mx-0 lg:mt-0", canCreateIncome && canCreateExpense ? "grid-cols-2" : "grid-cols-1")}>
      {canCreateExpense ? (
        <button
          type="button"
          onClick={() => openNewTransaction("expense")}
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-5 transition hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
            <ExpenseIcon size={20} />
          </span>
          <span className="text-sm font-semibold">Gasto</span>
          <span className="text-xs text-[var(--color-text-faint)]">Manual</span>
        </button>
      ) : null}
      {canCreateIncome ? (
        <button
          type="button"
          onClick={() => openNewTransaction("income")}
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-5 transition hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
            <IncomeIcon size={20} />
          </span>
          <span className="text-sm font-semibold">Ingreso</span>
          <span className="text-xs text-[var(--color-text-faint)]">Manual</span>
        </button>
      ) : null}
    </div>
  );
}
