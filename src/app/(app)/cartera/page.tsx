"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, HandCoins, MessageCircle, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
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
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

function PaySheet({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const { state, markTransactionPaid } = useFinance();
  const accounts = state.accounts.filter((a) => !a.archived);
  const [accountId, setAccountId] = useState(transaction.accountId ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!accountId) {
      setError("Elige en qué cuenta entró o salió la plata.");
      return;
    }
    setSaving(true);
    try {
      await markTransactionPaid(transaction.id, { accountId, date });
      onClose();
    } catch {
      setError("No se pudo marcar como pagado. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Marcar como pagado">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div role="group" aria-label="Cuenta">
          <p className={labelClass}>Cuenta</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                aria-pressed={accountId === a.id}
                className={cn(
                  "min-h-11 max-w-full truncate rounded-full border px-4 py-2 text-sm transition",
                  accountId === a.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
          {accounts.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Aún no tienes cuentas.{" "}
              <Link
                href="/cuentas"
                className="font-medium text-[var(--color-brand-light)] underline underline-offset-2"
              >
                Crea una en Cuentas
              </Link>
              .
            </p>
          ) : null}
        </div>
        <label className="block">
          <span className={labelClass}>Fecha de pago</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={saving}>
          Confirmar pago
        </Button>
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

  const list = useMemo(() => sortByDueDate(pendingTransactions(state.transactions, tab)), [state.transactions, tab]);
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
        <PageHeader title="Cartera" />
        <Skeleton className="mx-4 mt-4 h-32 rounded-3xl" />
        <SkeletonList count={3} className="mx-4 mt-4" />
      </>
    );
  }

  const contactOf = (id: string | null) => (id ? state.contacts.find((c) => c.id === id) : undefined);

  return (
    <>
      <AppHeader />

      <PageHeader title="Cartera" subtitle="Lo que te deben y lo que debes." />
      <div className="mx-4 mt-2 flex flex-wrap gap-2">
        <Link
          href="/cobros"
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "rounded-full bg-[var(--color-surface)] px-4",
          })}
        >
          <FileText size={16} className="text-[var(--color-brand-light)]" aria-hidden />
          Cuentas de cobro
        </Link>
        <Link
          href="/contactos"
          className={buttonClass({
            variant: "secondary",
            size: "sm",
            className: "rounded-full bg-[var(--color-surface)] px-4",
          })}
        >
          <Users size={16} className="text-[var(--color-brand-light)]" aria-hidden />
          Contactos
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Me deben o debo"
        className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--color-surface)] p-1"
      >
        {(["income", "expense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "min-h-11 rounded-xl py-2 text-sm font-medium transition",
              tab === k
                ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]"
                : "text-[var(--color-text-muted)]",
            )}
          >
            {k === "income" ? "Me deben" : "Debo"}
          </button>
        ))}
      </div>

      <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
        <span className="text-sm font-medium text-white/80">
          {tab === "income" ? "Te deben en total" : "Debes en total"}
        </span>
        <p className="mt-2 truncate text-3xl font-bold tracking-tight tabular-nums">{money(total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {list.length} {list.length === 1 ? "pendiente" : "pendientes"}
        </p>
      </div>

      <h2 className="mx-4 mt-4 text-xs font-semibold text-[var(--color-text-muted)]">Según los días de atraso</h2>
      <div className="mx-4 mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {AGING_ORDER.map((b) => (
          <div
            key={b}
            className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-center"
          >
            <p className="truncate text-xs text-[var(--color-text-muted)]">{AGING_LABELS[b]}</p>
            <p
              className="break-words text-xs font-semibold tabular-nums"
              style={{ color: b !== "current" && aging[b] > 0 ? "var(--color-expense)" : undefined }}
            >
              {hidden ? "••" : formatAmount(aging[b], currency, { showSymbol: false })}
            </p>
          </div>
        ))}
      </div>

      <section className="mx-4 mt-3 mb-4">
        {list.length === 0 ? (
          <>
            <EmptyState
              icon={HandCoins}
              title={tab === "income" ? "Nadie te debe por ahora" : "No tienes deudas pendientes"}
              description={
                tab === "income"
                  ? "Cuando vendas a crédito o crees una cuenta de cobro, aparecerá aquí."
                  : "Cuando registres un gasto como pendiente de pago, aparecerá aquí."
              }
            />
            {canManage && tab === "income" ? (
              <Link href="/cobros/nuevo" className={buttonClass({ className: "mt-3 w-full" })}>
                Crear cuenta de cobro
              </Link>
            ) : null}
          </>
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
                        `. Quedamos atentos a tu confirmación. ¡Gracias!`,
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
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {t.description || "Sin descripción"}
                      </p>
                    </div>
                    <p className="max-w-[45%] shrink-0 truncate text-sm font-semibold tabular-nums">
                      {money(t.amount)}
                    </p>
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
                        <Button variant="secondary" size="sm" onClick={() => setPaying(t)} className="flex-1">
                          <CheckCircle2 size={16} className="text-[var(--color-income)]" aria-hidden />
                          Marcar como pagado
                        </Button>
                      ) : null}
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-semibold text-black"
                        >
                          <MessageCircle size={16} aria-hidden />
                          Recordar por WhatsApp
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
