"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { fetchAdminMetrics, type AdminMetrics } from "@/lib/admin";
import { formatAmount } from "@/lib/format";

function Tile({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
}) {
  const cls = cn(
    "block rounded-2xl border p-4",
    highlight
      ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
      : "border-[var(--color-border)] bg-[var(--color-surface)]"
  );
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
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

  useEffect(() => {
    let alive = true;
    fetchAdminMetrics().then((d) => {
      if (!alive) return;
      setM(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-surface)]" />;
  if (!m) return <p className="text-sm text-[var(--color-text-muted)]">No hay datos disponibles.</p>;

  const plans = Object.entries(m.by_plan);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="MRR" value={formatAmount(m.mrr, "COP")} />
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
        <div className="col-span-2">
          <Tile label="Ingresos del mes" value={formatAmount(m.revenue_this_month, "COP")} />
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
          Clientes pagos por plan
        </p>
        {plans.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aún no hay clientes pagos.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {plans.map(([code, n]) => (
              <li key={code} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">{code}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
