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
import { createClient } from "@/lib/supabase/client";
import { rowToCategory, rowToSettings, rowToTransaction } from "@/lib/supabase/mappers";
import type { CategoryRow, SettingsRow, TransactionRow } from "@/lib/supabase/mappers";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
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

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface FinanceContextValue {
  user: AuthUser | null;
  state: FinanceState;
  hydrated: boolean;
  selectedYear: number;
  selectedMonth: number;
  setSelectedMonth: (year: number, month: number) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  addTransaction: (input: NewTransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: NewTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, "id" | "isDefault">) => Promise<Category | null>;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id">>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetAllData: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function emptyState(): FinanceState {
  return { transactions: [], categories: [], settings: DEFAULT_SETTINGS };
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<FinanceState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonthState] = useState(() => new Date().getMonth());

  const loadAll = useCallback(
    async (userId: string) => {
      const [categoriesRes, transactionsRes, settingsRes] = await Promise.all([
        supabase.from("categories").select("*").order("created_at", { ascending: true }),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      setState({
        categories: ((categoriesRes.data as CategoryRow[] | null) ?? []).map(rowToCategory),
        transactions: ((transactionsRes.data as TransactionRow[] | null) ?? []).map(rowToTransaction),
        settings: settingsRes.data ? rowToSettings(settingsRes.data as SettingsRow) : DEFAULT_SETTINGS,
      });
    },
    [supabase]
  );

  const applyUser = useCallback((authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
    if (!authUser) {
      setUser(null);
      return;
    }
    setUser({
      id: authUser.id,
      email: authUser.email ?? "",
      name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      avatarUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
    });
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      applyUser(data.user);
      if (data.user) {
        await loadAll(data.user.id);
      }
      if (active) setHydrated(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
      if (session?.user) {
        loadAll(session.user.id);
      } else {
        setState(emptyState());
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, applyUser, loadAll]);

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

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: input.type,
          amount: input.amount,
          category_id: input.categoryId,
          description: input.description,
          date: input.date,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo guardar el movimiento", error);
        return;
      }
      const transaction = rowToTransaction(data as TransactionRow);
      setState((prev) => ({ ...prev, transactions: [transaction, ...prev.transactions] }));
    },
    [supabase, user]
  );

  const updateTransaction = useCallback(
    async (id: string, input: NewTransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          type: input.type,
          amount: input.amount,
          category_id: input.categoryId,
          description: input.description,
          date: input.date,
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar el movimiento", error);
        return;
      }
      const transaction = rowToTransaction(data as TransactionRow);
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? transaction : t)),
      }));
    },
    [supabase]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) {
        console.error("No se pudo eliminar el movimiento", error);
        return;
      }
      setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
    },
    [supabase]
  );

  const addCategory = useCallback(
    async (category: Omit<Category, "id" | "isDefault">) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          type: category.type,
          is_default: false,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo crear la categoría", error);
        return null;
      }
      const newCategory = rowToCategory(data as CategoryRow);
      setState((prev) => ({ ...prev, categories: [...prev.categories, newCategory] }));
      return newCategory;
    },
    [supabase, user]
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<Omit<Category, "id">>) => {
      const { data, error } = await supabase
        .from("categories")
        .update({
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
          ...(updates.color !== undefined ? { color: updates.color } : {}),
          ...(updates.type !== undefined ? { type: updates.type } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar la categoría", error);
        return;
      }
      const category = rowToCategory(data as CategoryRow);
      setState((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === id ? category : c)),
      }));
    },
    [supabase]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) {
        console.error("No se pudo eliminar la categoría", error);
        return;
      }
      setState((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        transactions: prev.transactions.filter((t) => t.categoryId !== id),
      }));
    },
    [supabase]
  );

  const updateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            currency: updates.currency ?? state.settings.currency,
            monthly_budget: updates.monthlyBudget ?? state.settings.monthlyBudget,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar la configuración", error);
        return;
      }
      setState((prev) => ({ ...prev, settings: rowToSettings(data as SettingsRow) }));
    },
    [supabase, user, state.settings]
  );

  const resetAllData = useCallback(async () => {
    if (!user) return;
    await supabase.from("transactions").delete().eq("user_id", user.id);
    await supabase.from("categories").delete().eq("user_id", user.id);
    await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, currency: "COP", monthly_budget: null }, { onConflict: "user_id" });
    await loadAll(user.id);
  }, [supabase, user, loadAll]);

  const exportData = useCallback(() => {
    return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  }, [state]);

  const importData = useCallback(
    async (json: string) => {
      if (!user) return false;
      try {
        const parsed = JSON.parse(json) as Partial<FinanceState>;
        if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) return false;

        const categoryIdMap = new Map<string, string>();

        for (const category of parsed.categories as Category[]) {
          const { data } = await supabase
            .from("categories")
            .insert({
              user_id: user.id,
              name: category.name,
              icon: category.icon,
              color: category.color,
              type: category.type,
              is_default: false,
            })
            .select()
            .single();
          if (data) categoryIdMap.set(category.id, (data as CategoryRow).id);
        }

        for (const transaction of parsed.transactions as Transaction[]) {
          const mappedCategoryId = categoryIdMap.get(transaction.categoryId) ?? null;
          await supabase.from("transactions").insert({
            user_id: user.id,
            type: transaction.type,
            amount: transaction.amount,
            category_id: mappedCategoryId,
            description: transaction.description,
            date: transaction.date,
          });
        }

        await loadAll(user.id);
        return true;
      } catch {
        return false;
      }
    },
    [supabase, user, loadAll]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      user,
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
      signOut,
    }),
    [
      user,
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
      signOut,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance debe usarse dentro de FinanceProvider");
  return ctx;
}
