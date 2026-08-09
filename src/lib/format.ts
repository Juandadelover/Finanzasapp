import type { CurrencyCode } from "@/types/finance";

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  COP: "es-CO",
  USD: "en-US",
  EUR: "de-DE",
  MXN: "es-MX",
  ARS: "es-AR",
  PEN: "es-PE",
  CLP: "es-CL",
};

const SYMBOL_BY_CURRENCY: Record<CurrencyCode, string> = {
  COP: "$",
  USD: "US$",
  EUR: "€",
  MXN: "MX$",
  ARS: "AR$",
  PEN: "S/",
  CLP: "$",
};

interface FormatOptions {
  signed?: boolean;
  showSymbol?: boolean;
}

export function formatAmount(
  amount: number,
  currency: CurrencyCode = "COP",
  { signed = false, showSymbol = true }: FormatOptions = {}
): string {
  const locale = LOCALE_BY_CURRENCY[currency];
  const symbol = SYMBOL_BY_CURRENCY[currency];
  const rounded = Math.round(Math.abs(amount));
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(rounded);

  const sign = signed ? (amount < 0 ? "-" : amount > 0 ? "+" : "") : "";
  const symbolPart = showSymbol ? `${symbol} ` : "";
  return `${sign}${symbolPart}${number}`;
}

export function formatCompactAmount(amount: number, currency: CurrencyCode = "COP"): string {
  const locale = LOCALE_BY_CURRENCY[currency];
  const symbol = SYMBOL_BY_CURRENCY[currency];
  const formatted = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}${symbol}${formatted}`;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sept", "Oct", "Nov", "Dic",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} de ${year}`;
}

export function monthShortLabel(month: number): string {
  return MONTH_SHORT[month];
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameMonth(isoDate: string, year: number, month: number): boolean {
  const d = new Date(isoDate + "T00:00:00");
  return d.getFullYear() === year && d.getMonth() === month;
}

export function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);
}

export function parseAmountInput(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatAmountInput(value: number): string {
  if (!value) return "";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}
