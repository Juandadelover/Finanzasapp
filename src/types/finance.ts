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
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string; // ISO date (yyyy-MM-dd)
  createdAt: string; // ISO datetime
}

export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN" | "ARS" | "PEN" | "CLP";

export interface Settings {
  currency: CurrencyCode;
  monthlyBudget: number | null;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
}

export const STORAGE_KEY = "finanzasapp:v1";
export const STORAGE_VERSION = 1;

export interface PersistedState extends FinanceState {
  version: number;
}
