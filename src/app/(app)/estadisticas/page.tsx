"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, BarChart3, PiggyBank, Target, TrendingDown, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/StatTile";
import { ChartCard } from "@/components/charts/ChartCard";
import { BudgetSection } from "@/components/charts/BudgetSection";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { IncomeExpenseBarChart } from "@/components/charts/IncomeExpenseBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { FutureBalanceChart } from "@/components/charts/FutureBalanceChart";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import {
  budgetProgress,
  categoryBreakdown,
  computeTotals,
  lastNMonths,
  previousMonth,
  projectFutureBalance,
  transactionsForMonth,
} from "@/lib/selectors";
import { formatAmount, monthShortLabel } from "@/lib/format";

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function EstadisticasPage() {
  const { state, hydrated, selectedYear, selectedMonth } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);

  const previousTotals = useMemo(() => {
    const { year, month } = previousMonth(selectedYear, selectedMonth);
    return computeTotals(transactionsForMonth(state.transactions, year, month));
  }, [state.transactions, selectedYear, selectedMonth]);

  const expenseBreakdown = useMemo(
    () => categoryBreakdown(monthTransactions, state.categories, "expense"),
    [monthTransactions, state.categories]
  );

  const budgetItems = useMemo(
    () => budgetProgress(monthTransactions, state.categories),
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

  const allTimeBalance = useMemo(() => computeTotals(state.transactions).balance, [state.transactions]);

  const projection = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const avgDailyNet = totals.balance / daysInMonth;
    return projectFutureBalance(allTimeBalance, avgDailyNet, 90);
  }, [allTimeBalance, totals.balance, selectedYear, selectedMonth]);

  const projected90d = projection.at(-1)?.balance ?? 0;
  const projectionUp = projected90d >= allTimeBalance;

  return (
    <>
      <AppHeader />
      <PageHeader title="Estadísticas" />
      <MonthSelector />

      <div className="mx-4 flex gap-2.5">
        <StatTile
          label="Ingresos"
          value={hidden ? MASKED_AMOUNT : formatAmount(totals.income, currency)}
          icon={TrendingUp}
          accent="var(--color-income)"
          deltaPct={percentDelta(totals.income, previousTotals.income)}
          goodDirection="up"
        />
        <StatTile
          label="Gastos"
          value={hidden ? MASKED_AMOUNT : formatAmount(totals.expense, currency)}
          icon={TrendingDown}
          accent="var(--color-expense)"
          deltaPct={percentDelta(totals.expense, previousTotals.expense)}
          goodDirection="down"
        />
        <StatTile
          label="Balance"
          value={hidden ? MASKED_AMOUNT : formatAmount(totals.balance, currency)}
          icon={PiggyBank}
          accent="var(--color-brand)"
          deltaPct={percentDelta(totals.balance, previousTotals.balance)}
          goodDirection="up"
        />
      </div>

      <ChartCard icon={Target} accent="var(--color-brand)" title="Presupuestos" subtitle="Este mes">
        {hydrated ? (
          <BudgetSection items={budgetItems} currency={currency} hidden={hidden} />
        ) : (
          <Skeleton className="h-16 rounded-2xl" />
        )}
      </ChartCard>

      <ChartCard icon={BarChart3} accent="var(--color-brand)" title="Gastos por Categoría" subtitle="Este mes">
        {hydrated ? (
          <CategoryPieChart
            data={expenseBreakdown}
            currency={currency}
            emptyLabel="No hay gastos en este período"
            hidden={hidden}
          />
        ) : (
          <Skeleton className="h-56 rounded-2xl" />
        )}
      </ChartCard>

      <ChartCard
        icon={BarChart3}
        accent="var(--color-income)"
        title="Ingresos vs Gastos"
        subtitle="Últimos 6 meses"
        footer={
          <div className="mt-3 flex items-center justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--color-income)]" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-expense)]" /> Gastos
            </span>
          </div>
        }
      >
        {hydrated ? (
          <IncomeExpenseBarChart data={sixMonthPoints} currency={currency} />
        ) : (
          <Skeleton className="h-56 rounded-2xl" />
        )}
      </ChartCard>

      <ChartCard
        icon={TrendingDown}
        accent="var(--color-expense)"
        title="Tendencia de Gastos"
        subtitle="Últimos 8 meses"
      >
        {hydrated ? (
          <TrendLineChart data={trendPoints} currency={currency} />
        ) : (
          <Skeleton className="h-52 rounded-2xl" />
        )}
      </ChartCard>

      <ChartCard
        icon={TrendingUp}
        accent="var(--color-brand)"
        title="Balance Futuro"
        subtitle="Proyección a 90 días"
        footer={
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
            <span className="text-[var(--color-text-muted)]">Proyectado en 90d</span>
            <span className="tabular flex min-w-0 items-center gap-1 font-semibold text-[var(--color-text)]">
              {!hidden ? (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: projectionUp ? "color-mix(in oklab, var(--color-income) 18%, transparent)" : "color-mix(in oklab, var(--color-expense) 18%, transparent)",
                    color: projectionUp ? "var(--color-income)" : "var(--color-expense)",
                  }}
                >
                  {projectionUp ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                </span>
              ) : null}
              {hidden ? MASKED_AMOUNT : formatAmount(projected90d, currency)}
            </span>
          </div>
        }
      >
        {hydrated ? (
          <FutureBalanceChart data={projection} currency={currency} />
        ) : (
          <Skeleton className="h-52 rounded-2xl" />
        )}
      </ChartCard>

      <div className="mb-4" />
    </>
  );
}
