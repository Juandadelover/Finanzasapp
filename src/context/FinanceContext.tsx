"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { getInitialState, loadState, saveState, clearState } from "@/lib/storage";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/lib/defaults";
import type {
  Category,
  FinanceState,
  Settings,
  Transaction,
  TransactionType,
} from "@/types/finance";

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
}

interface FinanceContextValue {
  state: FinanceState;
  hydrated: boolean;
  selectedYear: number;
  selectedMonth: number;
  setSelectedMonth: (year: number, month: number) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  addTransaction: (input: NewTransactionInput) => void;
  updateTransaction: (id: string, input: NewTransactionInput) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Omit<Category, "id" | "isDefault">) => Category;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id">>) => void;
  deleteCategory: (id: string) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  resetAllData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(getInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonthState] = useState(() => new Date().getMonth());

  useEffect(() => {
    // One-time bootstrap from localStorage: browser storage isn't available during
    // SSR, so the real state is hydrated here right after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  const setSelectedMonth = useCallback((year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonthState(month);
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setSelectedYear((y) => (selectedMonth === 0 ? y - 1 : y));
    setSelectedMonthState((m) => (m === 0 ? 11 : m - 1));
  }, [selectedMonth]);

  const goToNextMonth = useCallback(() => {
    setSelectedYear((y) => (selectedMonth === 11 ? y + 1 : y));
    setSelectedMonthState((m) => (m === 11 ? 0 : m + 1));
  }, [selectedMonth]);

  const addTransaction = useCallback((input: NewTransactionInput) => {
    setState((prev) => ({
      ...prev,
      transactions: [
        ...prev.transactions,
        { ...input, id: uuid(), createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const updateTransaction = useCallback((id: string, input: NewTransactionInput) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, ...input } : t
      ),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const addCategory = useCallback((category: Omit<Category, "id" | "isDefault">) => {
    const newCategory: Category = { ...category, id: uuid(), isDefault: false };
    setState((prev) => ({ ...prev, categories: [...prev.categories, newCategory] }));
    return newCategory;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Omit<Category, "id">>) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
      transactions: prev.transactions.filter((t) => t.categoryId !== id),
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...updates } }));
  }, []);

  const resetAllData = useCallback(() => {
    clearState();
    setState({
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS,
    });
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify({ ...state, version: 1 }, null, 2);
  }, [state]);

  const importData = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as Partial<FinanceState>;
      if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) {
        return false;
      }
      setState({
        transactions: parsed.transactions as Transaction[],
        categories: parsed.categories as Category[],
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      hydrated,
      selectedYear,
      selectedMonth,
      setSelectedMonth,
      goToPreviousMonth,
      goToNextMonth,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      updateSettings,
      resetAllData,
      exportData,
      importData,
    }),
    [
      state,
      hydrated,
      selectedYear,
      selectedMonth,
      setSelectedMonth,
      goToPreviousMonth,
      goToNextMonth,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      updateSettings,
      resetAllData,
      exportData,
      importData,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance debe usarse dentro de FinanceProvider");
  return ctx;
}
