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
  Archive,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
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
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

function AccountSheet({ editing, onClose }: { editing: Account | null; onClose: () => void }) {
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
            {KINDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border py-2 text-xs font-medium transition",
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
          <label className="block">
            <span className={labelClass}>Desde</span>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Hacia</span>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Monto</span>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(amount)}
            onChange={(e) => setAmount(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Descripción</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <Button type="submit">Transferir</Button>
      </form>
    </BottomSheet>
  );
}

export default function CuentasPage() {
  const { state, hydrated, permissions, deleteTransfer } = useFinance();
  const confirm = useConfirm();
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
    [state.accounts, state.transactions, state.transfers],
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
        <PageHeader title="Cuentas" />
        <Skeleton className="mx-4 mt-4 h-32 rounded-3xl" />
        <SkeletonList count={3} className="mx-4 mt-5" />
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <PageHeader title="Cuentas" subtitle="Cuánta plata tienes en cada lugar." />

      <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
        <span className="text-sm font-medium text-white/80">Saldo total</span>
        <p className="mt-2 truncate text-4xl font-bold tracking-tight tabular-nums">{money(total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {balances.length} {balances.length === 1 ? "cuenta" : "cuentas"} · solo cuenta lo que ya está pagado
        </p>
      </div>

      {canManage ? (
        <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() => setAccountSheet({ open: true, editing: null })}
            className="rounded-2xl bg-[var(--color-surface)] py-3.5"
          >
            <Plus size={17} className="text-[var(--color-brand-light)]" aria-hidden />
            Agregar cuenta
          </Button>
          <Button
            variant="secondary"
            onClick={() => setTransferOpen(true)}
            disabled={activeAccounts.length < 2}
            className="rounded-2xl bg-[var(--color-surface)] py-3.5"
          >
            <ArrowLeftRight size={17} className="text-[var(--color-brand-light)]" aria-hidden />
            Transferir
          </Button>
          {activeAccounts.length < 2 ? (
            <p className="col-span-2 -mt-1 px-1 text-xs text-[var(--color-text-muted)]">
              Para transferir necesitas al menos dos cuentas.
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="mx-4 mt-5">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Tus cuentas
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{account.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {KINDS.find((k) => k.value === account.kind)?.label}
                    </span>
                  </span>
                  <span
                    className="max-w-[45%] shrink-0 truncate text-sm font-semibold tabular-nums"
                    style={{ color: balance < 0 ? "var(--color-expense)" : undefined }}
                  >
                    {money(balance)}
                  </span>
                  {canManage ? (
                    <ChevronRight size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                  ) : null}
                </>
              );
              return canManage ? (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountSheet({ open: true, editing: account })}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
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
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Transferencias recientes
          </h2>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
            {recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  <ArrowLeftRight size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {accountName(t.fromAccountId)} → {accountName(t.toAccountId)}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">
                    {formatDayLabel(t.date)}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                </span>
                <span className="max-w-[40%] shrink-0 truncate text-sm font-semibold tabular-nums">
                  {money(t.amount)}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    aria-label="Eliminar transferencia"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "¿Eliminar esta transferencia?",
                        description: "El dinero volverá a la cuenta de origen.",
                        confirmLabel: "Eliminar",
                        destructive: true,
                      });
                      if (ok) deleteTransfer(t.id);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
                  >
                    <Trash2 size={16} aria-hidden />
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
