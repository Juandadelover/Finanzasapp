"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { inventoryErrorMessage } from "@/lib/inventory/api";
import { voidSale } from "@/lib/pos/api";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";

export function VoidSaleSheet({
  saleId,
  number,
  open,
  onClose,
  onVoided,
}: {
  saleId: string;
  number: number;
  open: boolean;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Escribe el motivo de la anulación.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await voidSale(saleId, reason.trim());
      toast.success(`Venta #${number} anulada.`);
      setReason("");
      onVoided();
      onClose();
    } catch (err) {
      setError(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={open} onClose={onClose} title={`Anular venta #${number}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Devolvemos los productos al inventario y quitamos los movimientos de esta venta. El número no se reutiliza.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Motivo</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: el cliente devolvió la compra"
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="danger" loading={saving}>
          {saving ? "Anulando..." : "Anular venta"}
        </Button>
      </form>
    </BottomSheet>
  );
}
