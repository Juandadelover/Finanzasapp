"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, ReceiptText, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { buttonClass } from "@/components/ui/buttonStyles";
import { DataTable } from "@/components/ui/DataTable";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import { inventoryErrorMessage } from "@/lib/inventory/api";
import { listSales } from "@/lib/pos/api";
import type { Sale } from "@/types/pos";

type KindFilter = "all" | "cash" | "credit";
type StatusFilter = "active" | "void" | "all";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }); // YYYY-MM-DD
const labelFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function StatusPill({ sale }: { sale: Sale }) {
  const voided = sale.status === "void";
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        voided
          ? "bg-[var(--color-expense)]/15 text-[var(--color-expense)]"
          : sale.kind === "credit"
            ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
      )}
    >
      {voided ? "Anulada" : sale.kind === "credit" ? "Crédito" : "Contado"}
    </span>
  );
}

export default function VentasPage() {
  const router = useRouter();
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    listSales(workspaceId, {})
      .then((list) => {
        if (cancelled) return;
        setSales(list);
        setLoadError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(inventoryErrorMessage(err));
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadKey]);

  const retry = useCallback(() => {
    setLoadError(false);
    setReloadKey((k) => k + 1);
  }, []);

  const rows = useMemo(() => {
    return (sales ?? []).filter((s) => {
      if (kind !== "all" && s.kind !== kind) return false;
      if (status !== "all" && s.status !== status) return false;
      const day = dayFmt.format(new Date(s.created_at));
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [sales, kind, status, from, to]);

  const totals = useMemo(() => {
    const active = rows.filter((s) => s.status === "active");
    return { count: active.length, total: active.reduce((a, s) => a + s.total, 0), balance: active.reduce((a, s) => a + s.balance, 0) };
  }, [rows]);

  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const customerName = (id: string | null) => (id && state.contacts.find((c) => c.id === id)?.name) || "Sin cliente";

  const header = (
    <PageHeader
      title="Ventas"
      subtitle="Lo que has vendido."
      actions={
        permissions.canSell ? (
          <Link href="/vender" className={buttonClass({ size: "sm" })}>
            <ShoppingCart size={16} aria-hidden />
            Vender
          </Link>
        ) : null
      }
    />
  );

  if (!hydrated || (sales === null && !loadError)) {
    return (
      <>
        <AppHeader />
        <PageContainer size="medium">
          {header}
          <SkeletonList count={3} className="mx-4 mt-5" />
        </PageContainer>
      </>
    );
  }

  if (loadError || sales === null) {
    return (
      <>
        <AppHeader />
        <PageContainer size="medium">
          {header}
          <div className="mx-4 mt-5">
            <EmptyState
              icon={Receipt}
              tone="error"
              title="No pudimos cargar las ventas"
              description="Revisa tu conexión e inténtalo de nuevo."
              action={{ label: "Reintentar", onClick: retry }}
            />
          </div>
        </PageContainer>
      </>
    );
  }

  const columns = [
    { key: "number", header: "N.º", cell: (s: Sale) => <span className="font-medium">#{s.number}</span> },
    { key: "date", header: "Fecha", cell: (s: Sale) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{labelFmt.format(new Date(s.created_at))}</span> },
    { key: "customer", header: "Cliente", className: "w-full max-w-0", cell: (s: Sale) => <span className="block truncate">{customerName(s.contact_id)}</span> },
    { key: "status", header: "Tipo", cell: (s: Sale) => <StatusPill sale={s} /> },
    { key: "total", header: "Total", align: "right" as const, cell: (s: Sale) => <span className="whitespace-nowrap font-semibold">{money(s.total)}</span> },
  ];

  return (
    <>
      <AppHeader />
      <PageContainer size="medium">
        {header}
        <div className="mx-4 mt-4 flex flex-col gap-3">
          <SegmentedControl<StatusFilter>
            aria-label="Estado de la venta"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Activas" },
              { value: "void", label: "Anuladas" },
              { value: "all", label: "Todas" },
            ]}
          />
          <SegmentedControl<KindFilter>
            aria-label="Tipo de venta"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Todas" },
              { value: "cash", label: "Contado" },
              { value: "credit", label: "Crédito" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Desde</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Hasta</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>

        <div className="mx-4 mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Ventas</p>
            <p className="text-sm font-bold">{totals.count}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Vendido</p>
            <p className="text-sm font-bold">{money(totals.total)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Por cobrar</p>
            <p className="text-sm font-bold">{money(totals.balance)}</p>
          </div>
        </div>

        <div className="mx-4 mt-4 pb-24">
          <DataTable
            caption="Ventas"
            rows={rows}
            columns={columns}
            getRowKey={(s) => s.id}
            onRowClick={(s) => router.push(`/ventas/${s.id}`)}
            mobileClassName="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5"
            empty={
              <EmptyState
                icon={ReceiptText}
                title={sales.length === 0 ? "Aún no hay ventas" : "No hay ventas con estos filtros"}
                description={sales.length === 0 ? "Cuando vendas, las verás aquí." : undefined}
                action={sales.length === 0 && permissions.canSell ? { label: "Vender", href: "/vender" } : undefined}
              />
            }
            renderMobile={(s) => (
              <Link
                href={`/ventas/${s.id}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-[var(--color-surface-2)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    #{s.number} · {customerName(s.contact_id)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    {labelFmt.format(new Date(s.created_at))}
                    <StatusPill sale={s} />
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{money(s.total)}</span>
              </Link>
            )}
          />
        </div>
      </PageContainer>
    </>
  );
}
