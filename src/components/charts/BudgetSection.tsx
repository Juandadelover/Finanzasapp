import { getIcon } from "@/lib/icons";
import { formatAmount } from "@/lib/format";
import { MASKED_AMOUNT } from "@/context/PrivacyContext";
import type { BudgetProgressItem } from "@/lib/selectors";
import type { CurrencyCode } from "@/types/finance";

interface BudgetSectionProps {
  items: BudgetProgressItem[];
  currency: CurrencyCode;
  hidden: boolean;
}

function severityColor(ratio: number): string {
  if (ratio >= 1) return "var(--color-expense)";
  if (ratio >= 0.8) return "var(--color-warning)";
  return "var(--color-brand)";
}

export function BudgetSection({ items, currency, hidden }: BudgetSectionProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-faint)]">
        Fija un presupuesto mensual en alguna categoría de gasto (desde Ajustes) para verlo aquí.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map(({ category, spent, budget }) => {
        const Icon = getIcon(category.icon);
        const ratio = budget > 0 ? spent / budget : 0;
        const barWidth = Math.min(100, Math.round(ratio * 100));
        const color = severityColor(ratio);
        return (
          <div key={category.id}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${category.color}22`, color: category.color }}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{category.name}</span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {hidden
                      ? MASKED_AMOUNT
                      : `${formatAmount(spent, currency)} / ${formatAmount(budget, currency)}`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <span className="w-11 shrink-0 text-right text-xs font-medium" style={{ color }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
