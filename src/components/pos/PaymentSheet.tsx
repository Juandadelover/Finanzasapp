"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { cashChange } from "@/lib/pos/totals";
import type { Account, AccountKind } from "@/types/finance";
import type { PaymentMethod, SaleKind } from "@/types/pos";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "card", label: "Tarjeta" },
];

const KIND_BY_METHOD: Record<PaymentMethod, AccountKind[]> = {
  cash: ["cash"],
  transfer: ["bank"],
  nequi: ["wallet"],
  daviplata: ["wallet"],
  card: ["card", "bank"],
};

/** Cuenta sugerida para un medio de pago: efectivo → caja; si no hay una que encaje, la primera. */
function defaultAccountId(method: PaymentMethod, accounts: Account[]): string {
  const kinds = KIND_BY_METHOD[method];
  const byName = accounts.find((a) => a.name.toLowerCase().includes(method));
  const byKind = accounts.find((a) => kinds.includes(a.kind));
  return (byName ?? byKind ?? accounts[0])?.id ?? "";
}

export interface PaymentLineInput {
  method: PaymentMethod;
  accountId: string;
  /** En efectivo es lo recibido (puede pasar del total: la diferencia son las vueltas). */
  amount: number;
}

export interface PaymentSubmit {
  payments: PaymentLineInput[];
  initialPayment: PaymentLineInput | null;
}

interface Row {
  key: number;
  method: PaymentMethod;
  accountId: string;
  amount: number;
}

interface PaymentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  kind: SaleKind;
  total: number;
  accounts: Account[];
  money: (v: number) => string;
  saving: boolean;
  error: string | null;
  onConfirm: (submit: PaymentSubmit) => void;
}

function PaymentForm({ kind, total, accounts, money, saving, error, onConfirm }: Omit<PaymentSheetProps, "isOpen" | "onClose">) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>(() => [
    { key: 0, method: "cash", accountId: defaultAccountId("cash", accounts), amount: kind === "cash" ? total : 0 },
  ]);
  const [withInitial, setWithInitial] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const active = kind === "cash" || withInitial;
  const paid = useMemo(() => rows.map((r) => ({ method: r.method, amount: r.amount })), [rows]);
  const { change, missing } = cashChange(total, paid);
  const received = rows.reduce((s, r) => s + r.amount, 0);
  const nonCash = rows.filter((r) => r.method !== "cash").reduce((s, r) => s + r.amount, 0);
  // Crédito: el abono no puede pasar del total ni dar vueltas.
  const creditOver = kind === "credit" && withInitial && received > total;
  const balance = Math.max(0, total - Math.min(received, total));

  function patch(key: number, p: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
    setLocalError(null);
  }

  function addRow() {
    const method: PaymentMethod = rows.some((r) => r.method === "cash") ? "transfer" : "cash";
    setRows((prev) => [
      ...prev,
      { key: nextKey.current++, method, accountId: defaultAccountId(method, accounts), amount: Math.max(0, total - received) },
    ]);
  }

  function submit() {
    if (saving) return;
    if (kind === "credit" && !withInitial) {
      onConfirm({ payments: [], initialPayment: null });
      return;
    }
    const used = rows.filter((r) => r.amount > 0);
    if (used.length === 0) {
      setLocalError("Escribe cuánto te pagan.");
      return;
    }
    if (used.some((r) => !r.accountId)) {
      setLocalError("Elige la cuenta de cada pago.");
      return;
    }
    if (kind === "cash") {
      if (missing > 0) {
        setLocalError(`Faltan ${money(missing)}.`);
        return;
      }
      if (nonCash > total) {
        setLocalError("Solo el efectivo puede pasar del total.");
        return;
      }
    } else if (creditOver || used.length > 1) {
      setLocalError("El abono es un solo pago y no puede pasar del total.");
      return;
    }
    const list = used.map((r) => ({ method: r.method, accountId: r.accountId, amount: r.amount }));
    onConfirm(kind === "cash" ? { payments: list, initialPayment: null } : { payments: [], initialPayment: list[0] });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const blocked = kind === "cash" ? missing > 0 : withInitial && (creditOver || received <= 0);
  const shownError = localError ?? error;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Total {kind === "credit" ? "a crédito" : "a cobrar"}
        </p>
        <p className="text-3xl font-bold tabular-nums">{money(total)}</p>
      </div>

      {kind === "credit" ? (
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-medium">Recibir un abono ahora</span>
          <input
            type="checkbox"
            role="switch"
            checked={withInitial}
            onChange={(e) => {
              setWithInitial(e.target.checked);
              setLocalError(null);
            }}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
        </label>
      ) : null}

      {active ? (
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={r.key} className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="block flex-1">
                  <span className={labelClass}>Medio de pago</span>
                  <select
                    value={r.method}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod;
                      patch(r.key, { method, accountId: defaultAccountId(method, accounts) });
                    }}
                    className={inputClass}
                  >
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                {rows.length > 1 && kind === "cash" ? (
                  <button
                    type="button"
                    aria-label="Quitar este pago"
                    onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                    className="mt-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                  >
                    <X size={16} aria-hidden />
                  </button>
                ) : null}
              </div>
              <label className="block">
                <span className={labelClass}>Cuenta</span>
                <select value={r.accountId} onChange={(e) => patch(r.key, { accountId: e.target.value })} className={inputClass}>
                  {accounts.length === 0 ? <option value="">No tienes cuentas</option> : null}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>{r.method === "cash" ? "Recibido" : "Valor"}</span>
                <input
                  inputMode="numeric"
                  placeholder="$ 0"
                  value={formatAmountInput(r.amount)}
                  onChange={(e) => patch(r.key, { amount: parseAmountInput(e.target.value) })}
                  onFocus={(e) => e.currentTarget.select()}
                  autoFocus={i === 0}
                  className={`${inputClass} text-lg font-semibold`}
                />
              </label>
              {r.method === "cash" && kind === "cash" ? (
                <button
                  type="button"
                  onClick={() => patch(r.key, { amount: Math.max(0, total - (received - r.amount)) })}
                  className="min-h-11 self-start rounded-xl px-3 text-sm font-medium text-[var(--color-brand-light)] hover:bg-[var(--color-surface-2)]"
                >
                  Valor exacto
                </button>
              ) : null}
            </div>
          ))}
          {kind === "cash" ? (
            <Button variant="secondary" onClick={addRow}>
              <Plus size={16} aria-hidden /> Pagar con otro medio
            </Button>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-1 text-sm">
        {kind === "cash" ? (
          missing > 0 ? (
            <p className="flex justify-between font-semibold text-[var(--color-expense)]">
              <span>Falta</span>
              <span className="tabular-nums">{money(missing)}</span>
            </p>
          ) : (
            <p className="flex justify-between text-base font-bold text-[var(--color-income)]">
              <span>Vueltas</span>
              <span className="tabular-nums">{money(change)}</span>
            </p>
          )
        ) : (
          <p className="flex justify-between font-semibold">
            <span>Saldo que te deben</span>
            <span className="tabular-nums">{money(withInitial ? balance : total)}</span>
          </p>
        )}
      </div>

      {shownError ? (
        <p role="alert" className="text-sm text-[var(--color-expense)]">
          {shownError}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={saving} disabled={blocked}>
        {saving ? (
          "Guardando..."
        ) : (
          <>
            Confirmar venta<span className="hidden lg:inline"> (F2)</span>
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentSheet({ isOpen, onClose, ...rest }: PaymentSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={rest.kind === "credit" ? "Venta a crédito" : "Cobrar"}>
      <PaymentForm {...rest} />
    </BottomSheet>
  );
}
