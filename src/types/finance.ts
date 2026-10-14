export type TransactionType = "income" | "expense";

export type CategoryIcon =
  | "utensils"
  | "car"
  | "home"
  | "film"
  | "heart-pulse"
  | "graduation-cap"
  | "shopping-bag"
  | "zap"
  | "repeat"
  | "more-horizontal"
  | "briefcase"
  | "laptop"
  | "trending-up"
  | "gift"
  | "piggy-bank"
  | "coffee"
  | "bus"
  | "plane"
  | "gamepad"
  | "dumbbell"
  | "wifi"
  | "phone"
  | "paw-print"
  | "shirt"
  | "wallet";

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  type: TransactionType;
  isDefault?: boolean;
  monthlyBudget: number | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string; // ISO date (yyyy-MM-dd)
  createdAt: string; // ISO datetime
  accountId: string | null;
  contactId: string | null;
  status: TransactionStatus;
  dueDate: string | null; // ISO date (yyyy-MM-dd)
}

export type TransactionStatus = "paid" | "pending";

export type AccountKind = "bank" | "cash" | "card" | "wallet";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: number;
  archived: boolean;
}

export type ContactKind = "client" | "supplier" | "both";

export interface Contact {
  id: string;
  kind: ContactKind;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived: boolean;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string; // ISO date (yyyy-MM-dd)
  description: string;
}

export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN" | "ARS" | "PEN" | "CLP";

export interface Settings {
  currency: CurrencyCode;
  monthlyBudget: number | null;
}

export type WorkspaceRole = "owner" | "admin" | "editor" | "accountant" | "recorder";

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  currency: CurrencyCode;
  monthlyBudget: number | null;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  contacts: Contact[];
  transfers: Transfer[];
  settings: Settings;
}

export const STORAGE_KEY = "finanzasapp:v1";
export const STORAGE_VERSION = 1;

export interface PersistedState extends FinanceState {
  version: number;
}
