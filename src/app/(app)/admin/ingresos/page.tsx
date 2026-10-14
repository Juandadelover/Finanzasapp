"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ResponsiveGrid } from "@/components/ui/ResponsiveGrid";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReducedMotion } from "@/components/ui/motion";
import {
  fetchAdminMetrics,
  fetchRevenueSeries,
  type AdminMetrics,
  type RevenuePoint,
} from "@/lib/admin";
import { formatAmount, formatCompactAmount, monthShortLabel } from "@/lib/format";

type Period = "6" | "12";

const PERIOD_OPTIONS = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
] as const;

const AXIS_TICK = { fill: "var(--color-text-muted)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-text)",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
} as const;

function monthParts(iso: string): { m: number; y: number } {
  const [y, m] = iso.split("-").map(Number);
  return { y, m: m - 1 };
}

function shortMonth(iso: string): string {
  const { y, m } = monthParts(iso);
  return `${monthShortLabel(m)} ${String(y).slice(2)}`;
}

function longMonth(iso: string): string {
  const { y, m } = monthParts(iso);
  const name = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)));
  // Solo la primera letra en mayúscula: "Octubre de 2026" (CSS capitalize pondría "De").
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p title={value} className="tabular mt-1 truncate text-xl font-semibold">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{hint}</p> : null}
    </div>
  );
}

