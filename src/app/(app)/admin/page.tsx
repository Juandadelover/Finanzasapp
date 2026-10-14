"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { fetchAdminMetrics, type AdminMetrics } from "@/lib/admin";
import { formatAmount } from "@/lib/format";

function Tile({
  label,
  value,
  href,
  highlight,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
  className?: string;
}) {
  const cls = cn(
    "block rounded-2xl border p-4",
    highlight
      ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
      : "border-[var(--color-border)] bg-[var(--color-surface)]",
    href && "transition active:scale-[0.97] hover:bg-[var(--color-surface-2)]",
    className,
  );
  const inner = (
    <>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold">{value}</p>
      {href ? <p className="mt-1 text-xs font-medium text-[var(--color-brand-light)]">Ver pagos</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function AdminResumenPage() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchAdminMetrics();
    setM(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) {
    return (
      <div role="status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <span className="sr-only">Cargando métricas...</span>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!m) {
    return (
      <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="text-sm text-[var(--color-text-muted)]">No se pudieron cargar las métricas. Intenta de nuevo.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden /> Reintentar
        </Button>
      </div>
    );
  }

  const plans = Object.entries(m.by_plan);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ingresos recurrentes al mes (MRR)" value={formatAmount(m.mrr, "COP")} />
        <Tile label="Ingresos del mes" value={formatAmount(m.revenue_this_month, "COP")} />
        <Tile label="Clientes pagos" value={String(m.paying)} />
        <Tile
          label="Pagos en revisión"
          value={String(m.in_review)}
          href="/admin/pagos"
          highlight={m.in_review > 0}
        />
        <Tile label="Vencen en 7 días" value={String(m.expiring_7d)} />
        <Tile label="En gracia" value={String(m.in_grace)} />
        <Tile label="En prueba" value={String(m.trials)} />
      </div>
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:max-w-md">
        <h2 className="mb-2 text-sm font-semibold">Clientes pagos por plan</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aún no hay clientes pagos.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {plans.map(([code, n]) => (
              <li key={code} className="flex min-h-11 items-center justify-between py-2 text-sm">
                <span className="capitalize">{code}</span>
                <span className="tabular font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
