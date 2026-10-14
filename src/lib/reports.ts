// Funciones puras de reportes (sin React ni Supabase) para poder probarlas con unit tests.

export type PeriodKey = "month" | "prev-month" | "quarter" | "year" | "custom";

export interface Period {
  key: PeriodKey;
  from: string; // yyyy-MM-dd inclusive
  to: string; // yyyy-MM-dd inclusive
  label: string;
}

export interface ReportTx {
  type: "income" | "expense";
  amount: number;
  categoryId: string;
  date: string;
  status: "paid" | "pending";
}

export interface ReportCategory {
  id: string;
  name: string;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "Este mes" },
  { key: "prev-month", label: "Mes anterior" },
  { key: "quarter", label: "Este trimestre" },
  { key: "year", label: "Este año" },
  { key: "custom", label: "Personalizado" },
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function iso(y: number, m0: number, d: number): string {
  // Date.UTC normaliza desbordes de mes/día.
  const dt = new Date(Date.UTC(y, m0, d));
  return dt.toISOString().slice(0, 10);
}

function parse(isoDate: string): { y: number; m0: number; d: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { y, m0: m - 1, d };
}

function dayDiff(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round((Date.UTC(pb.y, pb.m0, pb.d) - Date.UTC(pa.y, pa.m0, pa.d)) / 86400000);
}

function addDays(isoDate: string, n: number): string {
  const p = parse(isoDate);
  return iso(p.y, p.m0, p.d + n);
}

export function formatDateEs(isoDate: string): string {
  const p = parse(isoDate);
  return `${p.d} ${MONTHS_SHORT[p.m0].toLowerCase()} ${p.y}`;
}

function monthRange(y: number, m0: number): { from: string; to: string } {
  return { from: iso(y, m0, 1), to: iso(y, m0 + 1, 0) };
}

function labelFor(key: PeriodKey, from: string, to: string): string {
  const f = parse(from);
  if (key === "month" || key === "prev-month") return `${MONTHS[f.m0]} de ${f.y}`;
  if (key === "quarter") return `Trimestre ${Math.floor(f.m0 / 3) + 1} de ${f.y}`;
  if (key === "year") return `Año ${f.y}`;
  return `${formatDateEs(from)} al ${formatDateEs(to)}`;
}

/** `today` es yyyy-MM-dd. Para "custom" se usan `customFrom`/`customTo`. */
export function getPeriod(key: PeriodKey, today: string, customFrom?: string, customTo?: string): Period {
  const t = parse(today);
  let from: string;
  let to: string;
  if (key === "month") {
    ({ from, to } = monthRange(t.y, t.m0));
  } else if (key === "prev-month") {
    ({ from, to } = monthRange(t.y, t.m0 - 1));
  } else if (key === "quarter") {
    const q0 = Math.floor(t.m0 / 3) * 3;
    from = iso(t.y, q0, 1);
    to = iso(t.y, q0 + 3, 0);
  } else if (key === "year") {
    from = iso(t.y, 0, 1);
    to = iso(t.y, 12, 0);
  } else {
    from = customFrom || today;
    to = customTo || today;
    if (to < from) [from, to] = [to, from];
  }
  return { key, from, to, label: labelFor(key, from, to) };
}

/** Período equivalente inmediatamente anterior (mes, trimestre, año o misma duración). */
export function previousPeriod(p: Period): Period {
  const f = parse(p.from);
  let from: string;
  let to: string;
  if (p.key === "month" || p.key === "prev-month") {
    ({ from, to } = monthRange(f.y, f.m0 - 1));
  } else if (p.key === "quarter") {
    from = iso(f.y, f.m0 - 3, 1);
    to = iso(f.y, f.m0, 0);
  } else if (p.key === "year") {
    from = iso(f.y - 1, 0, 1);
    to = iso(f.y - 1, 12, 0);
  } else {
    const len = dayDiff(p.from, p.to) + 1;
    to = addDays(p.from, -1);
    from = addDays(p.from, -len);
  }
  return { key: p.key, from, to, label: labelFor(p.key, from, to) };
}

export function inPeriod(date: string, p: { from: string; to: string }): boolean {
  return date >= p.from && date <= p.to;
}

export interface CategoryLine {
  categoryId: string;
  name: string;
  amount: number;
  previous: number;
  share: number; // % del total del período (0-100)
}

export interface IncomeStatement {
  income: CategoryLine[];
  expenses: CategoryLine[];
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  margin: number | null; // % (null si no hay ingresos)
  previous: { totalIncome: number; totalExpenses: number; profit: number; margin: number | null };
}

