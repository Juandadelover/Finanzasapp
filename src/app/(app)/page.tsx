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
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import { pendingTransactions, sumAmount } from "@/lib/cartera";
import { computeTotals, transactionsForMonth } from "@/lib/selectors";

export default function HomePage() {
  const { state, hydrated, selectedYear, selectedMonth } = useFinance();

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);
  const recent = monthTransactions.slice(0, 5);
  const { hidden } = usePrivacy();
  const owed = sumAmount(pendingTransactions(state.transactions, "income"));
  const owe = sumAmount(pendingTransactions(state.transactions, "expense"));
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, state.settings.currency));

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
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        {[
          { label: "Me deben", value: owed, color: "var(--color-income)" },
          { label: "Debo", value: owe, color: "var(--color-expense)" },
        ].map((tile) => (
          <Link
            key={tile.label}
            href="/cartera"
            className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 transition hover:bg-[var(--color-surface-2)]"
          >
            <p className="text-xs text-[var(--color-text-faint)]">{tile.label}</p>
            <p className="truncate text-base font-semibold" style={{ color: tile.color }}>
              {money(tile.value)}
            </p>
          </Link>
        ))}
      </div>
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
