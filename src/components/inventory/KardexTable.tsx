import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList } from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { CurrencyCode } from "@/types/finance";
import type { StockMovement, StockMovementKind, StockMovementReason } from "@/types/inventory";

const KIND_LABEL: Record<StockMovementKind, string> = {
  opening: "Stock inicial",
  receipt: "Entrada",
  adjustment: "Ajuste",
  sale: "Venta",
  sale_void: "Venta anulada",
};
const REASON_LABEL: Record<StockMovementReason, string> = {
  damage: "Daño",
  loss: "Pérdida",
  count: "Conteo físico",
  other: "Otro",
};

const qtyFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
export const formatQty = (n: number) => qtyFormat.format(n);

const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface KardexTableProps {
  movements: StockMovement[];
  showCosts: boolean;
  currency?: CurrencyCode;
  currentUserId?: string | null;
}

export function KardexTable({ movements, showCosts, currency = "COP", currentUserId }: KardexTableProps) {
  const money = (v: number | null) => (v == null ? "—" : formatAmount(v, currency));
  const who = (m: StockMovement) => (m.created_by && m.created_by === currentUserId ? "Tú" : m.created_by ? "Equipo" : "Sistema");
  const detail = (m: StockMovement) => {
    const parts = [m.reason ? REASON_LABEL[m.reason] : null, m.note].filter(Boolean);
    return parts.join(" · ");
  };
  const qty = (m: StockMovement) => `${m.quantity > 0 ? "+" : ""}${formatQty(m.quantity)}`;
  const qtyColor = (m: StockMovement) => (m.quantity < 0 ? "var(--color-expense)" : "var(--color-income)");

  return (
    <DataTable
      caption="Kardex del producto"
      rows={movements}
      getRowKey={(m) => String(m.id)}
      mobileClassName="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5"
      empty={<EmptyState icon={ClipboardList} title="Sin movimientos" description="Aquí verás cada entrada y ajuste de este producto." />}
      columns={[
        { key: "date", header: "Fecha", cell: (m) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{dateFormat.format(new Date(m.created_at))}</span> },
        {
          key: "kind",
          header: "Tipo",
          cell: (m) =>
            m.receipt_id ? (
              <Link href={`/inventario/entradas/${m.receipt_id}`} className="whitespace-nowrap text-[var(--color-brand-light)]">
                {KIND_LABEL[m.kind]}
              </Link>
            ) : (
              <span className="whitespace-nowrap">{KIND_LABEL[m.kind]}</span>
            ),
        },
        { key: "qty", header: "Cantidad", align: "right", cell: (m) => <span className="font-semibold" style={{ color: qtyColor(m) }}>{qty(m)}</span> },
        { key: "after", header: "Stock después", align: "right", cell: (m) => formatQty(m.stock_after) },
        ...(showCosts ? [{ key: "cost", header: "Costo", align: "right" as const, cell: (m: StockMovement) => money(m.unit_cost) }] : []),
        { key: "user", header: "Usuario", cell: (m) => <span className="text-[var(--color-text-muted)]">{who(m)}</span> },
        { key: "detail", header: "Motivo", className: "w-full max-w-0", cell: (m) => <span className="block truncate text-[var(--color-text-muted)]">{detail(m) || "—"}</span> },
      ]}
      renderMobile={(m) => (
        <div className="rounded-2xl px-2 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            {m.receipt_id ? (
              <Link href={`/inventario/entradas/${m.receipt_id}`} className="text-sm font-medium text-[var(--color-brand-light)]">
                {KIND_LABEL[m.kind]}
              </Link>
            ) : (
              <span className="text-sm font-medium">{KIND_LABEL[m.kind]}</span>
            )}
            <span className="text-sm font-semibold tabular-nums" style={{ color: qtyColor(m) }}>{qty(m)}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {dateFormat.format(new Date(m.created_at))} · {who(m)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Stock después: {formatQty(m.stock_after)}
            {showCosts && m.unit_cost != null ? ` · Costo ${money(m.unit_cost)}` : ""}
          </p>
          {detail(m) ? <p className="text-xs text-[var(--color-text-muted)]">{detail(m)}</p> : null}
        </div>
      )}
    />
  );
}
