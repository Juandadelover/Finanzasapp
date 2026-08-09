import type { Category, CategoryIcon, CurrencyCode, Settings, Transaction, TransactionType } from "@/types/finance";

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  is_default: boolean;
  monthly_budget: number | string | null;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface SettingsRow {
  user_id: string;
  currency: string;
  monthly_budget: number | null;
  updated_at: string;
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as CategoryIcon,
    color: row.color,
    type: row.type,
    isDefault: row.is_default,
    monthlyBudget: row.monthly_budget !== null ? Number(row.monthly_budget) : null,
  };
}

export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    categoryId: row.category_id ?? "",
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
  };
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
    currency: row.currency as CurrencyCode,
    monthlyBudget: row.monthly_budget,
  };
}
