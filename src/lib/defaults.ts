import type { CurrencyCode, Settings } from "@/types/finance";

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