function ChartEmpty({ children }: { children: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] px-4 text-center text-sm text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

export default function AdminIngresosPage() {
  const [period, setPeriod] = useState<Period>("6");
  const [series, setSeries] = useState<RevenuePoint[] | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const [s, m] = await Promise.all([fetchRevenueSeries(Number(p)), fetchAdminMetrics()]);
    setSeries(s);
    setMetrics(m);
    setFailed(s === null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(period);
  }, [load, period]);

  const rows = useMemo(() => series ?? [], [series]);
  const chartData = useMemo(() => rows.map((r) => ({ ...r, label: shortMonth(r.month) })), [rows]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          revenue: a.revenue + r.revenue,
          signups: a.signups + r.new_signups,
          expired: a.expired + r.expired,
          started: a.started + r.trials_started,
          converted: a.converted + r.trials_converted,
        }),
        { revenue: 0, signups: 0, expired: 0, started: 0, converted: 0 }
      ),
    [rows]
  );
  const conversion = totals.started > 0 ? `${Math.round((totals.converted / totals.started) * 100)} %` : "—";
  const noRevenue = rows.every((r) => r.revenue === 0);
  const noSignups = rows.every((r) => r.new_signups === 0 && r.new_paying === 0);

  const selector = (
    <SegmentedControl
      aria-label="Periodo"
      options={PERIOD_OPTIONS}
      value={period}
      onChange={setPeriod}
      className="w-full sm:w-64"
    />
  );

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {selector}
        <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">No se pudieron cargar los ingresos.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load(period)}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selector}

      {loading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Cargando ingresos...</span>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Ingresos del periodo" value={formatAmount(totals.revenue, "COP")} hint={`Últimos ${period} meses`} />
            <Kpi label="MRR actual" value={formatAmount(metrics?.mrr ?? 0, "COP")} hint="Ingreso recurrente al mes" />
            <Kpi label="Clientes nuevos" value={String(totals.signups)} />
            <Kpi
              label="Conversión prueba a pago"
              value={conversion}
              hint={totals.started > 0 ? `${totals.converted} de ${totals.started} pruebas` : "Sin pruebas en el periodo"}
            />
            <Kpi label="Vencidos" value={String(totals.expired)} />
          </div>

          <section aria-label="Gráficas de ingresos">
            <ResponsiveGrid variant="pair">
              <div className="[&>section]:mx-0 [&>section]:mt-0">
                <ChartCard
                  icon={BarChart3}
                  accent="var(--color-brand-light)"
                  title="Ingresos por mes"
                  subtitle="Pagos aprobados, en pesos colombianos"
                >
                  {noRevenue ? (
                    <ChartEmpty>Aún no hay pagos aprobados</ChartEmpty>
                  ) : (
                    <div className="h-56 w-full" role="img" aria-label={`Ingresos por mes de los últimos ${period} meses`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
                          <YAxis
                            width={64}
                            tickLine={false}
                            axisLine={false}
                            tick={AXIS_TICK}
                            tickFormatter={(v) => formatCompactAmount(Number(v), "COP")}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--color-surface-2)" }}
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={(_, p) => (p?.[0]?.payload?.month ? longMonth(p[0].payload.month) : "")}
                            formatter={(value) => [formatAmount(Number(value), "COP"), "Ingresos"]}
                          />
                          <Bar
                            dataKey="revenue"
                            name="Ingresos"
                            fill="var(--color-brand-light)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                            isAnimationActive={!reduced}
                            animationDuration={300}
                            animationEasing="ease-out"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>
              </div>

              <div className="[&>section]:mx-0 [&>section]:mt-0">
                <ChartCard
                  icon={Users}
                  accent="var(--color-brand-light)"
                  title="Altas y clientes que pagan"
                  subtitle="Registros nuevos frente a primeros pagos"
                >
                  {noSignups ? (
                    <ChartEmpty>Aún no hay registros en este periodo</ChartEmpty>
                  ) : (
                    <div className="h-56 w-full" role="img" aria-label={`Registros nuevos y clientes nuevos que pagan, últimos ${period} meses`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={(_, p) => (p?.[0]?.payload?.month ? longMonth(p[0].payload.month) : "")}
                          />
                          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
                          <Line
                            type="monotone"
                            dataKey="new_signups"
                            name="Registros nuevos"
                            stroke="var(--color-text-muted)"
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={{ r: 3 }}
                            isAnimationActive={!reduced}
                            animationDuration={300}
                          />
                          <Line
                            type="monotone"
                            dataKey="new_paying"
                            name="Nuevos que pagan"
                            stroke="var(--color-brand-light)"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            isAnimationActive={!reduced}
                            animationDuration={300}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>
              </div>
            </ResponsiveGrid>
          </section>

          <section aria-labelledby="serie-title" className="flex flex-col gap-3">
            <h2 id="serie-title" className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp size={15} aria-hidden /> Detalle por mes
            </h2>
            <DataTable
              caption="Ingresos y clientes por mes"
              rows={[...rows].reverse()}
              getRowKey={(r) => r.month}
              mobileClassName="flex flex-col gap-2"
              columns={[
                { key: "month", header: "Mes", cell: (r) => <span>{longMonth(r.month)}</span> },
                { key: "rev", header: "Ingresos", align: "right", cell: (r) => formatAmount(r.revenue, "COP") },
                { key: "pay", header: "Pagos aprobados", align: "right", cell: (r) => r.approved_payments },
                { key: "sig", header: "Registros", align: "right", cell: (r) => r.new_signups },
                { key: "np", header: "Nuevos que pagan", align: "right", cell: (r) => r.new_paying },
                { key: "ts", header: "Pruebas", align: "right", cell: (r) => r.trials_started },
                { key: "tc", header: "Convertidas", align: "right", cell: (r) => r.trials_converted },
                { key: "ex", header: "Vencidos", align: "right", cell: (r) => r.expired },
              ]}
              renderMobile={(r) => (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold">{longMonth(r.month)}</p>
                    <p className="tabular text-sm font-semibold">{formatAmount(r.revenue, "COP")}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>
                      Pagos: <strong className="tabular text-[var(--color-text)]">{r.approved_payments}</strong>
                    </span>
                    <span>
                      Registros: <strong className="tabular text-[var(--color-text)]">{r.new_signups}</strong>
                    </span>
                    <span>
                      Nuevos que pagan: <strong className="tabular text-[var(--color-text)]">{r.new_paying}</strong>
                    </span>
                    <span>
                      Vencidos: <strong className="tabular text-[var(--color-text)]">{r.expired}</strong>
                    </span>
                    <span className="col-span-2">
                      Pruebas: <strong className="tabular text-[var(--color-text)]">{r.trials_started}</strong>, convertidas:{" "}
                      <strong className="tabular text-[var(--color-text)]">{r.trials_converted}</strong>
                    </span>
                  </div>
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}
