import type { Transaction } from "@/types/finance";

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Al día",
  d1_30: "1-30",
  d31_60: "31-60",
  d61_90: "61-90",
  d90p: "+90",
};

export const AGING_ORDER: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90p"];

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

/** Positive = days overdue; <= 0 = not overdue (or no due date). */
export function daysOverdue(dueDate: string | null, today: string): number {
  if (!dueDate) return 0;
  return daysBetween(dueDate, today);
}

export function agingBucket(dueDate: string | null, today: string): AgingBucket {
  const d = daysOverdue(dueDate, today);
  if (d <= 0) return "current";
  if (d <= 30) return "d1_30";
  if (d <= 60) return "d31_60";
  if (d <= 90) return "d61_90";
  return "d90p";
}

export function dueLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return "Sin fecha de vencimiento";
  const d = daysOverdue(dueDate, today);
  if (d === 0) return "Vence hoy";
  if (d < 0) {
    const n = -d;
    return `Vence en ${n} ${n === 1 ? "día" : "días"}`;
  }
  return `Vencido hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function pendingTransactions(transactions: Transaction[], type: "income" | "expense"): Transaction[] {
  return transactions.filter((t) => t.status === "pending" && t.type === type);
}

export function sortByDueDate(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.date.localeCompare(b.date);
  });
}

export function sumAmount(list: Transaction[]): number {
  return list.reduce((s, t) => s + t.amount, 0);
}

export function whatsappUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.startsWith("57") && digits.length === 12 ? digits : `57${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}
