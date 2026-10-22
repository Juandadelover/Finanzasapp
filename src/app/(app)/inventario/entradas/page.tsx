"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackagePlus, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { buttonClass } from "@/components/ui/buttonStyles";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatDayLabel } from "@/lib/format";
import { inventoryErrorMessage, listReceipts } from "@/lib/inventory/api";
import type { StockReceipt } from "@/types/inventory";

type Filter = "all" | "pending";

function StatusPill({ status }: { status: StockReceipt["status"] }) {
  const pending = status === "pending_cost";
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        pending
          ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
      )}
    >
      {pending ? "Falta costo" : "Completa"}
    </span>
  );
}

export default function EntradasPage() {
  const router = useRouter();
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const [receipts, setReceipts] = useState<StockReceipt[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!workspaceId || !permissions.canViewCosts) return;
    let cancelled = false;
    listReceipts(workspaceId)
      .then((list) => {
        if (!cancelled) setReceipts(list);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(inventoryErrorMessage(err));
        setReceipts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, permissions.canViewCosts]);

  const header = (
    <>
      <AppHeader />
      <PageHeader
        title="Entradas"
        subtitle="Mercancía que ha llegado al negocio."
        backHref="/inventario"
        actions={
          permissions.canReceiveStock ? (
            <Link href="/inventario/entradas/nueva" className={buttonClass({ size: "sm" })}>
              <PackagePlus size={16} aria-hidden />
              Nueva entrada
            </Link>
          ) : null
        }
      />
    </>
  );

  if (!hydrated || (permissions.canViewCosts && receipts === null)) {
    return (
      <>
        {header}
        <SkeletonList count={3} className="mx-4 mt-5" />
      </>
    );
  }

  if (!permissions.canViewCosts) {
    return (
      <>
        {header}
        <p className="mx-4 mt-5 text-sm text-[var(--color-text-muted)]">No tienes permiso para ver las entradas.</p>
      </>
    );
  }

  const all = receipts ?? [];
  const rows = filter === "pending" ? all.filter((r) => r.status === "pending_cost") : all;
  const supplierName = (id: string | null) => (id && state.contacts.find((c) => c.id === id)?.name) || "Sin proveedor";
  const money = (v: number | null) => (v === null ? "—" : hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  const columns = [
    { key: "number", header: "N.º", cell: (r: StockReceipt) => <span className="font-medium">#{r.number}</span> },
    { key: "date", header: "Fecha", cell: (r: StockReceipt) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDayLabel(r.date)}</span> },
    { key: "supplier", header: "Proveedor", className: "w-full max-w-0", cell: (r: StockReceipt) => <span className="block truncate">{supplierName(r.supplier_id)}</span> },
    { key: "status", header: "Estado", cell: (r: StockReceipt) => <StatusPill status={r.status} /> },
    { key: "total", header: "Total", align: "right" as const, cell: (r: StockReceipt) => <span className="whitespace-nowrap font-semibold">{money(r.total_cost)}</span> },
  ];

  return (
    <>
      {header}
      <div className="mx-4 mt-4">
        <SegmentedControl<Filter>
          aria-label="Filtrar entradas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todas" },
            { value: "pending", label: "Falta costo" },
          ]}
        />
      </div>
      <div className="mx-4 mt-4 pb-24">
        <DataTable
          caption="Entradas de mercancía"
          rows={rows}
          columns={columns}
          getRowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/inventario/entradas/${r.id}`)}
          mobileClassName="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5"
          empty={
            <EmptyState
              icon={PackageCheck}
              title={filter === "pending" ? "No hay entradas con costo pendiente" : "Aún no hay entradas"}
              description={filter === "pending" ? undefined : "Cuando recibas mercancía, regístrala aquí."}
              action={
                filter === "all" && permissions.canReceiveStock
                  ? { label: "Nueva entrada", href: "/inventario/entradas/nueva" }
                  : undefined
              }
            />
          }
          renderMobile={(r) => (
            <Link
              href={`/inventario/entradas/${r.id}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-[var(--color-surface-2)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  #{r.number} · {supplierName(r.supplier_id)}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  {formatDayLabel(r.date)}
                  <StatusPill status={r.status} />
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold">{money(r.total_cost)}</span>
            </Link>
          )}
        />
      </div>
    </>
  );
}
