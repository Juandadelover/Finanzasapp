"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, ChevronRight, Hourglass, Layers, ReceiptText, RefreshCw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Badge, Initials, Kpi, Panel, toneColor, type Tone } from "@/components/admin/AdminUI";
import { cycleLabel, fmtDateTime } from "@/components/admin/shared";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import {
  fetchAdminMetrics,
  fetchAdminPayments,
  fetchRevenueSeries,
  type AdminMetrics,
  type AdminPayment,
  type RevenuePoint,
} from "@/lib/admin";
import { formatAmount, formatCompactAmount } from "@/lib/format";

const PLAN_NAMES: Record<string, string> = { gratis: "Gratis", emprendedor: "Emprendedor", negocio: "Negocio", pro: "Pro" };
// Niveles ordenados: un solo tono (marca) que se intensifica con el plan.
const PLAN_ORDER = ["emprendedor", "negocio", "pro"];
const PLAN_SHADE: Record<string, string> = {
  emprendedor: "color-mix(in oklab, var(--color-brand-light) 45%, var(--color-surface-3))",
  negocio: "color-mix(in oklab, var(--color-brand-light) 75%, var(--color-surface-3))",
  pro: "var(--color-brand-light)",
};

function monthShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
}

function RevenueSparkline({ points }: { points: RevenuePoint[] }) {
  const reduced = useReducedMotion();
  const data = points.map((p) => ({ label: monthShort(p.month), revenue: p.revenue }));
  return (
    <div className="h-28 w-full" role="img" aria-label="Ingresos aprobados de los últimos 6 meses">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="admin-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-light)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-brand-light)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: "var(--color-text-faint)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-border)" }}
            formatter={(value) => [formatAmount(Number(value), "COP"), "Ingresos"]}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-text)",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-brand-light)"
            strokeWidth={2}
            fill="url(#admin-rev)"
            isAnimationActive={!reduced}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TodoRow({
  icon: Icon,
  label,
  detail,
  count,
  tone,
  href,
}: {
  icon: typeof AlarmClock;
  label: string;
  detail: string;
  count: number;
  tone: Tone;
  href: string;
}) {
  const done = count === 0;
  return (
    <li>
      <Link
        href={href}
        className="group -mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 transition-colors duration-(--duration-fast) hover:bg-[var(--color-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            color: done ? "var(--color-text-faint)" : toneColor(tone),
            backgroundColor: done
              ? "var(--color-surface-2)"
              : `color-mix(in oklab, ${toneColor(tone)} 14%, transparent)`,
          }}
        >
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-[var(--color-text-faint)]">{done ? "Al día" : detail}</span>
        </span>
        <span
          className={cn(
            "tabular text-lg font-semibold",
            done ? "text-[var(--color-text-faint)]" : "text-[var(--color-text)]"
          )}
        >
          {count}
        </span>
        <ChevronRight
          size={16}
          aria-hidden
          className="text-[var(--color-text-faint)] transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

