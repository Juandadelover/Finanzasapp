import { ICONS } from "@/lib/icons";
import { formatAmount, formatDayLabel } from "@/lib/format";
import { MASKED_AMOUNT } from "@/context/PrivacyContext";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { Account, Category, CurrencyCode, Transaction } from "@/types/finance";

interface Options {
  categories: Category[];
  accounts: Account[];
  currency: CurrencyCode;
  hidden: boolean;
  /** Include the Cuenta and Estado columns (full movimientos table). */
  full?: boolean;
}

/** Desktop (lg+) table columns for transactions, shared by Inicio and Movimientos. */
export function transactionColumns({ categories, accounts, currency, hidden, full = true }: Options): DataTableColumn<Transaction>[] {
  const categoryOf = (t: Transaction) => categories.find((c) => c.id === t.categoryId);
  const cols: DataTableColumn<Transaction>[] = [
    { key: "date", header: "Fecha", cell: (t) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDayLabel(t.date)}</span> },
    {
      key: "description",
      header: "Descripción",
      className: "w-full max-w-0",
      cell: (t) => (
        <span className="block truncate font-medium text-[var(--color-text)]">
          {t.description || categoryOf(t)?.name || "Movimiento"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      cell: (t) => {
        const c = categoryOf(t);
        const color = c?.color ?? "var(--color-text-faint)";
        const Icon = ICONS[c?.icon ?? "more-horizontal"];
        return (
          <span className="flex items-center gap-2 whitespace-nowrap text-[var(--color-text-muted)]">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklab, ${color} 13%, transparent)`, color }}
            >
              <Icon size={15} aria-hidden />
            </span>
            {c?.name ?? "Sin categoría"}
          </span>
        );
      },
    },
  ];
  if (full) {
    cols.push(
      {
        key: "account",
        header: "Cuenta",
        cell: (t) => (
          <span className="whitespace-nowrap text-[var(--color-text-muted)]">
            {accounts.find((a) => a.id === t.accountId)?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Estado",
        cell: (t) =>
          t.status === "pending" ? (
            <span className="whitespace-nowrap">
              <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-light)]">
                Pendiente
              </span>
              {t.dueDate ? <span className="ml-1.5 text-xs text-[var(--color-text-faint)]">vence {formatDayLabel(t.dueDate)}</span> : null}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">Pagado</span>
          ),
      },
    );
  }
  cols.push({
    key: "amount",
    header: "Monto",
    align: "right",
    cell: (t) => (
      <span
        className={`whitespace-nowrap font-semibold${t.status === "pending" ? " opacity-60" : ""}`}
        style={{ color: t.type === "expense" ? "var(--color-expense)" : "var(--color-income)" }}
      >
        {hidden ? MASKED_AMOUNT : `${t.type === "expense" ? "-" : "+"}${formatAmount(t.amount, currency)}`}
      </span>
    ),
  });
  return cols;
}
