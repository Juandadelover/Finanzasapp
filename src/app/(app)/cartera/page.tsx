"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, HandCoins, MessageCircle, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatDayLabel, toISODate } from "@/lib/format";
import {
  AGING_LABELS,
  AGING_ORDER,
  agingBucket,
  daysOverdue,
  dueLabel,
  pendingTransactions,
  sortByDueDate,
  sumAmount,
  whatsappUrl,
  type AgingBucket,
} from "@/lib/cartera";
import type { Transaction } from "@/types/finance";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

function PaySheet({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const { state, markTransactionPaid } = useFinance();
  const accounts = state.accounts.filter((a) => !a.archived);
  const [accountId, setAccountId] = useState(transaction.accountId ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Elige una cuenta.");
      return;
    }
    await markTransactionPaid(transaction.id, { accountId, date });
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Marcar como pagado">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Cuenta</label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition",
                  accountId === a.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Fecha de pago</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        <button
          type="submit"
          className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)]"
        >
          Confirmar pago
        </button>
      </form>
    </BottomSheet>
  );
}

export default function CarteraPage() {
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const canManage = permissions.canEditTransactions;
  const [tab, setTab] = useState<"income" | "expense">("income");
  const [paying, setPaying] = useState<Transaction | null>(null);
  const today = toISODate(new Date());
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  const list = useMemo(
    () => sortByDueDate(pendingTransactions(state.transactions, tab)),
    [state.transactions, tab]
  );
  const total = sumAmount(list);
  const aging = useMemo(() => {
    const acc: Record<AgingBucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    for (const t of list) acc[agingBucket(t.dueDate, today)] += t.amount;
    return acc;
  }, [list, today]);

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  const contactOf = (id: string | null) => (id ? state.contacts.find((c) => c.id === id) : undefined);

  return (
    <>
      <AppHeader />

      <div className="mx-4 mt-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cartera</h1>
        <div className="flex items-center gap-2">
        <Link
          href="/cobros"
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-semibold"
        >
          <FileText size={16} className="text-[var(--color-brand-light)]" />
          Cobros
        </Link>
        <Link
          href="/contactos"
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-semibold"
        >
          <Users size={16} className="text-[var(--color-brand-light)]" />
          Contactos
        </Link>
        </div>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--color-surface)] p-1">
        {(["income", "expense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-xl py-2 text-sm font-medium transition",
              tab === k ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]" : "text-[var(--color-text-muted)]"
            )}
          >
            {k === "income" ? "Me deben" : "Debo"}
          </button>
        ))}
      </div>

      <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
        <span className="text-sm font-medium text-white/80">{tab === "income" ? "Total por cobrar" : "Total por pagar"}</span>
        <p className="mt-2 text-3xl font-bold tracking-tight">{money(total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {list.length} pendiente{list.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-5 gap-1.5">
        {AGING_ORDER.map((b) => (
          <div
            key={b}
            className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-2 text-center"
          >
            <p className="truncate text-[10px] text-[var(--color-text-faint)]">{AGING_LABELS[b]}</p>
            <p
              className="truncate text-[11px] font-semibold"
              style={{ color: b !== "current" && aging[b] > 0 ? "var(--color-expense)" : undefined }}
            >
              {hidden ? "••" : formatAmount(aging[b], currency, { showSymbol: false })}
            </p>
          </div>
        ))}
      </div>
      <p className="mx-4 mt-1 text-[10px] text-[var(--color-text-faint)]">Días de vencido</p>

      <section className="mx-4 mt-3 mb-4">
        {list.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={tab === "income" ? "Nadie te debe por ahora" : "No tienes deudas pendientes"}
            description="Los movimientos con estado pendiente aparecerán aquí."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((t) => {
              const contact = contactOf(t.contactId);
              const overdue = daysOverdue(t.dueDate, today) > 0;
              const wa =
                tab === "income" && contact?.phone
                  ? whatsappUrl(
                      contact.phone,
                      `Hola ${contact.name}, te escribimos de ${currentWorkspace?.name ?? "nuestro negocio"}. ` +
                        `Te recordamos amablemente el pago pendiente de ${formatAmount(t.amount, currency)}` +
                        (t.dueDate ? `, con vencimiento el ${formatDayLabel(t.dueDate)}` : "") +
                        `. Quedamos atentos a tu confirmación. ¡Gracias!`
                    )
                  : null;
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{contact?.name ?? "Sin contacto"}</p>
                      <p className="truncate text-xs text-[var(--color-text-faint)]">
                        {t.description || "Sin descripción"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{money(t.amount)}</p>
                  </div>
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: overdue ? "var(--color-expense)" : "var(--color-text-muted)" }}
                  >
                    {dueLabel(t.dueDate, today)}
                  </p>
                  {canManage || wa ? (
                    <div className="mt-2.5 flex gap-2">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => setPaying(t)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] py-2 text-xs font-semibold"
                        >
                          <CheckCircle2 size={15} className="text-[var(--color-income)]" />
                          Marcar como pagado
                        </button>
                      ) : null}
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2 text-xs font-semibold text-black"
                        >
                          <MessageCircle size={15} />
                          Recordar
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {paying ? <PaySheet key={paying.id} transaction={paying} onClose={() => setPaying(null)} /> : null}
    </>
  );
}
