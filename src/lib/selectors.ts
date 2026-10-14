import { isSameMonth } from "@/lib/format";
import type { Account, Category, FinanceState, Transaction } from "@/types/finance";

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

// Los movimientos pendientes no afectan saldos, totales, gráficas ni proyecciones.
export function paidOnly(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.status === "paid");
}

export function computeTotals(transactions: Transaction[]): MonthTotals {
  const paid = paidOnly(transactions);
  const income = paid
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = paid
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
  const filtered = paidOnly(transactions).filter((t) => t.type === type);
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

export interface BudgetProgressItem {
  category: Category;
  spent: number;
  budget: number;
}

export function budgetProgress(transactions: Transaction[], categories: Category[]): BudgetProgressItem[] {
  const spentByCategory = new Map<string, number>();
  for (const t of paidOnly(transactions)) {
    if (t.type !== "expense") continue;
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  return categories
    .filter((c): c is Category & { monthlyBudget: number } => c.type === "expense" && Boolean(c.monthlyBudget))
    .map((category) => ({
      category,
      spent: spentByCategory.get(category.id) ?? 0,
      budget: category.monthlyBudget,
    }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);
}

export interface MonthPoint {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  const d = new Date(year, month - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
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

export interface AccountBalance {
  account: Account;
  balance: number;
}

// Saldo inicial + ingresos pagados - gastos pagados + transferencias recibidas - enviadas.
export function accountBalances(state: Pick<FinanceState, "accounts" | "transactions" | "transfers">): AccountBalance[] {
  const balances = new Map<string, number>();
  for (const a of state.accounts) balances.set(a.id, a.openingBalance);

  for (const t of paidOnly(state.transactions)) {
    if (!t.accountId || !balances.has(t.accountId)) continue;
    const delta = t.type === "income" ? t.amount : -t.amount;
    balances.set(t.accountId, (balances.get(t.accountId) ?? 0) + delta);
  }
  for (const tr of state.transfers) {
    if (balances.has(tr.fromAccountId)) balances.set(tr.fromAccountId, (balances.get(tr.fromAccountId) ?? 0) - tr.amount);
    if (balances.has(tr.toAccountId)) balances.set(tr.toAccountId, (balances.get(tr.toAccountId) ?? 0) + tr.amount);
  }

  return state.accounts
    .filter((a) => !a.archived)
    .map((account) => ({ account, balance: balances.get(account.id) ?? 0 }));
}
