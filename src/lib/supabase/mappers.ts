import type {
  Account,
  AccountKind,
  Category,
  Contact,
  ContactKind,
  Transfer,
  TransactionStatus,
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
  account_id: string | null;
  contact_id: string | null;
  status: TransactionStatus;
  due_date: string | null;
}

export interface AccountRow {
  id: string;
  workspace_id: string;
  name: string;
  kind: AccountKind;
  opening_balance: number | string;
  archived: boolean;
}

export interface ContactRow {
  id: string;
  workspace_id: string;
  kind: ContactKind;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived: boolean;
}

export interface TransferRow {
  id: string;
  workspace_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number | string;
  date: string;
  description: string;
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
    accountId: row.account_id ?? null,
    contactId: row.contact_id ?? null,
    status: row.status ?? "paid",
    dueDate: row.due_date ?? null,
  };
}

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    openingBalance: Number(row.opening_balance),
    archived: row.archived,
  };
}

export function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    document: row.document,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    archived: row.archived,
  };
}

export function rowToTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: Number(row.amount),
    date: row.date,
    description: row.description,
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
