"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  ChevronRight,
  CreditCard,
  Landmark,
  Plus,
  Smartphone,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatAmountInput, formatDayLabel, parseAmountInput, toISODate } from "@/lib/format";
import { accountBalances } from "@/lib/selectors";
import type { Account, AccountKind } from "@/types/finance";

const KINDS: { value: AccountKind; label: string; icon: LucideIcon }[] = [
  { value: "bank", label: "Banco", icon: Landmark },
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "wallet", label: "Billetera", icon: Smartphone },
];

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

function AccountSheet({ editing, onClose }: { editing: Account | null; onClose: () => void }) {
  const { addAccount, updateAccount } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? "bank");
  const [opening, setOpening] = useState(editing?.openingBalance ?? 0);
  const [error, setError] = useState<string | null>(null);

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

  function handleArchive() {
    if (!editing) return;
    if (window.confirm("¿Archivar esta cuenta? Dejará de aparecer, pero sus movimientos se conservan.")) {
      updateAccount(editing.id, { archived: true });
      onClose();
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar cuenta" : "Nueva cuenta"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Bancolombia, Efectivo..."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <div className="grid grid-cols-4 gap-2">
            {KINDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition",
                  kind === value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Saldo inicial</label>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(opening)}
            onChange={(e) => setOpening(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </div>
        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        <div className="flex gap-3 pt-1">
          {editing ? (
            <button
              type="button"
              onClick={handleArchive}
              aria-label="Archivar cuenta"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <button
            type="submit"
            className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
          >
            {editing ? "Guardar cambios" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function TransferSheet({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const { addTransfer } = useFinance();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toISODate(new Date()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId) {
      setError("Elige dos cuentas distintas.");
      return;
    }
    if (amount <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    addTransfer({
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      date,
      description: description.trim(),
    });
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Transferir entre cuentas">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Desde</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Hacia</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Monto</label>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(amount)}
            onChange={(e) => setAmount(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </div>
        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        <button
          type="submit"
          className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
        >
          Transferir
        </button>
      </form>
    </BottomSheet>
  );
}

export default function CuentasPage() {
  const { state, hydrated, permissions, deleteTransfer } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const [accountSheet, setAccountSheet] = useState<{ open: boolean; editing: Account | null }>({
    open: false,
    editing: null,
  });
  const [transferOpen, setTransferOpen] = useState(false);

  const balances = useMemo(
    () => accountBalances(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.accounts, state.transactions, state.transfers]
  );
  const total = balances.reduce((sum, b) => sum + b.balance, 0);
  const canManage = permissions.canEditTransactions;
  const activeAccounts = balances.map((b) => b.account);
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? "Cuenta";
  const recentTransfers = state.transfers.slice(0, 10);

  const money = (value: number) => (hidden ? MASKED_AMOUNT : formatAmount(value, currency));

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  return (
    <>
      <AppHeader />

      <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
        <span className="text-sm font-medium text-white/80">Saldo total</span>
        <p className="mt-2 text-4xl font-bold tracking-tight">{money(total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {balances.length} cuenta{balances.length === 1 ? "" : "s"} · solo movimientos pagados
        </p>
      </div>

      {canManage ? (
        <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountSheet({ open: true, editing: null })}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 text-sm font-semibold transition hover:bg-[var(--color-surface-2)] active:scale-[0.98]"
          >
            <Plus size={17} className="text-[var(--color-brand-light)]" />
            Agregar cuenta
          </button>
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            disabled={activeAccounts.length < 2}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 text-sm font-semibold transition hover:bg-[var(--color-surface-2)] active:scale-[0.98] disabled:opacity-50"
          >
            <ArrowLeftRight size={17} className="text-[var(--color-brand-light)]" />
            Transferir
          </button>
        </div>
      ) : null}

      <section className="mx-4 mt-5">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          Cuentas
        </h2>
        {balances.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Aún no tienes cuentas"
            description="Agrega tu banco, efectivo o billetera para saber cuánto tienes en cada uno."
          />
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
            {balances.map(({ account, balance }) => {
              const Icon = KINDS.find((k) => k.value === account.kind)?.icon ?? Landmark;
              const content = (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{account.name}</span>
                    <span className="block text-xs text-[var(--color-text-faint)]">
                      {KINDS.find((k) => k.value === account.kind)?.label}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-sm font-semibold"
                    style={{ color: balance < 0 ? "var(--color-expense)" : undefined }}
                  >
                    {money(balance)}
                  </span>
                  {canManage ? <ChevronRight size={16} className="text-[var(--color-text-faint)]" /> : null}
                </>
              );
              return canManage ? (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountSheet({ open: true, editing: account })}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
                >
                  {content}
                </button>
              ) : (
                <div key={account.id} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recentTransfers.length > 0 ? (
        <section className="mx-4 mt-5 mb-4">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
            Transferencias recientes
          </h2>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
            {recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  <ArrowLeftRight size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {accountName(t.fromAccountId)} → {accountName(t.toAccountId)}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-text-faint)]">
                    {formatDayLabel(t.date)}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{money(t.amount)}</span>
                {canManage ? (
                  <button
                    type="button"
                    aria-label="Eliminar transferencia"
                    onClick={() => {
                      if (window.confirm("¿Eliminar esta transferencia?")) deleteTransfer(t.id);
                    }}
                    className="rounded-full p-1.5 text-[var(--color-text-faint)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {accountSheet.open ? (
        <AccountSheet
          key={accountSheet.editing?.id ?? "new"}
          editing={accountSheet.editing}
          onClose={() => setAccountSheet({ open: false, editing: null })}
        />
      ) : null}
      {transferOpen ? <TransferSheet accounts={activeAccounts} onClose={() => setTransferOpen(false)} /> : null}
    </>
  );
}
