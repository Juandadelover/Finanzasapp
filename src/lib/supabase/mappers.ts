import type {
  Category,
  CategoryIcon,
  CurrencyCode,
  Transaction,
  TransactionType,
  Workspace,
  WorkspaceRole,
} from "@/types/finance";

export interface CategoryRow {
  id: string;
  workspace_id: string;
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
  workspace_id: string;
  created_by: string | null;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  currency: string;
  monthly_budget: number | string | null;
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

export function rowToWorkspace(row: WorkspaceRow, role: WorkspaceRole): Workspace {
  return {
    id: row.id,
    name: row.name,
    role,
    currency: row.currency as CurrencyCode,
    monthlyBudget: row.monthly_budget !== null ? Number(row.monthly_budget) : null,
  };
}
