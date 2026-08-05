"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { IncomeExpenseBarChart } from "@/components/charts/IncomeExpenseBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { FutureBalanceChart } from "@/components/charts/FutureBalanceChart";
import { useFinance } from "@/context/FinanceContext";
import {
  categoryBreakdown,
  computeTotals,
  lastNMonths,
  projectFutureBalance,
  transactionsForMonth,
} from "@/lib/selectors";
import { formatAmount, monthShortLabel } from "@/lib/format";

export default function EstadisticasPage() {
  const { state, hydrated, selectedYear, selectedMonth } = useFinance();

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);

  const expenseBreakdown = useMemo(
    () => categoryBreakdown(monthTransactions, state.categories, "expense"),
    [monthTransactions, state.categories]
  );

  const sixMonthPoints = useMemo(() => {
    const months = lastNMonths(state.transactions, selectedYear, selectedMonth, 6);
    return months.map(({ year, month }) => {
      const t = transactionsForMonth(state.transactions, year, month);
      const { income, expense } = computeTotals(t);
      return { year, month, label: monthShortLabel(month), income, expense };
    });
  }, [state.transactions, selectedYear, selectedMonth]);

  const trendPoints = useMemo(() => {
    const months = lastNMonths(state.transactions, selectedYear, selectedMonth, 8);
    return months.map(({ year, month }) => {
      const t = transactionsForMonth(state.transactions, year, month);
      const { expense } = computeTotals(t);
      return { label: monthShortLabel(month), expense };
    });
  }, [state.transactions, selectedYear, selectedMonth]);

  const projection = useMemo(() => {
    const allTimeBalance = computeTotals(state.transactions).balance;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const avgDailyNet = totals.balance / daysInMonth;
    return projectFutureBalance(allTimeBalance, avgDailyNet, 90);
  }, [state.transactions, totals.balance, selectedYear, selectedMonth]);

  const projected90d = projection.at(-1)?.balance ?? 0;

  return (
    <>
      <AppHeader />
      <MonthSelector />

      <section className="mx-4 mt-2 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold">Tendencia de Gastos</h2>
        <p className="text-xs text-[var(--color-text-faint)]">Últimos 8 meses</p>
        <div className="mt-2">
          {hydrated ? (
            <TrendLineChart data={trendPoints} currency={state.settings.currency} />
          ) : (
            <div className="h-52 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
          )}
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Balance Futuro</h2>
            <p className="text-xs text-[var(--color-text-faint)]">Proyección a 90 días</p>
          </div>
          <Info size={16} className="text-[var(--color-text-faint)]" />
        </div>
        <div className="mt-2">
          {hydrated ? (
            <FutureBalanceChart data={projection} currency={state.settings.currency} />
          ) : (
            <div className="h-52 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
          <span className="text-[var(--color-text-muted)]">Proyectado en 90d</span>
          <span className="font-semibold text-[var(--color-brand-light)]">
            {formatAmount(projected90d, state.settings.currency)}
          </span>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold">Gastos por Categoría</h2>
        <div className="mt-3">
          {hydrated ? (
            <CategoryPieChart
              data={expenseBreakdown}
              currency={state.settings.currency}
              emptyLabel="No hay gastos en este período"
            />
          ) : (
            <div className="h-56 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
          )}
        </div>
      </section>

      <section className="mx-4 mt-4 mb-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold">Ingresos vs Gastos</h2>
        <p className="text-xs text-[var(--color-text-faint)]">Últimos 6 meses</p>
        <div className="mt-2">
          {hydrated ? (
            <IncomeExpenseBarChart data={sixMonthPoints} currency={state.settings.currency} />
          ) : (
            <div className="h-56 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
          )}
        </div>
        <div className="mt-3 flex items-center justify-center gap-5 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-income)]" /> Ingresos
          </span>
          <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-expense)]" /> Gastos
          </span>
        </div>
      </section>
    </>
  );
}
