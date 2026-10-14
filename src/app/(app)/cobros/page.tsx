"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
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

  return (
    <div className="pb-28">
      <AppHeader
        actions={
          permissions.canEditTransactions ? (
            <Link
              href={tab === "quote" ? "/cobros/nuevo?tipo=cotizacion" : "/cobros/nuevo"}
              className="gradient-brand flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} /> Nueva
            </Link>
          ) : null
        }
      />
      <div className="px-4 pt-5">
        <h1 className="text-xl font-bold">Cobros</h1>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface-2)] p-1">
          {(
            [
              ["collection", "Cuentas de cobro"],
              ["quote", "Cotizaciones"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg py-2 text-sm font-medium transition",
                tab === k
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {docs === null ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">Cargando...</p>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={tab === "quote" ? "Aún no tienes cotizaciones" : "Aún no tienes cuentas de cobro"}
              description="Crea una y compártela con tu cliente por WhatsApp."
            />
          ) : (
            visible.map((d) => (
              <Link
                key={d.id}
                href={`/cobros/${d.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{formatDocNumber(d.number)}</p>
                  <p className="truncate text-sm text-[var(--color-text-muted)]">
                    {d.contactName ?? "Sin cliente"}
                  </p>
                  <p className="text-xs text-[var(--color-text-faint)]">{formatDayLabel(d.issueDate)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-sm font-bold">{formatAmount(d.total, currency)}</p>
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