function sumByCategory(txs: ReportTx[], type: "income" | "expense", p: Period): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.status !== "paid" || t.type !== type || !inPeriod(t.date, p)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return map;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function buildIncomeStatement(
  txs: ReportTx[],
  categories: ReportCategory[],
  period: Period,
  prev: Period = previousPeriod(period)
): IncomeStatement {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const lines = (type: "income" | "expense") => {
    const cur = sumByCategory(txs, type, period);
    const old = sumByCategory(txs, type, prev);
    const total = [...cur.values()].reduce((a, b) => a + b, 0);
    const ids = new Set([...cur.keys(), ...old.keys()]);
    const result: CategoryLine[] = [...ids].map((id) => ({
      categoryId: id,
      name: names.get(id) ?? "Sin categoría",
      amount: cur.get(id) ?? 0,
      previous: old.get(id) ?? 0,
      share: total > 0 ? ((cur.get(id) ?? 0) / total) * 100 : 0,
    }));
    return result.sort((a, b) => b.amount - a.amount || b.previous - a.previous);
  };
  const income = lines("income");
  const expenses = lines("expense");
  const sum = (l: CategoryLine[], k: "amount" | "previous") => l.reduce((a, b) => a + b[k], 0);
  const totalIncome = sum(income, "amount");
  const totalExpenses = sum(expenses, "amount");
  const pIncome = sum(income, "previous");
  const pExpenses = sum(expenses, "previous");
  const profit = totalIncome - totalExpenses;
  const pProfit = pIncome - pExpenses;
  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    profit,
    margin: totalIncome > 0 ? (profit / totalIncome) * 100 : null,
    previous: {
      totalIncome: pIncome,
      totalExpenses: pExpenses,
      profit: pProfit,
      margin: pIncome > 0 ? (pProfit / pIncome) * 100 : null,
    },
  };
}

export interface CashFlowMonth {
  key: string; // yyyy-MM
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  balance: number; // acumulado dentro del período
}

export interface CashFlow {
  months: CashFlowMonth[];
  totalInflow: number;
  totalOutflow: number;
  net: number;
  receivable: number; // por cobrar (ingresos pendientes del período)
  payable: number; // por pagar (gastos pendientes del período)
}

export function buildCashFlow(txs: ReportTx[], period: Period): CashFlow {
  const start = parse(period.from);
  const end = parse(period.to);
  const months: CashFlowMonth[] = [];
  const index = new Map<string, CashFlowMonth>();
  let y = start.y;
  let m0 = start.m0;
  while (y < end.y || (y === end.y && m0 <= end.m0)) {
    const key = `${y}-${String(m0 + 1).padStart(2, "0")}`;
    const row: CashFlowMonth = { key, label: `${MONTHS_SHORT[m0]} ${y}`, inflow: 0, outflow: 0, net: 0, balance: 0 };
    months.push(row);
    index.set(key, row);
    m0++;
    if (m0 > 11) {
      m0 = 0;
      y++;
    }
  }
  let receivable = 0;
  let payable = 0;
  for (const t of txs) {
    if (!inPeriod(t.date, period)) continue;
    if (t.status === "pending") {
      if (t.type === "income") receivable += t.amount;
      else payable += t.amount;
      continue;
    }
    const row = index.get(t.date.slice(0, 7));
    if (!row) continue;
    if (t.type === "income") row.inflow += t.amount;
    else row.outflow += t.amount;
  }
  let acc = 0;
  for (const r of months) {
    r.net = r.inflow - r.outflow;
    acc += r.net;
    r.balance = acc;
  }
  const totalInflow = months.reduce((a, r) => a + r.inflow, 0);
  const totalOutflow = months.reduce((a, r) => a + r.outflow, 0);
  return { months, totalInflow, totalOutflow, net: totalInflow - totalOutflow, receivable, payable };
}

// ---------- CSV (Excel es-CO: separador ";" y BOM UTF-8) ----------

export const CSV_BOM = "﻿";

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return CSV_BOM + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function pctText(v: number | null): string {
  return v === null ? "" : v.toFixed(1).replace(".", ",") + "%";
}

export function incomeStatementCsv(business: string, period: Period, prev: Period, s: IncomeStatement) {
  const rows: (string | number | null)[][] = [
    ["Estado de resultados"],
    ["Negocio", business],
    ["Período", period.label, `${period.from} a ${period.to}`],
    ["Comparado con", prev.label],
    ["Solo movimientos pagados"],
    [],
    ["Concepto", "Período", "Período anterior", "Variación", "Variación %"],
  ];
  const section = (title: string, lines: CategoryLine[], total: number, prevTotal: number) => {
    rows.push([title]);
    for (const l of lines) {
      rows.push([l.name, l.amount, l.previous, l.amount - l.previous, pctText(pctChange(l.amount, l.previous))]);
    }
    rows.push([`Total ${title.toLowerCase()}`, total, prevTotal, total - prevTotal, pctText(pctChange(total, prevTotal))]);
  };
  section("Ingresos", s.income, s.totalIncome, s.previous.totalIncome);
  section("Gastos", s.expenses, s.totalExpenses, s.previous.totalExpenses);
  rows.push(["Ganancia", s.profit, s.previous.profit, s.profit - s.previous.profit, pctText(pctChange(s.profit, s.previous.profit))]);
  rows.push(["Margen de ganancia", pctText(s.margin), pctText(s.previous.margin)]);
  return toCsv(rows);
}

export function cashFlowCsv(business: string, period: Period, c: CashFlow) {
  const rows: (string | number | null)[][] = [
    ["Flujo de caja"],
    ["Negocio", business],
    ["Período", period.label, `${period.from} a ${period.to}`],
    ["Solo movimientos pagados"],
    [],
    ["Mes", "Entradas", "Salidas", "Neto", "Saldo acumulado"],
    ...c.months.map((m) => [m.label, m.inflow, m.outflow, m.net, m.balance]),
    ["Total", c.totalInflow, c.totalOutflow, c.net, ""],
    [],
    ["Pendientes del período"],
    ["Te deben (pendiente)", c.receivable],
    ["Debes (pendiente)", c.payable],
  ];
  return toCsv(rows);
}
