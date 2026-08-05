"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { BalanceCard } from "@/components/BalanceCard";
import { QuickActions } from "@/components/QuickActions";
import { TransactionItem } from "@/components/TransactionItem";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { computeTotals, transactionsForMonth } from "@/lib/selectors";

export default function HomePage() {
  const { state, hydrated, selectedYear, selectedMonth } = useFinance();

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);
  const recent = monthTransactions.slice(0, 5);

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-4 h-44 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <MonthSelector />
      <BalanceCard
        balance={totals.balance}
        income={totals.income}
        expense={totals.expense}
        currency={state.settings.currency}
      />
      <QuickActions />

      <div className="mx-4 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Movimientos recientes</h2>
        <Link
          href="/movimientos"
          className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-brand-light)]"
        >
          Ver historial completo
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="mx-4 mt-2 flex flex-col gap-1">
        {recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Aún no tienes movimientos este mes"
            description="Registra tu primer gasto o ingreso con los botones de arriba."
          />
        ) : (
          recent.map((t) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              category={state.categories.find((c) => c.id === t.categoryId)}
              currency={state.settings.currency}
            />
          ))
        )}
      </div>
    </>
  );
}
