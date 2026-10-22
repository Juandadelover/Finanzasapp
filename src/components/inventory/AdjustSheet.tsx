"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useFinance } from "@/context/FinanceContext";
import { adjustStock, inventoryErrorMessage } from "@/lib/inventory/api";
import { UNITS, isValidQuantity } from "@/lib/inventory/units";
import type { Product, StockMovementReason } from "@/types/inventory";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

type Mode = "count" | "out";
type OutReason = Exclude<StockMovementReason, "count">;

const OUT_REASONS: { value: OutReason; label: string }[] = [
  { value: "damage", label: "Daño" },
  { value: "loss", label: "Pérdida" },
  { value: "other", label: "Otro" },
];

function parseQty(value: string): number {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() === "" ? NaN : n;
}

function formatQty(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
}

export function AdjustSheet({
  product,
  open,
  onClose,
  onDone,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { permissions } = useFinance();
  const [mode, setMode] = useState<Mode>("count");
  const [qty, setQty] = useState("");
  const [outReason, setOutReason] = useState<OutReason>("damage");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unitLabel = UNITS.find((u) => u.value === product.unit)?.label.toLowerCase() ?? product.unit;
  const parsed = parseQty(qty);
  const valid = Number.isFinite(parsed) && isValidQuantity(product.unit, parsed);
  const diff = mode === "count" && valid ? parsed - product.stock : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!permissions.canAdjustStock) return;
    if (!valid) {
      setError(`Ingresa una cantidad válida en ${unitLabel}.`);
      return;
    }
    if (mode === "out" && parsed <= 0) {
      setError("La cantidad de salida debe ser mayor a cero.");
      return;
    }
    if (mode === "out" && parsed > product.stock) {
      setError("No hay suficiente stock para esa salida.");
      return;
    }
    const reason: StockMovementReason = mode === "count" ? "count" : outReason;
    if (reason === "other" && !note.trim()) {
      setError("Escribe en la nota el motivo del ajuste.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await adjustStock({
        productId: product.id,
        mode,
        quantity: parsed,
        reason,
        note: note.trim(),
      });
      toast.success(mode === "count" ? "Conteo registrado." : "Salida registrada.");
      setQty("");
      setNote("");
      onDone();
      onClose();
    } catch (err) {
      setError(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Ajustar stock">
      {!permissions.canAdjustStock ? (
        <p className="text-sm text-[var(--color-text-muted)]">No tienes permiso para ajustar el stock.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">{product.name}</span> · Stock actual:{" "}
            {formatQty(product.stock)} {unitLabel}
          </p>
          <SegmentedControl<Mode>
            aria-label="Tipo de ajuste"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "count", label: "Conteo físico" },
              { value: "out", label: "Salida" },
            ]}
          />
          <label className="block">
            <span className={labelClass}>{mode === "count" ? "Cantidad contada" : "Cantidad que sale"}</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={inputClass}
            />
          </label>
          {diff !== null ? (
            <p className="text-sm" aria-live="polite">
              {diff === 0 ? (
                <span className="text-[var(--color-text-muted)]">Sin diferencia. No se registra movimiento.</span>
              ) : (
                <span style={{ color: diff > 0 ? "var(--color-income)" : "var(--color-expense)" }}>
                  Diferencia: {diff > 0 ? "+" : ""}
                  {formatQty(diff)} {unitLabel}
                </span>
              )}
            </p>
          ) : null}
          {mode === "out" ? (
            <div>
              <span className={labelClass}>Motivo</span>
              <SegmentedControl<OutReason>
                aria-label="Motivo de la salida"
                shape="rounded"
                value={outReason}
                onChange={setOutReason}
                options={OUT_REASONS}
              />
            </div>
          ) : null}
          <label className="block">
            <span className={labelClass}>
              {mode === "out" && outReason === "other" ? "Nota (obligatoria)" : "Nota (opcional)"}
            </span>
            <input
              type="text"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-expense)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={saving} disabled={diff === 0}>
            {saving ? "Guardando..." : mode === "count" ? "Guardar conteo" : "Registrar salida"}
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}
