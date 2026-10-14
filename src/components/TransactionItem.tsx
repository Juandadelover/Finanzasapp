"use client";

import { ICONS } from "@/lib/icons";
import { formatAmount, formatDayLabel } from "@/lib/format";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import type { Category, CurrencyCode, Transaction } from "@/types/finance";

interface TransactionItemProps {
  transaction: Transaction;
  category: Category | undefined;
  currency: CurrencyCode;
}

export function TransactionItem({ transaction, category, currency }: TransactionItemProps) {
  const { openEditTransaction } = useUI();
  const { hidden } = usePrivacy();
  const { permissions } = useFinance();
  const color = category?.color ?? "var(--color-text-faint)";
  const isExpense = transaction.type === "expense";
  const isPending = transaction.status === "pending";

  const content = (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 13%, transparent)`, color }}
      >
        {(() => {
          const Icon = ICONS[category?.icon ?? "more-horizontal"];
          return <Icon size={19} />;
        })()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--color-text)]">
          {transaction.description || category?.name || "Movimiento"}
        </span>
        <span className="block truncate text-xs text-[var(--color-text-faint)]">
          {category?.name ?? "Sin categoría"} · {formatDayLabel(transaction.date)}
          {isPending ? (
            <>
              {" "}
              <span className="rounded-full bg-[var(--color-brand)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--color-brand-light)]">
                Pendiente
              </span>
              {transaction.dueDate ? ` · vence ${formatDayLabel(transaction.dueDate)}` : ""}
            </>
          ) : null}
        </span>
      </span>
      <span
        className={`tabular max-w-[45%] shrink-0 truncate text-sm font-semibold${isPending ? " opacity-60" : ""}`}
        style={{ color: isExpense ? "var(--color-expense)" : "var(--color-income)" }}
      >
        {hidden ? MASKED_AMOUNT : `${isExpense ? "-" : "+"}${formatAmount(transaction.amount, currency)}`}
      </span>
    </>
  );

  if (!permissions.canEditTransactions) {
    return <div className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => openEditTransaction(transaction)}
      className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition duration-150 hover:bg-[var(--color-surface-2)] active:scale-[0.98] active:bg-[var(--color-surface-2)] active:duration-75"
    >
      {content}
    </button>
  );
}
