import { isSameMonth } from "@/lib/format";
import type { Category, Transaction } from "@/types/finance";

export function transactionsForMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  return transactions
    .filter((t) => isSameMonth(t.date, year, month))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
}

export interface MonthTotals {
  income: number;
  expense: number;
  balance: number;
}

export function computeTotals(transactions: Transaction[]): MonthTotals {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export interface CategoryBreakdownItem {
  category: Category;
  total: number;
  percentage: number;
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: "income" | "expense"
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((t) => t.type === type);
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = new Map<string, number>();
  for (const t of filtered) {
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [categoryId, amount] of byCategory.entries()) {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) continue;
    items.push({
      category,
      total: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    });
  }

  return items.sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
}

export function lastNMonths(
  transactions: Transaction[],
  referenceYear: number,
  referenceMonth: number,
  n: number
): { year: number; month: number }[] {
  const points: { year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(referenceYear, referenceMonth - i, 1);
    points.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return points;
}

export function projectFutureBalance(
  currentBalance: number,
  avgDailyNet: number,
  days: number
): { day: number; balance: number }[] {
  const points: { day: number; balance: number }[] = [];
  const steps = [0, 30, 60, 90].filter((d) => d <= days);
  for (const day of steps) {
    points.push({ day, balance: currentBalance + avgDailyNet * day });
  }
  return points;
}
