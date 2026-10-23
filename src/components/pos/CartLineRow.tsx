"use client";

import { useState } from "react";
import { AlertTriangle, Minus, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { UNITS, isValidQuantity } from "@/lib/inventory/units";
import { lineTotal, type CartLine } from "@/lib/pos/totals";
import type { Discount } from "@/types/pos";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";

function parseDecimal(value: string): number {
  const t = value.trim();
  return t === "" ? NaN : Number(t.replace(",", "."));
}

/** Descuento en % o en pesos. `null` = sin descuento. Se usa por línea y para el total de la venta. */
export function DiscountField({
  value,
  onChange,
  label,
}: {
  value: Discount | null;
  onChange: (d: Discount | null) => void;
  label: string;
}) {
  const [type, setType] = useState<Discount["type"]>(value?.type ?? "pct");
  const [draft, setDraft] = useState<string | null>(null);
  const current = value && value.type === type ? value.value : 0;
  const shown = draft ?? (current ? (type === "amount" ? formatAmountInput(current) : String(current).replace(".", ",")) : "");

  function commit(raw: string, t: Discount["type"]) {
    const n = t === "amount" ? parseAmountInput(raw) : parseDecimal(raw);
    if (!Number.isFinite(n) || n <= 0) {
      onChange(null);
      return;
    }
    onChange({ type: t, value: t === "pct" ? Math.min(n, 100) : n });
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl<Discount["type"]>
        aria-label={`Tipo de descuento: ${label}`}
        shape="rounded"
        value={type}
        onChange={(t) => {
          setType(t);
          setDraft(null);
          onChange(null);
        }}
        options={[
          { value: "pct", label: <Percent size={15} aria-label="Porcentaje" /> },
          { value: "amount", label: <span aria-label="Valor en pesos">$</span> },
        ]}
      />
      <input
        aria-label={`Descuento: ${label}`}
        inputMode={type === "amount" ? "numeric" : "decimal"}
        placeholder={type === "pct" ? "0 %" : "$ 0"}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value, type);
        }}
        onBlur={() => setDraft(null)}
        className={inputClass}
      />
    </div>
  );
}

interface CartLineRowProps {
  line: CartLine;
  /** Costo promedio; solo se pasa si quien vende puede ver costos. */
  avgCost?: number | null;
  stock?: number | null;
  money: (v: number) => string;
  onQuantity: (quantity: number) => void;
  onDiscount: (d: Discount | null) => void;
  onRemove: () => void;
}

export function CartLineRow({ line, avgCost, stock, money, onQuantity, onDiscount, onRemove }: CartLineRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(!!line.discount);
  const integer = line.unit === "unidad" || line.unit === "caja";
  const step = 1;
  const unitLabel = UNITS.find((u) => u.value === line.unit)?.label.toLowerCase();
  const total = lineTotal(line);
  const invalid = !isValidQuantity(line.unit, line.quantity) || line.quantity <= 0;
  const belowCost = avgCost != null && avgCost > 0 && line.quantity > 0 && total / line.quantity < avgCost;
  const overStock = stock != null && line.quantity > stock;
  const qtyShown = draft ?? String(line.quantity).replace(".", ",");

  function setQty(n: number) {
    onQuantity(Math.max(0, Math.round(n * 1000) / 1000));
  }

  return (
    <li className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{line.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {money(line.unitPrice)}
            {unitLabel ? ` por ${unitLabel}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Descuento de ${line.name}`}
            aria-pressed={showDiscount}
            onClick={() => setShowDiscount((v) => !v)}
            className={`flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] ${
              line.discount ? "text-[var(--color-brand-light)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            <Tag size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Quitar ${line.name}`}
            onClick={onRemove}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Quitar uno de ${line.name}`}
            onClick={() => setQty(line.quantity - step)}
            disabled={line.quantity <= 0}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
          >
            <Minus size={16} aria-hidden />
          </button>
          <input
            aria-label={`Cantidad de ${line.name}`}
            inputMode={integer ? "numeric" : "decimal"}
            value={qtyShown}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = parseDecimal(e.target.value);
              setQty(Number.isFinite(n) ? n : 0);
            }}
            onBlur={() => setDraft(null)}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 text-center text-base font-semibold outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40"
          />
          <button
            type="button"
            aria-label={`Agregar uno de ${line.name}`}
            onClick={() => setQty(line.quantity + step)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>
        <p className="text-base font-bold tabular-nums">{money(total)}</p>
      </div>

      {showDiscount ? (
        <div className="mt-2">
          <DiscountField value={line.discount} onChange={onDiscount} label={line.name} />
        </div>
      ) : null}

      {invalid ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-expense)]">
          {integer ? "Esta unidad se vende en cantidades enteras." : "Revisa la cantidad."}
        </p>
      ) : overStock ? (
        <p className="mt-2 text-xs text-[var(--color-warning)]">Solo hay {String(stock).replace(".", ",")} en stock.</p>
      ) : null}
      {belowCost ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
          <AlertTriangle size={14} aria-hidden /> Está por debajo del costo.
        </p>
      ) : null}
    </li>
  );
}
