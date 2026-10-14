"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatDayLabel } from "@/lib/format";
import {
  formatDocNumber,
  listDocuments,
  STATUS_CHIP,
  STATUS_LABELS,
  type CollectionDocument,
  type DocumentKind,
} from "@/lib/documents";

export default function CobrosPage() {
  const { currentWorkspace, permissions } = useFinance();
  const { hidden } = usePrivacy();
  const [tab, setTab] = useState<DocumentKind>("collection");
  const [docs, setDocs] = useState<CollectionDocument[] | null>(null);
  const workspaceId = currentWorkspace?.id;
  const currency = currentWorkspace?.currency ?? "COP";

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    listDocuments(workspaceId).then((d) => {
      if (!cancelled) setDocs(d);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const visible = (docs ?? []).filter((d) => d.kind === tab);

  const canCreate = permissions.canEditTransactions;
  const newHref = tab === "quote" ? "/cobros/nuevo?tipo=cotizacion" : "/cobros/nuevo";
  const newLabel = tab === "quote" ? "Nueva cotización" : "Nueva cuenta de cobro";

  return (
    <div className="pb-28">
      <AppHeader />
      <PageHeader
        title="Cobros"
        subtitle="Documentos para cobrar y cotizar a tus clientes."
        backHref="/cartera"
        backLabel="Cartera"
        actions={
          canCreate ? (
            <Link href={newHref} className={buttonClass({ size: "sm", className: "rounded-full px-4" })}>
              <Plus size={16} aria-hidden /> Nuevo
            </Link>
          ) : null
        }
      />
      <div className="px-4">
        <div
          role="tablist"
          aria-label="Tipo de documento"
          className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface-2)] p-1"
        >
          {(
            [
              ["collection", "Cuentas de cobro"],
              ["quote", "Cotizaciones"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "min-h-11 rounded-xl py-2 text-sm font-medium transition",
                tab === k
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {docs === null ? (
            <SkeletonList count={4} />
          ) : visible.length === 0 ? (
            <>
              <EmptyState
                icon={FileText}
                title={tab === "quote" ? "Aún no tienes cotizaciones" : "Aún no tienes cuentas de cobro"}
                description={
                  canCreate
                    ? "Crea una y compártela con tu cliente por WhatsApp."
                    : "Cuando el negocio cree una, la verás aquí."
                }
              />
              {canCreate ? (
                <Link href={newHref} className={buttonClass({ className: "mt-1 w-full" })}>
                  <Plus size={16} aria-hidden /> {newLabel}
                </Link>
              ) : null}
            </>
          ) : (
            visible.map((d) => (
              <Link
                key={d.id}
                href={`/cobros/${d.id}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 transition hover:bg-[var(--color-surface-2)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{formatDocNumber(d.number)}</p>
                  <p className="truncate text-sm text-[var(--color-text-muted)]">{d.contactName ?? "Sin cliente"}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDayLabel(d.issueDate)}</p>
                </div>
                <div className="flex min-w-0 max-w-[50%] shrink-0 flex-col items-end gap-1.5">
                  <p className="max-w-full truncate text-sm font-bold tabular-nums">
                    {hidden ? MASKED_AMOUNT : formatAmount(d.total, currency)}
                  </p>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CHIP[d.status])}>
                    {STATUS_LABELS[d.status]}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
