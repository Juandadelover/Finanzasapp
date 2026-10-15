"use client";

import { useState } from "react";
import { Archive, Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import type { Account, AccountKind } from "@/types/finance";

export const ACCOUNT_KINDS: { value: AccountKind; label: string; icon: LucideIcon }[] = [
  { value: "bank", label: "Banco", icon: Landmark },
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "wallet", label: "Billetera", icon: Smartphone },
];

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

export function AccountSheet({ editing, onClose }: { editing: Account | null; onClose: () => void }) {
  const { addAccount, updateAccount } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? "bank");
  const [opening, setOpening] = useState(editing?.openingBalance ?? 0);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresa un nombre para la cuenta.");
      return;
    }
    const data = { name: name.trim(), kind, openingBalance: opening };
    if (editing) updateAccount(editing.id, data);
    else addAccount(data);
    onClose();
  }

  async function handleArchive() {
    if (!editing) return;
    const ok = await confirm({
      title: "¿Archivar esta cuenta?",
      description: "Dejará de aparecer, pero sus movimientos se conservan.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (ok) {
      updateAccount(editing.id, { archived: true });
      onClose();
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar cuenta" : "Nueva cuenta"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className={labelClass}>Nombre</span>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Bancolombia, Efectivo..."
            className={inputClass}
          />
        </label>
        <div role="group" aria-label="Tipo">
          <p className={labelClass}>Tipo</p>
          <div className="grid grid-cols-4 gap-2">
            {ACCOUNT_KINDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border py-2 text-xs font-medium transition active:scale-[0.97]",
                  kind === value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
                )}
              >
                <Icon size={18} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={labelClass}>Saldo inicial</span>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(opening)}
            onChange={(e) => setOpening(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 pt-1">
          {editing ? (
            <Button
              variant="danger"
              onClick={handleArchive}
              aria-label="Archivar cuenta"
              className="w-12 shrink-0 px-0"
            >
              <Archive size={18} aria-hidden />
            </Button>
          ) : null}
          <Button type="submit" className="flex-1">
            {editing ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
