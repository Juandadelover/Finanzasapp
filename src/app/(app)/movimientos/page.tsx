"use client";

import { useMemo, useState } from "react";
import { Search, TriangleAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { TransactionItem } from "@/components/TransactionItem";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { transactionsForMonth } from "@/lib/selectors";
import { formatDayLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TransactionType } from "@/types/finance";

type Filter = "all" | TransactionType;

export default function MovimientosPage() {
  const { state, hydrated, selectedYear, selectedMonth } = useFinance();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const monthTransactions = useMemo(
    () => transactionsForMonth(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTransactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!q) return true;
      const category = state.categories.find((c) => c.id === t.categoryId);
      return (
        t.description.toLowerCase().includes(q) ||
        (category?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [monthTransactions, filter, query, state.categories]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const incomeCount = monthTransactions.filter((t) => t.type === "income").length;
  const expenseCount = monthTransactions.filter((t) => t.type === "expense").length;

  return (
    <>
      <AppHeader />
      <MonthSelector />

      <div className="mx-4 flex items-center justify-between">
        <span className="text-2xl font-bold">
          {filtered.length} movimiento{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[var(--color-income)]/15 px-2.5 py-1 text-[var(--color-income)]">
            ▲ {incomeCount}
          </span>
          <span className="rounded-full bg-[var(--color-expense)]/15 px-2.5 py-1 text-[var(--color-expense)]">
            ▼ {expenseCount}
          </span>
        </div>
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5">
        <Search size={16} className="text-[var(--color-text-faint)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o categoría"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </div>

      <div className="mx-4 mt-3 flex gap-2">
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
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
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
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="No hay movimientos que coincidan"
            description="Prueba con otro término de búsqueda o filtro."
          />
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
    </>
  );
}
