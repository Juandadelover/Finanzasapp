"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ICONS } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/finance";

export interface DateRange {
  from: string;
  to: string;
}

interface MovimientosFilterSheetProps {
  categories: Category[];
  selectedCategoryIds: Set<string>;
  dateRange: DateRange | null;
  onClose: () => void;
  onApply: (categoryIds: Set<string>, dateRange: DateRange | null) => void;
}

export function MovimientosFilterSheet({
  categories,
  selectedCategoryIds,
  dateRange,
  onClose,
  onApply,
}: MovimientosFilterSheetProps) {
  const [pendingCategoryIds, setPendingCategoryIds] = useState(new Set(selectedCategoryIds));
  const [from, setFrom] = useState(dateRange?.from ?? "");
  const [to, setTo] = useState(dateRange?.to ?? "");

  function toggleCategory(id: string) {
    setPendingCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApply() {
    const range = from && to ? { from, to } : null;
    onApply(pendingCategoryIds, range);
    onClose();
  }

  function handleClear() {
    onApply(new Set(), null);
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Filtros">
      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Categorías
          </label>
          <div className="flex flex-col gap-1">
            {categories.map((category) => {
              const Icon = ICONS[category.icon];
              const isSelected = pendingCategoryIds.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--color-surface-2)]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${category.color}22`, color: category.color }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 text-sm font-medium">{category.name}</span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition",
                      isSelected
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                        : "border-[var(--color-border)] text-transparent"
                    )}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Rango de fechas
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] text-[var(--color-text-faint)]">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[11px] text-[var(--color-text-faint)]">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
              />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--color-text-faint)]">
            Un rango personalizado reemplaza al mes seleccionado arriba.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)]"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
          >
            Aplicar
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
