"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BarChart3, ChevronRight, Receipt } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { BalanceCard } from "@/components/BalanceCard";
import { QuickActions } from "@/components/QuickActions";
import { TransactionItem } from "@/components/TransactionItem";
import { EmptyState } from "@/components/EmptyState";
import { GettingStarted } from "@/components/GettingStarted";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable } from "@/components/ui/DataTable";
import { PageContainer } from "@/components/ui/PageContainer";
import { ResponsiveGrid } from "@/components/ui/ResponsiveGrid";
import { ChartCard } from "@/components/charts/ChartCard";
import { IncomeExpenseBarChart } from "@/components/charts/IncomeExpenseBarChart";
import { transactionColumns } from "@/components/transactionColumns";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import { pendingTransactions, sumAmount } from "@/lib/cartera";
import { accountBalances, computeTotals, lastNMonths, transactionsForMonth } from "@/lib/selectors";
import { monthShortLabel } from "@/lib/format";

export default function HomePage() {
  const { state, hydrated, selectedYear, selectedMonth, permissions } = useFinance();
  const { openNewTransaction, openEditTransaction } = useUI();

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions]);
  const accountsTotal = useMemo(() => {
    const balances = accountBalances(state);
    return balances.length ? balances.reduce((sum, b) => sum + b.balance, 0) : null;
  }, [state]);
  // "Solo registro" solo ve sus propios gastos: un total calculado con ellos engañaría.
  const isRecorder = !permissions.canEditTransactions && permissions.canCreateExpense;
  const recent = monthTransactions.slice(0, 5);
  const { hidden } = usePrivacy();
  const owed = sumAmount(pendingTransactions(state.transactions, "income"));
  const owe = sumAmount(pendingTransactions(state.transactions, "expense"));
  const sixMonthPoints = useMemo(
    () =>
      lastNMonths(state.transactions, selectedYear, selectedMonth, 6).map(({ year, month }) => {
        const { income, expense } = computeTotals(transactionsForMonth(state.transactions, year, month));
        return { year, month, label: monthShortLabel(month), income, expense };
      }),
    [state.transactions, selectedYear, selectedMonth]
  );
  const columns = useMemo(
    () => transactionColumns({ categories: state.categories, accounts: state.accounts, currency: state.settings.currency, hidden, full: false }),
    [state.categories, state.accounts, state.settings.currency, hidden]
  );
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, state.settings.currency));

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div role="status" className="mx-4 mt-4 flex flex-col gap-3 lg:mx-0">
          <span className="sr-only">Cargando…</span>
          <Skeleton className="h-56 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <h1 className="sr-only">Inicio</h1>
      <PageContainer>
      <MonthSelector />
      <ResponsiveGrid variant="split" className="gap-0 lg:items-start lg:gap-5">
      {isRecorder ? (
        <p className="mx-4 mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)] lg:col-span-full lg:mx-0 lg:mt-0">
          Registra aquí los gastos del negocio. Verás solo los que tú anotes.
        </p>
      ) : (
      <>
      <div className="lg:col-start-1">
      <BalanceCard
        accountsTotal={accountsTotal}
        monthResult={totals.balance}
        income={totals.income}
        expense={totals.expense}
        currency={state.settings.currency}
      />
      </div>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3 lg:mx-0 lg:mt-0 lg:col-start-1">
        {[
          { label: "Me deben", value: owed, color: "var(--color-income)" },
          { label: "Debo", value: owe, color: "var(--color-expense)" },
        ].map((tile) => (
          <Link
            key={tile.label}
            href="/cartera"
            className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 transition active:scale-[0.98] hover:bg-[var(--color-surface-2)]"
          >
            <p className="text-xs text-[var(--color-text-faint)]">{tile.label}</p>
            <p title={money(tile.value)} className="tabular truncate text-base font-semibold" style={{ color: tile.color }}>
              {money(tile.value)}
            </p>
          </Link>
        ))}
      </div>
      {/* Solo escritorio: tendencia de 6 meses (móvil la tiene en Estadísticas) */}
      <div className="hidden lg:col-start-1 lg:block">
        <ChartCard icon={BarChart3} accent="var(--color-income)" title="Ingresos vs gastos" subtitle="Últimos 6 meses">
          <IncomeExpenseBarChart data={sixMonthPoints} currency={state.settings.currency} />
        </ChartCard>
      </div>
      </>
      )}
      <div className={cn("lg:col-start-2", !isRecorder && "lg:row-span-2 lg:row-start-1")}>
        <QuickActions />
      </div>
      <div className="empty:hidden lg:col-start-2">
        <GettingStarted />
      </div>

      <div className="lg:col-start-1">
      <div className="mx-4 mt-6 flex items-center justify-between lg:mx-0 lg:mt-0">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Movimientos recientes</h2>
        <Link
          href="/movimientos"
          className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-xs font-medium text-[var(--color-brand-light)]"
        >
          Ver historial completo
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="mx-4 mt-2 lg:mx-0">
        <DataTable
          caption="Movimientos recientes"
          rows={recent}
          columns={columns}
          getRowKey={(t) => t.id}
          onRowClick={permissions.canEditTransactions ? openEditTransaction : undefined}
          mobileClassName="flex flex-col gap-1"
          renderMobile={(t) => (
            <TransactionItem
              transaction={t}
              category={state.categories.find((c) => c.id === t.categoryId)}
              currency={state.settings.currency}
            />
          )}
          empty={
            <EmptyState
              icon={Receipt}
              title="Aún no tienes movimientos este mes"
              description="Registra tu primer gasto o ingreso con los botones de arriba."
              action={
                permissions.canCreateExpense
                  ? { label: "Registrar un gasto", onClick: () => openNewTransaction("expense") }
                  : undefined
              }
            />
          }
        />
      </div>
      </div>
      </ResponsiveGrid>
      </PageContainer>
    </>
  );
}
