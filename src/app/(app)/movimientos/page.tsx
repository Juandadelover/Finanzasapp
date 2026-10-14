"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Receipt, Search, SlidersHorizontal, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { TransactionItem } from "@/components/TransactionItem";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { MovimientosFilterSheet, type DateRange } from "@/components/MovimientosFilterSheet";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { transactionsForMonth } from "@/lib/selectors";
import { formatDayLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Transaction, TransactionType } from "@/types/finance";

type Filter = "all" | TransactionType;

export default function MovimientosPage() {
  const { state, hydrated, selectedYear, selectedMonth, permissions } = useFinance();
  const { openNewTransaction } = useUI();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const baseTransactions = useMemo<Transaction[]>(() => {
    if (!dateRange) return monthTransactions;
    return state.transactions
      .filter((t) => t.date >= dateRange.from && t.date <= dateRange.to)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }, [state.transactions, monthTransactions, dateRange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseTransactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (categoryFilter.size > 0 && !categoryFilter.has(t.categoryId)) return false;
      if (!q) return true;
      const category = state.categories.find((c) => c.id === t.categoryId);
      return (
        t.description.toLowerCase().includes(q) ||
        (category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [baseTransactions, filter, categoryFilter, query, state.categories]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const incomeCount = baseTransactions.filter((t) => t.type === "income").length;
  const expenseCount = baseTransactions.filter((t) => t.type === "expense").length;
  const hasActiveFilters = categoryFilter.size > 0 || dateRange !== null;
  const hasCriteria = hasActiveFilters || filter !== "all" || query.trim() !== "";
  function clearAll() {
    setQuery("");
    setFilter("all");
    setCategoryFilter(new Set());
    setDateRange(null);
  }

  return (
    <>
      <AppHeader />
      <PageHeader
        title="Movimientos"
        subtitle={`${filtered.length} movimiento${filtered.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span
              aria-label={`${incomeCount} ingresos`}
              className="flex items-center gap-1 rounded-full bg-[var(--color-income)]/15 px-2.5 py-1 text-[var(--color-income)]"
            >
              <ArrowUp size={12} aria-hidden /> {incomeCount}
            </span>
            <span
              aria-label={`${expenseCount} gastos`}
              className="flex items-center gap-1 rounded-full bg-[var(--color-expense)]/15 px-2.5 py-1 text-[var(--color-expense)]"
            >
              <ArrowDown size={12} aria-hidden /> {expenseCount}
            </span>
          </div>
        }
      />

      {dateRange ? (
        <div className="mx-4 flex items-center justify-center gap-1 py-1">
          <span className="text-sm font-medium tracking-wide text-[var(--color-brand-light)] uppercase">
            Rango personalizado
          </span>
          <button
            type="button"
            onClick={() => setDateRange(null)}
            aria-label="Quitar rango de fechas"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <MonthSelector />
      )}

      <div className="mx-4 mt-3 flex items-center gap-2">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 focus-within:border-[var(--color-brand)]">
          <Search size={16} aria-hidden className="shrink-0 text-[var(--color-text-faint)]" />
          <input
            type="search"
            aria-label="Buscar movimientos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o categoría"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-faint)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          aria-label={hasActiveFilters ? "Filtros (activos)" : "Filtros"}
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition",
            hasActiveFilters
              ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand-light)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          )}
        >
          <SlidersHorizontal size={17} />
          {hasActiveFilters ? (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)]" />
          ) : null}
        </button>
      </div>

      <div className="mx-4 mt-1 flex gap-2">
        {(
          [
            { key: "all", label: "Todos" },
            { key: "expense", label: "Gastos" },
            { key: "income", label: "Ingresos" },
          ] as { key: Filter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "min-h-11 rounded-full px-4 text-xs font-medium transition",
              filter === key
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 flex flex-col gap-4">
        {!hydrated ? (
          <SkeletonList count={5} />
        ) : groups.length === 0 ? (
          hasCriteria ? (
            <EmptyState
              icon={Search}
              title="No hay movimientos que coincidan"
              description="Prueba con otro término de búsqueda o quita los filtros."
              action={{ label: "Limpiar filtros", onClick: clearAll }}
            />
          ) : (
            <EmptyState
              icon={Receipt}
              title="Aún no hay movimientos en este período"
              description="Cuando registres un gasto o un ingreso aparecerá aquí."
              action={
                permissions.canCreateExpense
                  ? { label: "Registrar un gasto", onClick: () => openNewTransaction("expense") }
                  : undefined
              }
            />
          )
        ) : (
          groups.map(([date, items]) => (
            <div key={date}>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                {formatDayLabel(date)}
              </p>
              <div className="flex flex-col gap-1">
                {items.map((t) => (
                  <TransactionItem
                    key={t.id}
                    transaction={t}
                    category={state.categories.find((c) => c.id === t.categoryId)}
                    currency={state.settings.currency}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {filterSheetOpen ? (
        <MovimientosFilterSheet
          categories={state.categories}
          selectedCategoryIds={categoryFilter}
          dateRange={dateRange}
          onClose={() => setFilterSheetOpen(false)}
          onApply={(categoryIds, range) => {
            setCategoryFilter(categoryIds);
            setDateRange(range);
          }}
        />
      ) : null}
    </>
  );
}
