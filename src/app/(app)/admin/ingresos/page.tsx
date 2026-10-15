"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Kpi, Panel } from "@/components/admin/AdminUI";
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

function Zero({ value }: { value: number }) {
  return <span className={value === 0 ? "text-[var(--color-text-faint)]" : undefined}>{value}</span>;
}

function LegendItem({ label, color, dashed }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="20" height="8" aria-hidden>
        <line x1="1" y1="4" x2="19" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function ChartEmpty({ children }: { children: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-4 text-center text-sm text-[var(--color-text-muted)]">
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
  const [hoverBars, setHoverBars] = useState(false);
  const [hoverLines, setHoverLines] = useState(false);
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
  const isCurrent = (r: RevenuePoint) => r.month.slice(0, 7) === currentMonth;
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
            <Kpi
              label="Ingresos del periodo"
              value={formatAmount(totals.revenue, "COP")}
              hint={`Últimos ${period} meses`}
              className="col-span-2 lg:col-span-1"
            />
            <Kpi label="MRR actual" value={formatAmount(metrics?.mrr ?? 0, "COP")} hint="Recurrente al mes" />
            <Kpi label="Clientes nuevos" value={String(totals.signups)} hint={`En ${period} meses`} />
            <Kpi
              label="Conversión prueba a pago"
              value={conversion}
              hint={totals.started > 0 ? `${totals.converted} de ${totals.started} pruebas` : "Sin pruebas en el periodo"}
            />
            <Kpi
              label="Vencidos"
              value={String(totals.expired)}
              hint={totals.expired > 0 ? "Clientes que perdieron el plan" : "Nadie se venció"}
              tone={totals.expired > 0 ? "negative" : "neutral"}
            />
          </div>

          <section aria-label="Gráficas de ingresos">
            <ResponsiveGrid variant="pair">
              <Panel
                id="chart-ingresos"
                icon={BarChart3}
                title="Ingresos por mes"
                description="Pagos aprobados, en pesos colombianos"
              >
                {noRevenue ? (
                  <ChartEmpty>Aún no hay pagos aprobados</ChartEmpty>
                ) : (
                  <div
                    className="h-56 w-full"
                    role="img"
                    aria-label={`Ingresos por mes de los últimos ${period} meses`}
                    onMouseEnter={() => setHoverBars(true)}
                    onMouseLeave={() => setHoverBars(false)}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer={false}>
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
                          active={hoverBars ? undefined : false}
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
              </Panel>

              <Panel
                id="chart-altas"
                icon={Users}
                title="Altas y clientes que pagan"
                description="Registros nuevos frente a primeros pagos"
              >
                {noSignups ? (
                  <ChartEmpty>Aún no hay registros en este periodo</ChartEmpty>
                ) : (
                  <>
                    <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <LegendItem label="Registros nuevos" color="var(--color-text-muted)" dashed />
                      <LegendItem label="Nuevos que pagan" color="var(--color-brand-light)" />
                    </p>
                    <div
                      className="h-48 w-full"
                      role="img"
                      aria-label={`Registros nuevos y clientes nuevos que pagan, últimos ${period} meses`}
                      onMouseEnter={() => setHoverLines(true)}
                      onMouseLeave={() => setHoverLines(false)}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ left: -12, right: 8, top: 8 }} accessibilityLayer={false}>
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
                          <YAxis
                            allowDecimals={false}
                            domain={[0, (max: number) => Math.max(3, Math.ceil(max))]}
                            tickLine={false}
                            axisLine={false}
                            tick={AXIS_TICK}
                          />
                          <Tooltip
                            active={hoverLines ? undefined : false}
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={(_, p) => (p?.[0]?.payload?.month ? longMonth(p[0].payload.month) : "")}
                          />
                          <Line
                            type="monotone"
                            dataKey="new_signups"
                            name="Registros nuevos"
                            stroke="var(--color-text-muted)"
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
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
                            activeDot={{ r: 5 }}
                            isAnimationActive={!reduced}
                            animationDuration={300}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </Panel>
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
                {
                  key: "month",
                  header: "Mes",
                  cell: (r) => (
                    <span className="inline-flex items-center gap-2">
                      {longMonth(r.month)}
                      {isCurrent(r) ? <Badge tone="brand">Actual</Badge> : null}
                    </span>
                  ),
                },
                {
                  key: "rev",
                  header: "Ingresos",
                  align: "right",
                  cell: (r) => (
                    <span className={r.revenue === 0 ? "text-[var(--color-text-faint)]" : "font-medium"}>
                      {formatAmount(r.revenue, "COP")}
                    </span>
                  ),
                },
                { key: "pay", header: "Pagos aprobados", align: "right", cell: (r) => <Zero value={r.approved_payments} /> },
                { key: "sig", header: "Registros", align: "right", cell: (r) => <Zero value={r.new_signups} /> },
                { key: "np", header: "Nuevos que pagan", align: "right", cell: (r) => <Zero value={r.new_paying} /> },
                { key: "ts", header: "Pruebas", align: "right", cell: (r) => <Zero value={r.trials_started} /> },
                { key: "tc", header: "Convertidas", align: "right", cell: (r) => <Zero value={r.trials_converted} /> },
                { key: "ex", header: "Vencidos", align: "right", cell: (r) => <Zero value={r.expired} /> },
              ]}
              renderMobile={(r) => (
                <div
                  className={
                    isCurrent(r)
                      ? "rounded-2xl border border-[color-mix(in_oklab,var(--color-brand)_45%,var(--color-border))] bg-[var(--color-surface)] p-4"
                      : "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {longMonth(r.month)}
                      {isCurrent(r) ? <Badge tone="brand">Actual</Badge> : null}
                    </p>
                    <p
                      className={`tabular text-sm font-semibold ${r.revenue === 0 ? "text-[var(--color-text-faint)]" : ""}`}
                    >
                      {formatAmount(r.revenue, "COP")}
                    </p>
                  </div>
                  <div className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>
                      Pagos: <strong className="text-[var(--color-text)]"><Zero value={r.approved_payments} /></strong>
                    </span>
                    <span>
                      Registros: <strong className="text-[var(--color-text)]"><Zero value={r.new_signups} /></strong>
                    </span>
                    <span>
                      Nuevos que pagan: <strong className="text-[var(--color-text)]"><Zero value={r.new_paying} /></strong>
                    </span>
                    <span>
                      Vencidos: <strong className="text-[var(--color-text)]"><Zero value={r.expired} /></strong>
                    </span>
                    <span className="col-span-2">
                      Pruebas: <strong className="text-[var(--color-text)]"><Zero value={r.trials_started} /></strong>, convertidas:{" "}
                      <strong className="text-[var(--color-text)]"><Zero value={r.trials_converted} /></strong>
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