function PlanMix({ byPlan }: { byPlan: Record<string, number> }) {
  const rows = PLAN_ORDER.map((code) => ({ code, n: byPlan[code] ?? 0 }));
  const others = Object.entries(byPlan).filter(([code]) => !PLAN_ORDER.includes(code) && code !== "gratis");
  for (const [code, n] of others) rows.push({ code, n });
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aún no hay clientes pagos.</p>;
  }
  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]"
        role="img"
        aria-label={rows.map((r) => `${PLAN_NAMES[r.code] ?? r.code}: ${r.n}`).join(", ")}
      >
        {rows
          .filter((r) => r.n > 0)
          .map((r) => (
            <span
              key={r.code}
              className="h-full border-r-2 border-[var(--color-surface)] last:border-r-0"
              style={{ width: `${(r.n / total) * 100}%`, backgroundColor: PLAN_SHADE[r.code] ?? "var(--color-text-faint)" }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.code} className="flex min-h-10 items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: PLAN_SHADE[r.code] ?? "var(--color-text-faint)" }}
            />
            <span className="flex-1">{PLAN_NAMES[r.code] ?? r.code}</span>
            <span className="tabular text-[var(--color-text-faint)]">
              {Math.round((r.n / total) * 100)}%
            </span>
            <span className="tabular w-8 text-right font-semibold">{r.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewQueue({ payments }: { payments: AdminPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        <CheckCircle2 size={18} className="shrink-0 text-[var(--color-income)]" aria-hidden />
        No hay comprobantes esperando revisión.
      </div>
    );
  }
  return (
    <ul className="-mx-2 flex flex-col">
      {payments.map((p) => {
        const name = p.full_name || p.email || "Cliente";
        const mismatch = p.declared_amount != null && p.declared_amount !== p.expected_amount;
        return (
          <li key={p.id}>
            <Link
              href="/admin/pagos"
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-(--duration-fast) hover:bg-[var(--color-surface-2)]"
            >
              <Initials name={name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-[var(--color-text-faint)]">
                  {PLAN_NAMES[p.plan_code] ?? p.plan_code} · {cycleLabel(p.billing_cycle)} · {fmtDateTime(p.created_at)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="tabular text-sm font-semibold">
                  {formatAmount(p.declared_amount ?? p.expected_amount, "COP")}
                </span>
                {mismatch ? <Badge tone="warning">Monto distinto</Badge> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminResumenPage() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [queue, setQueue] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [metrics, rev, pays] = await Promise.all([
      fetchAdminMetrics(),
      fetchRevenueSeries(6),
      fetchAdminPayments("in_review"),
    ]);
    setM(metrics);
    setSeries(rev ?? []);
    setQueue(pays ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const revenue6 = useMemo(() => series.reduce((s, p) => s + p.revenue, 0), [series]);

  if (loading) {
    return (
      <div role="status" className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <span className="sr-only">Cargando métricas...</span>
        <Skeleton className="h-60 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-60 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
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

  const avgTicket = m.paying > 0 ? Math.round(m.mrr / m.paying) : 0;
  const pendingTotal = m.in_review + m.expiring_7d + m.in_grace;

  return (
    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      {/* Cifra protagonista: lo que entra cada mes */}
      <section
        aria-labelledby="mrr-title"
        className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:col-span-2 lg:p-5"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--color-brand)] opacity-[0.12] blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <h2 id="mrr-title" className="text-xs font-medium text-[var(--color-text-muted)]">
              Ingreso recurrente mensual
            </h2>
            <p className="tabular mt-1 text-4xl font-bold tracking-tight lg:text-5xl">{formatAmount(m.mrr, "COP")}</p>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              <span className="tabular font-medium text-[var(--color-text)]">{formatCompactAmount(m.mrr * 12, "COP")}</span>{" "}
              al año a este ritmo · <span className="tabular">{m.paying}</span>{" "}
              {m.paying === 1 ? "cliente paga" : "clientes pagan"}
            </p>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-[var(--color-text-faint)]">Cobrado este mes</dt>
              <dd className="tabular mt-0.5 font-semibold">{formatAmount(m.revenue_this_month, "COP")}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-faint)]">Últimos 6 meses</dt>
              <dd className="tabular mt-0.5 font-semibold">{formatAmount(revenue6, "COP")}</dd>
            </div>
          </dl>
        </div>
        <div className="relative mt-4">
          {series.length > 0 ? (
            <RevenueSparkline points={series} />
          ) : (
            <p className="text-sm text-[var(--color-text-faint)]">Sin datos de ingresos todavía.</p>
          )}
        </div>
        <Link
          href="/admin/ingresos"
          className="relative mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-brand-light)] hover:underline"
        >
          Ver ingresos <ChevronRight size={15} aria-hidden />
        </Link>
      </section>

      {/* Lo que pide acción hoy */}
      <Panel
        id="todo"
        title="Para hacer hoy"
        description={pendingTotal === 0 ? "Todo al día." : `${pendingTotal} ${pendingTotal === 1 ? "asunto pide" : "asuntos piden"} tu atención.`}
      >
        <ul className="flex flex-col">
          <TodoRow
            icon={ReceiptText}
            label="Comprobantes por revisar"
            detail="Aprueba o rechaza el pago"
            count={m.in_review}
            tone="brand"
            href="/admin/pagos"
          />
          <TodoRow
            icon={AlarmClock}
            label="Vencen en 7 días"
            detail="Recuérdales renovar"
            count={m.expiring_7d}
            tone="warning"
            href="/admin/clientes?vence=7"
          />
          <TodoRow
            icon={Hourglass}
            label="En periodo de gracia"
            detail="Su plan venció; pierden acceso pronto"
            count={m.in_grace}
            tone="negative"
            href="/admin/clientes?estado=grace"
          />
        </ul>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4 lg:gap-4">
        <Kpi label="Clientes que pagan" value={m.paying} hint="Con plan pago vigente" href="/admin/clientes?estado=active" />
        <Kpi label="En prueba" value={m.trials} hint="Pueden convertirse en pago" tone={m.trials > 0 ? "brand" : "neutral"} href="/admin/clientes?estado=trial" />
        <Kpi label="Ticket promedio" value={formatAmount(avgTicket, "COP")} hint="MRR por cliente que paga" />
        <Kpi label="Cobrado este mes" value={formatAmount(m.revenue_this_month, "COP")} hint="Pagos aprobados" />
      </div>

      <Panel
        id="queue"
        title="Comprobantes por revisar"
        description="Los más recientes primero."
        icon={ReceiptText}
        className="lg:col-span-2"
        action={
          queue.length > 0 ? (
            <Link
              href="/admin/pagos"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--color-brand-light)] hover:bg-[var(--color-surface-2)]"
            >
              Revisar <ChevronRight size={15} aria-hidden />
            </Link>
          ) : null
        }
      >
        <ReviewQueue payments={queue.slice(0, 4)} />
      </Panel>

      <Panel id="plans" title="Clientes por plan" description="Solo planes pagos vigentes." icon={Layers}>
        <PlanMix byPlan={m.by_plan} />
      </Panel>
    </div>
  );
}
