import type { Category, CurrencyCode, Settings } from "@/types/finance";

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: "cat-comida", name: "Comida", icon: "utensils", color: "#f97316", type: "expense", isDefault: true },
  { id: "cat-transporte", name: "Transporte", icon: "car", color: "#3b82f6", type: "expense", isDefault: true },
  { id: "cat-vivienda", name: "Vivienda", icon: "home", color: "#a855f7", type: "expense", isDefault: true },
  { id: "cat-entretenimiento", name: "Entretenimiento", icon: "film", color: "#ec4899", type: "expense", isDefault: true },
  { id: "cat-salud", name: "Salud", icon: "heart-pulse", color: "#ef4444", type: "expense", isDefault: true },
  { id: "cat-educacion", name: "Educación", icon: "graduation-cap", color: "#06b6d4", type: "expense", isDefault: true },
  { id: "cat-compras", name: "Compras", icon: "shopping-bag", color: "#eab308", type: "expense", isDefault: true },
  { id: "cat-servicios", name: "Servicios", icon: "zap", color: "#84cc16", type: "expense", isDefault: true },
  { id: "cat-suscripciones", name: "Suscripciones", icon: "repeat", color: "#6366f1", type: "expense", isDefault: true },
  { id: "cat-mascotas", name: "Mascotas", icon: "paw-print", color: "#f59e0b", type: "expense", isDefault: true },
  { id: "cat-otros-gasto", name: "Otros", icon: "more-horizontal", color: "#64748b", type: "expense", isDefault: true },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: "cat-salario", name: "Salario", icon: "briefcase", color: "#10b981", type: "income", isDefault: true },
  { id: "cat-freelance", name: "Freelance", icon: "laptop", color: "#14b8a6", type: "income", isDefault: true },
  { id: "cat-inversiones", name: "Inversiones", icon: "trending-up", color: "#22c55e", type: "income", isDefault: true },
  { id: "cat-regalo", name: "Regalo", icon: "gift", color: "#f472b6", type: "income", isDefault: true },
  { id: "cat-ahorros", name: "Ahorros", icon: "piggy-bank", color: "#34d399", type: "income", isDefault: true },
  { id: "cat-otros-ingreso", name: "Otros", icon: "more-horizontal", color: "#64748b", type: "income", isDefault: true },
];

export const DEFAULT_CATEGORIES: Category[] = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

export const DEFAULT_SETTINGS: Settings = {
  currency: "COP",
  monthlyBudget: null,
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  COP: "Peso colombiano (COP)",
  USD: "Dólar estadounidense (USD)",
  EUR: "Euro (EUR)",
  MXN: "Peso mexicano (MXN)",
  ARS: "Peso argentino (ARS)",
  PEN: "Sol peruano (PEN)",
  CLP: "Peso chileno (CLP)",
};
