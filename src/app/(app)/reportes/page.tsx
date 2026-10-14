"use client";

import { useMemo, useState } from "react";
import { BarChart3, FileSpreadsheet, Lock, Printer } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, toISODate } from "@/lib/format";
import {
  PERIOD_OPTIONS,
  buildCashFlow,
  buildIncomeStatement,
  cashFlowCsv,
  getPeriod,
  incomeStatementCsv,
  pctChange,
  previousPeriod,
  type CategoryLine,
  type PeriodKey,
} from "@/lib/reports";

type Tab = "resultados" | "flujo";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export default function ReportesPage() {
  const { state, hydrated, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const [tab, setTab] = useState<Tab>("resultados");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const today = toISODate(new Date());
  const [customFrom, setCustomFrom] = useState(() => today.slice(0, 8) + "01");
  const [customTo, setCustomTo] = useState(today);

  const period = useMemo(
    () => getPeriod(periodKey, today, customFrom, customTo),
    [periodKey, today, customFrom, customTo]
  );
  const prev = useMemo(() => previousPeriod(period), [period]);
  const statement = useMemo(
    () => buildIncomeStatement(state.transactions, state.categories, period, prev),
    [state.transactions, state.categories, period, prev]
  );
  const cashFlow = useMemo(() => buildCashFlow(state.transactions, period), [state.transactions, period]);

  const business = currentWorkspace?.name ?? "Mi negocio";
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const signedMoney = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency, { signed: true }));
  const pct = (v: number | null) => (hidden || v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  if (currentWorkspace?.role === "recorder") {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-5">
          <EmptyState
            icon={Lock}
            title="Los reportes no están disponibles para tu rol"
            description="Con el rol de Registrador puedes anotar movimientos, pero los reportes financieros los ven el dueño, los administradores, editores y contadores."
          />
        </div>
      </>
    );
  }


  function exportCsv() {
    const base = `${slug(business)}-${tab === "resultados" ? "estado-de-resultados" : "flujo-de-caja"}-${period.from}_${period.to}.csv`;
    downloadCsv(
      base,
      tab === "resultados"
        ? incomeStatementCsv(business, period, prev, statement)
        : cashFlowCsv(business, period, cashFlow)
    );
  }

  const delta = (cur: number, old: number, invert = false) => {
    const d = cur - old;
    const p = pctChange(cur, old);
    const good = invert ? d <= 0 : d >= 0;
    return (
      <span
        className="text-xs"
        style={{ color: d === 0 ? undefined : good ? "var(--color-income)" : "var(--color-expense)" }}
      >
        {signedMoney(d)} {p === null ? "" : `(${hidden ? MASKED_AMOUNT : (p >= 0 ? "+" : "") + p.toFixed(1).replace(".", ",") + "%"})`}
      </span>
    );
  };

  const renderLines = (lines: CategoryLine[], invert: boolean) =>
    lines.length === 0 ? (
      <p className="px-2 py-2 text-sm text-[var(--color-text-faint)]">Sin movimientos pagados en el período.</p>
    ) : (
      lines.map((l) => (
        <div key={l.categoryId} className="report-row flex items-center justify-between gap-3 px-2 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm">{l.name}</span>
            <span className="block text-xs text-[var(--color-text-faint)]">{pct(l.share)} del total</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-medium">{money(l.amount)}</span>
            {delta(l.amount, l.previous, invert)}
          </span>
        </div>
      ))
    );

  const totalRow = (label: string, value: number, old: number, invert = false, strong = false) => (
    <div
      className={cn(
        "report-row flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-2 py-2.5",
        strong && "font-bold"
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-right">
        <span className="block text-sm font-semibold">{money(value)}</span>
        {delta(value, old, invert)}
      </span>
    </div>
  );

  return (
    <>
      <AppHeader />

      <div className="no-print mx-4 mt-4">
        <h1 className="text-xl font-bold">Reportes</h1>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setPeriodKey(o.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                periodKey === o.key
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {periodKey === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">Desde</label>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">Hasta</label>
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className={inputClass} />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex rounded-full bg-[var(--color-surface-2)] p-1">
          {([
            ["resultados", "Estado de resultados"],
            ["flujo", "Flujo de caja"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-medium transition",
                tab === value ? "gradient-brand text-white" : "text-[var(--color-text-muted)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-sm font-semibold transition hover:bg-[var(--color-surface-2)] active:scale-[0.98]"
          >
            <FileSpreadsheet size={16} className="text-[var(--color-brand-light)]" />
            Descargar Excel (CSV)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-sm font-semibold transition hover:bg-[var(--color-surface-2)] active:scale-[0.98]"
          >
            <Printer size={16} className="text-[var(--color-brand-light)]" />
            Descargar PDF
          </button>
        </div>
      </div>

      <div
        id="print-area"
        className="report-print mx-4 mt-4 mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <header className="mb-3">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{business}</p>
          <h2 className="text-lg font-bold">{tab === "resultados" ? "Estado de resultados" : "Flujo de caja"}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {period.label} ({period.from} a {period.to})
          </p>
          {tab === "resultados" ? (
            <p className="text-xs text-[var(--color-text-faint)]">
              Comparado con {prev.label}. Solo movimientos pagados.
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-faint)]">
              Solo movimientos pagados; el saldo acumulado parte de cero al inicio del período.
            </p>
          )}
        </header>

        {tab === "resultados" ? (
          <>
            <h3 className="mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Ingresos</h3>
            {renderLines(statement.income, false)}
            {totalRow("Total ingresos", statement.totalIncome, statement.previous.totalIncome)}

            <h3 className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Gastos</h3>
            {renderLines(statement.expenses, true)}
            {totalRow("Total gastos", statement.totalExpenses, statement.previous.totalExpenses, true)}

            <div className="mt-4">
              {totalRow("Utilidad", statement.profit, statement.previous.profit, false, true)}
              <div className="report-row flex items-center justify-between px-2 py-2.5">
                <span className="text-sm font-semibold">Margen</span>
                <span className="text-right text-sm font-semibold">
                  {pct(statement.margin)}
                  <span className="block text-xs font-normal text-[var(--color-text-faint)]">
                    Anterior: {pct(statement.previous.margin)}
                  </span>
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
                    <th className="px-2 py-2 font-medium">Mes</th>
                    <th className="px-2 py-2 text-right font-medium">Entradas</th>
                    <th className="px-2 py-2 text-right font-medium">Salidas</th>
                    <th className="px-2 py-2 text-right font-medium">Neto</th>
                    <th className="px-2 py-2 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.months.map((m) => (
                    <tr key={m.key} className="report-row border-t border-[var(--color-border)]">
                      <td className="px-2 py-2">{m.label}</td>
                      <td className="px-2 py-2 text-right">{money(m.inflow)}</td>
                      <td className="px-2 py-2 text-right">{money(m.outflow)}</td>
                      <td className="px-2 py-2 text-right" style={{ color: m.net < 0 ? "var(--color-expense)" : undefined }}>
                        {money(m.net)}
                      </td>
                      <td className="px-2 py-2 text-right" style={{ color: m.balance < 0 ? "var(--color-expense)" : undefined }}>
                        {money(m.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="report-row border-t border-[var(--color-border)] font-semibold">
                    <td className="px-2 py-2">Total</td>
                    <td className="px-2 py-2 text-right">{money(cashFlow.totalInflow)}</td>
                    <td className="px-2 py-2 text-right">{money(cashFlow.totalOutflow)}</td>
                    <td className="px-2 py-2 text-right">{money(cashFlow.net)}</td>
                    <td className="px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
              Pendientes del período
            </h3>
            <div className="mt-1 grid grid-cols-2 gap-3 px-2">
              <div className="report-row rounded-xl border border-[var(--color-border)] p-3">
                <span className="block text-xs text-[var(--color-text-faint)]">Por cobrar</span>
                <span className="block text-base font-semibold" style={{ color: "var(--color-income)" }}>
                  {money(cashFlow.receivable)}
                </span>
              </div>
              <div className="report-row rounded-xl border border-[var(--color-border)] p-3">
                <span className="block text-xs text-[var(--color-text-faint)]">Por pagar</span>
                <span className="block text-base font-semibold" style={{ color: "var(--color-expense)" }}>
                  {money(cashFlow.payable)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {state.transactions.length === 0 ? (
        <div className="no-print mx-4 mb-4">
          <EmptyState icon={BarChart3} title="Aún no hay datos" description="Registra movimientos para ver tus reportes." />
        </div>
      ) : null}
    </>
  );
}
