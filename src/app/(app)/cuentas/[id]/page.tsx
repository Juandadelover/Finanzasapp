"use client";

import { use, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Pencil, Receipt } from "lucide-react";
import { AccountSheet, ACCOUNT_KINDS } from "@/components/AccountSheet";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { TransactionItem } from "@/components/TransactionItem";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount, formatDayLabel } from "@/lib/format";
import { accountStatement, type AccountEntry } from "@/lib/selectors";

type Filter = "all" | "in" | "out";

const PAGE_SIZE = 30;

const isIncoming = (e: AccountEntry) =>
  e.kind === "transfer" ? e.direction === "in" : e.transaction.type === "income";

export default function CuentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, hydrated, permissions } = useFinance();
  const { hidden } = usePrivacy();
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState(false);

  const currency = state.settings.currency;
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const accountName = (accountId: string) => state.accounts.find((a) => a.id === accountId)?.name ?? "Cuenta";

  const account = state.accounts.find((a) => a.id === id) ?? null;
  const statement = useMemo(
    () => accountStatement(state, id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.accounts, state.transactions, state.transfers, id],
  );
  const entries = useMemo(() => {
    const all = statement?.entries ?? [];
    if (filter === "all") return all;
    return all.filter((e) => (filter === "in" ? isIncoming(e) : !isIncoming(e)));
  }, [statement, filter]);

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Cuenta" backHref="/cuentas" backLabel="Cuentas" />
        <Skeleton className="mx-4 mt-4 h-32 rounded-3xl" />
        <SkeletonList count={4} className="mx-4 mt-5" />
      </>
    );
  }

  if (!account || !statement) {
    return (
      <>
        <AppHeader />
        <PageContainer size="medium">
          <PageHeader title="Cuenta" backHref="/cuentas" backLabel="Cuentas" className="lg:mx-0 lg:mt-0" />
          <div className="mx-4 mt-6 lg:mx-0">
            <EmptyState
              icon={Landmark}
              title="No encontramos esta cuenta"
              description="Puede que la hayan eliminado o que no tengas acceso."
              action={{ label: "Ver mis cuentas", href: "/cuentas" }}
            />
          </div>
        </PageContainer>
      </>
    );
  }

  const kind = ACCOUNT_KINDS.find((k) => k.value === account.kind);
  const shown = entries.slice(0, visible);
  const pendingCount = (statement.entries.filter((e) => e.kind === "transaction" && e.transaction.status === "pending")).length;

  return (
    <>
      <AppHeader />
      <PageContainer size="medium">
        <PageHeader
          title={account.name}
          subtitle={`${kind?.label ?? "Cuenta"}${account.archived ? " · Archivada" : ""}`}
          backHref="/cuentas"
          backLabel="Cuentas"
          className="lg:mx-0 lg:mt-0"
          actions={
            permissions.canEditTransactions ? (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden /> Editar
              </Button>
            ) : null
          }
        />

        <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)] lg:mx-0">
          <span className="text-sm font-medium text-white/80">Saldo de la cuenta</span>
          <p className="mt-2 truncate text-4xl font-bold tracking-tight tabular-nums">
            <AnimatedValue value={money(statement.balance)} className="truncate" />
          </p>
          <p className="mt-1 text-xs text-white/70">
            Saldo inicial {money(account.openingBalance)} · solo cuenta lo que ya está pagado
          </p>
        </div>

        <section aria-labelledby="movs-title" className="mx-4 mt-6 lg:mx-0">
          <div className="flex items-center justify-between gap-3">
            <h2 id="movs-title" className="text-sm font-semibold">
              Movimientos de esta cuenta
            </h2>
            <span className="text-xs text-[var(--color-text-faint)]">
              {statement.entries.length} {statement.entries.length === 1 ? "registro" : "registros"}
            </span>
          </div>

          {statement.entries.length > 0 ? (
            <SegmentedControl
              aria-label="Filtrar movimientos"
              className="mt-3"
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setVisible(PAGE_SIZE);
              }}
              options={[
                { value: "all", label: "Todos" },
                { value: "in", label: "Entradas" },
                { value: "out", label: "Salidas" },
              ]}
            />
          ) : null}

          {pendingCount > 0 ? (
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">
              Los movimientos pendientes aparecen en la lista, pero no cambian el saldo hasta que se paguen.
            </p>
          ) : null}

          <div className="mt-3">
            {statement.entries.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Esta cuenta aún no tiene movimientos"
                description="Cuando registres un gasto o un ingreso, elige esta cuenta y aparecerá aquí."
              />
            ) : entries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                No hay {filter === "in" ? "entradas" : "salidas"} en esta cuenta.
              </p>
            ) : (
              <ul className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
                {shown.map((e) =>
                  e.kind === "transaction" ? (
                    <li key={`t-${e.transaction.id}`}>
                      <TransactionItem
                        transaction={e.transaction}
                        category={state.categories.find((c) => c.id === e.transaction.categoryId)}
                        currency={currency}
                      />
                    </li>
                  ) : (
                    <li key={`tr-${e.transfer.id}`}>
                      <div className="flex min-h-[60px] items-center gap-3 rounded-2xl px-2 py-2.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                          {e.direction === "in" ? <ArrowDownLeft size={19} aria-hidden /> : <ArrowUpRight size={19} aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {e.direction === "in"
                              ? `Transferencia desde ${accountName(e.transfer.fromAccountId)}`
                              : `Transferencia a ${accountName(e.transfer.toAccountId)}`}
                          </span>
                          <span className="block truncate text-xs text-[var(--color-text-faint)]">
                            {formatDayLabel(e.transfer.date)}
                            {e.transfer.description ? ` · ${e.transfer.description}` : ""}
                          </span>
                        </span>
                        <span
                          className="tabular max-w-[45%] shrink-0 truncate text-sm font-semibold"
                          style={{ color: e.direction === "in" ? "var(--color-income)" : "var(--color-expense)" }}
                        >
                          {hidden ? MASKED_AMOUNT : `${e.direction === "in" ? "+" : "-"}${formatAmount(e.transfer.amount, currency)}`}
                        </span>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          {entries.length > visible ? (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Ver más ({entries.length - visible})
            </Button>
          ) : null}
        </section>
      </PageContainer>

      {editing ? <AccountSheet key={account.id} editing={account} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
