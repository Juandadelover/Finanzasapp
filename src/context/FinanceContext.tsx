"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchIsPlatformAdmin, toastDbError } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";
import {
  rowToAccount,
  rowToCategory,
  rowToContact,
  rowToTransaction,
  rowToTransfer,
  rowToWorkspace,
} from "@/lib/supabase/mappers";
import type {
  AccountRow,
  CategoryRow,
  ContactRow,
  TransactionRow,
  TransferRow,
  WorkspaceRow,
} from "@/lib/supabase/mappers";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { permissionsFor } from "@/lib/permissions";
import type { Permissions } from "@/lib/permissions";
import type {
  Account,
  Category,
  Contact,
  FinanceState,
  Transaction,
  TransactionStatus,
  TransactionType,
  TaxRegime,
  Transfer,
  Workspace,
  WorkspaceRole,
} from "@/types/finance";

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  accountId: string | null;
  contactId: string | null;
  status: TransactionStatus;
  dueDate: string | null;
}

export type NewAccountInput = Pick<Account, "name" | "kind" | "openingBalance">;
export type NewContactInput = Pick<Contact, "kind" | "name"> &
  Partial<Pick<Contact, "document" | "email" | "phone" | "notes">>;
export type NewTransferInput = Omit<Transfer, "id">;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface FinanceContextValue {
  user: AuthUser | null;
  state: FinanceState;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  updateWorkspace: (
    id: string,
    input: { name: string; document: string | null; taxRegime: TaxRegime }
  ) => Promise<boolean>;
  permissions: Permissions;
  hydrated: boolean;
  selectedYear: number;
  selectedMonth: number;
  setSelectedMonth: (year: number, month: number) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  addTransaction: (input: NewTransactionInput) => Promise<Transaction | null>;
  updateTransaction: (id: string, input: NewTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  markTransactionPaid: (id: string, input: { accountId: string; date: string }) => Promise<void>;
  addAccount: (input: NewAccountInput) => Promise<Account | null>;
  updateAccount: (id: string, updates: Partial<Omit<Account, "id">>) => Promise<void>;
  addContact: (input: NewContactInput) => Promise<Contact | null>;
  updateContact: (id: string, updates: Partial<Omit<Contact, "id">>) => Promise<void>;
  addTransfer: (input: NewTransferInput) => Promise<Transfer | null>;
  deleteTransfer: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, "id" | "isDefault">) => Promise<Category | null>;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id">>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  resetAllData: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Vuelve a cargar negocios y datos (p. ej. tras generar recurrentes o aceptar una invitación). */
  reload: () => Promise<void>;
  isPlatformAdmin: boolean;
}

const WORKSPACE_KEY = "finanzasapp:workspace";

function readStoredWorkspace(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspace(id: string) {
  try {
    localStorage.setItem(WORKSPACE_KEY, id);
  } catch {
    // localStorage no disponible (modo privado, etc.): se ignora.
  }
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

type WorkspaceData = Omit<FinanceState, "settings">;

function emptyData(): WorkspaceData {
  return { transactions: [], categories: [], accounts: [], contacts: [], transfers: [] };
}

interface MembershipRow {
  role: WorkspaceRole;
  workspaces: WorkspaceRow | WorkspaceRow[] | null;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<WorkspaceData>(emptyData);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const workspacesRef = useRef<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonthState] = useState(() => new Date().getMonth());

  const loadWorkspaceData = useCallback(
    async (workspaceId: string) => {
      const [categoriesRes, transactionsRes, accountsRes, contactsRes, transfersRes] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("transactions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("date", { ascending: false }),
        supabase
          .from("accounts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("contacts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
        supabase
          .from("transfers")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("date", { ascending: false }),
      ]);

      // Ignora respuestas de un negocio que ya no es el actual.
      if (currentIdRef.current !== workspaceId) return;
      setData({
        categories: ((categoriesRes.data as CategoryRow[] | null) ?? []).map(rowToCategory),
        transactions: ((transactionsRes.data as TransactionRow[] | null) ?? []).map(rowToTransaction),
        accounts: ((accountsRes.data as AccountRow[] | null) ?? []).map(rowToAccount),
        contacts: ((contactsRes.data as ContactRow[] | null) ?? []).map(rowToContact),
        transfers: ((transfersRes.data as TransferRow[] | null) ?? []).map(rowToTransfer),
      });
    },
    [supabase]
  );

  const selectWorkspace = useCallback((id: string | null) => {
    currentIdRef.current = id;
    setCurrentId(id);
  }, []);

  const loadAll = useCallback(
    async (userId: string) => {
      const { data: rows } = await supabase
        .from("memberships")
        .select("role, workspaces(id, name, currency, monthly_budget, document, tax_regime)")
        .eq("user_id", userId);

      const list: Workspace[] = [];
      for (const row of (rows as MembershipRow[] | null) ?? []) {
        const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
        if (ws) list.push(rowToWorkspace(ws, row.role));
      }
      workspacesRef.current = list;
      setWorkspaces(list);

      const wanted = currentIdRef.current ?? readStoredWorkspace();
      const chosen =
        list.find((w) => w.id === wanted) ?? list.find((w) => w.role === "owner") ?? list[0] ?? null;

      selectWorkspace(chosen?.id ?? null);
      if (chosen) {
        storeWorkspace(chosen.id);
        await loadWorkspaceData(chosen.id);
      } else {
        setData(emptyData());
      }
    },
    [supabase, loadWorkspaceData, selectWorkspace]
  );

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (id === currentIdRef.current || !workspaces.some((w) => w.id === id)) return;
      storeWorkspace(id);
      selectWorkspace(id);
      setData(emptyData());
      await loadWorkspaceData(id);
    },
    [workspaces, selectWorkspace, loadWorkspaceData]
  );

  const createWorkspace = useCallback(
    async (name: string): Promise<Workspace | null> => {
      if (!user) return null;
      const { data: row, error } = await supabase
        .from("workspaces")
        .insert({ name: name.trim(), owner_id: user.id })
        .select("id")
        .single();
      if (error || !row) {
        toastDbError(error, "No se pudo crear el negocio.");
        return null;
      }
      const id = (row as { id: string }).id;
      storeWorkspace(id);
      selectWorkspace(id);
      setData(emptyData());
      await loadAll(user.id);
      return workspacesRef.current.find((w) => w.id === id) ?? null;
    },
    [supabase, user, selectWorkspace, loadAll]
  );

  const updateWorkspace = useCallback(
    async (id: string, input: { name: string; document: string | null; taxRegime: TaxRegime }) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: input.name.trim(), document: input.document, tax_regime: input.taxRegime })
        .eq("id", id);
      if (error) {
        toastDbError(error, "No se pudieron guardar los datos del negocio.");
        return false;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, name: input.name.trim(), document: input.document, taxRegime: input.taxRegime } : w
        )
      );
      return true;
    },
    [supabase]
  );

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? null,
    [workspaces, currentId]
  );

  const permissions = useMemo(() => permissionsFor(currentWorkspace?.role ?? null), [currentWorkspace]);

  const state = useMemo<FinanceState>(
    () => ({
      ...data,
      settings: currentWorkspace
        ? { currency: currentWorkspace.currency, monthlyBudget: currentWorkspace.monthlyBudget }
        : DEFAULT_SETTINGS,
    }),
    [data, currentWorkspace]
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
        setWorkspaces([]);
        selectWorkspace(null);
        setData(emptyData());
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, applyUser, loadAll, selectWorkspace]);

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
      if (!currentId) return null;
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          workspace_id: currentId,
          type: input.type,
          amount: input.amount,
          category_id: input.categoryId,
          description: input.description,
          date: input.date,
          account_id: input.accountId,
          contact_id: input.contactId,
          status: input.status,
          due_date: input.status === "pending" ? input.dueDate : null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo guardar el movimiento", error);
        toastDbError(error, "No se pudo guardar el movimiento. Revisa tu conexión e intenta de nuevo.");
        return null;
      }
      const transaction = rowToTransaction(data as TransactionRow);
      setData((prev) => ({ ...prev, transactions: [transaction, ...prev.transactions] }));
      return transaction;
    },
    [supabase, currentId]
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
          account_id: input.accountId,
          contact_id: input.contactId,
          status: input.status,
          due_date: input.status === "pending" ? input.dueDate : null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar el movimiento", error);
        toastDbError(error, "No se pudo actualizar el movimiento. Intenta de nuevo.");
        return;
      }
      const transaction = rowToTransaction(data as TransactionRow);
      setData((prev) => ({
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
        toastDbError(error, "No se pudo eliminar el movimiento. Intenta de nuevo.");
        return;
      }
      setData((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
    },
    [supabase]
  );

  const markTransactionPaid = useCallback(
    async (id: string, input: { accountId: string; date: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update({ status: "paid", account_id: input.accountId, date: input.date, due_date: null })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo marcar como pagado", error);
        toastDbError(error, "No se pudo marcar como pagado. Intenta de nuevo.");
        return;
      }
      const transaction = rowToTransaction(data as TransactionRow);
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? transaction : t)),
      }));
    },
    [supabase]
  );

  const addAccount = useCallback(
    async (input: NewAccountInput) => {
      if (!currentId) return null;
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          workspace_id: currentId,
          name: input.name,
          kind: input.kind,
          opening_balance: input.openingBalance,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo crear la cuenta", error);
        toastDbError(error, "No se pudo crear la cuenta. Intenta de nuevo.");
        return null;
      }
      const account = rowToAccount(data as AccountRow);
      setData((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
      return account;
    },
    [supabase, currentId]
  );

  const updateAccount = useCallback(
    async (id: string, updates: Partial<Omit<Account, "id">>) => {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.kind !== undefined ? { kind: updates.kind } : {}),
          ...(updates.openingBalance !== undefined ? { opening_balance: updates.openingBalance } : {}),
          ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar la cuenta", error);
        toastDbError(error, "No se pudo actualizar la cuenta. Intenta de nuevo.");
        return;
      }
      const account = rowToAccount(data as AccountRow);
      setData((prev) => ({ ...prev, accounts: prev.accounts.map((a) => (a.id === id ? account : a)) }));
    },
    [supabase]
  );

  const addContact = useCallback(
    async (input: NewContactInput) => {
      if (!currentId) return null;
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          workspace_id: currentId,
          kind: input.kind,
          name: input.name,
          document: input.document ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo crear el contacto", error);
        toastDbError(error, "No se pudo crear el contacto. Intenta de nuevo.");
        return null;
      }
      const contact = rowToContact(data as ContactRow);
      setData((prev) => ({ ...prev, contacts: [...prev.contacts, contact] }));
      return contact;
    },
    [supabase, currentId]
  );

  const updateContact = useCallback(
    async (id: string, updates: Partial<Omit<Contact, "id">>) => {
      const { data, error } = await supabase
        .from("contacts")
        .update({
          ...(updates.kind !== undefined ? { kind: updates.kind } : {}),
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.document !== undefined ? { document: updates.document } : {}),
          ...(updates.email !== undefined ? { email: updates.email } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
          ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar el contacto", error);
        toastDbError(error, "No se pudo actualizar el contacto. Intenta de nuevo.");
        return;
      }
      const contact = rowToContact(data as ContactRow);
      setData((prev) => ({ ...prev, contacts: prev.contacts.map((c) => (c.id === id ? contact : c)) }));
    },
    [supabase]
  );

  const addTransfer = useCallback(
    async (input: NewTransferInput) => {
      if (!currentId) return null;
      const { data, error } = await supabase
        .from("transfers")
        .insert({
          workspace_id: currentId,
          from_account_id: input.fromAccountId,
          to_account_id: input.toAccountId,
          amount: input.amount,
          date: input.date,
          description: input.description,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo registrar la transferencia", error);
        toastDbError(error, "No se pudo registrar la transferencia. Intenta de nuevo.");
        return null;
      }
      const transfer = rowToTransfer(data as TransferRow);
      setData((prev) => ({ ...prev, transfers: [transfer, ...prev.transfers] }));
      return transfer;
    },
    [supabase, currentId]
  );

  const deleteTransfer = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transfers").delete().eq("id", id);
      if (error) {
        console.error("No se pudo eliminar la transferencia", error);
        toastDbError(error, "No se pudo eliminar la transferencia. Intenta de nuevo.");
        return;
      }
      setData((prev) => ({ ...prev, transfers: prev.transfers.filter((t) => t.id !== id) }));
    },
    [supabase]
  );

  const addCategory = useCallback(
    async (category: Omit<Category, "id" | "isDefault">) => {
      if (!currentId) return null;
      const { data, error } = await supabase
        .from("categories")
        .insert({
          workspace_id: currentId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          type: category.type,
          is_default: false,
          monthly_budget: category.monthlyBudget,
        })
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo crear la categoría", error);
        toastDbError(error, "No se pudo crear la categoría. Intenta de nuevo.");
        return null;
      }
      const newCategory = rowToCategory(data as CategoryRow);
      setData((prev) => ({ ...prev, categories: [...prev.categories, newCategory] }));
      return newCategory;
    },
    [supabase, currentId]
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
          ...(updates.monthlyBudget !== undefined ? { monthly_budget: updates.monthlyBudget } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error("No se pudo actualizar la categoría", error);
        toastDbError(error, "No se pudo actualizar la categoría. Intenta de nuevo.");
        return;
      }
      const category = rowToCategory(data as CategoryRow);
      setData((prev) => ({
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
        toastDbError(error, "No se pudo eliminar la categoría. Intenta de nuevo.");
        return;
      }
      setData((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        transactions: prev.transactions.filter((t) => t.categoryId !== id),
      }));
    },
    [supabase]
  );

  const resetAllData = useCallback(async () => {
    if (!user || !currentId) return;
    const transactionsRes = await supabase.from("transactions").delete().eq("workspace_id", currentId);
    const categoriesRes = transactionsRes.error
      ? null
      : await supabase.from("categories").delete().eq("workspace_id", currentId).eq("is_default", false);
    const budgetsRes = categoriesRes?.error
      ? null
      : await supabase.from("categories").update({ monthly_budget: null }).eq("workspace_id", currentId);

    const error = transactionsRes.error || categoriesRes?.error || budgetsRes?.error;
    if (error) {
      console.error("No se pudieron borrar los datos", error);
      toastDbError(error, "No se pudieron borrar todos los datos. Intenta de nuevo.");
    }
    await loadWorkspaceData(currentId);
  }, [supabase, user, currentId, loadWorkspaceData]);

  const exportData = useCallback(() => {
    return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  }, [state]);

  const importData = useCallback(
    async (json: string) => {
      if (!user || !currentId) return false;
      try {
        const parsed = JSON.parse(json) as Partial<FinanceState>;
        if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.categories)) return false;

        const categoryIdMap = new Map<string, string>();

        for (const category of parsed.categories as Category[]) {
          const { data } = await supabase
            .from("categories")
            .insert({
              workspace_id: currentId,
              name: category.name,
              icon: category.icon,
              color: category.color,
              type: category.type,
              is_default: false,
              monthly_budget: category.monthlyBudget ?? null,
            })
            .select()
            .single();
          if (data) categoryIdMap.set(category.id, (data as CategoryRow).id);
        }

        for (const transaction of parsed.transactions as Transaction[]) {
          const mappedCategoryId = categoryIdMap.get(transaction.categoryId) ?? null;
          await supabase.from("transactions").insert({
            workspace_id: currentId,
            type: transaction.type,
            amount: transaction.amount,
            category_id: mappedCategoryId,
            description: transaction.description,
            date: transaction.date,
          });
        }

        await loadWorkspaceData(currentId);
        return true;
      } catch (error) {
        console.error("No se pudo importar el respaldo", error);
        toastDbError(error, "No se pudo importar el respaldo. Intenta de nuevo.");
        return false;
      }
    },
    [supabase, user, currentId, loadWorkspaceData]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchIsPlatformAdmin(user.id)
      .then((v) => !cancelled && setIsPlatformAdmin(v))
      .catch(() => !cancelled && setIsPlatformAdmin(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const reload = useCallback(async () => {
    if (user) await loadAll(user.id);
  }, [user, loadAll]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      user,
      state,
      workspaces,
      currentWorkspace,
      switchWorkspace,
      createWorkspace,
      updateWorkspace,
      permissions,
      hydrated,
      selectedYear,
      selectedMonth,
      setSelectedMonth,
      goToPreviousMonth,
      goToNextMonth,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      markTransactionPaid,
      addAccount,
      updateAccount,
      addContact,
      updateContact,
      addTransfer,
      deleteTransfer,
      addCategory,
      updateCategory,
      deleteCategory,
      resetAllData,
      exportData,
      importData,
      signOut,
      reload,
      isPlatformAdmin: isPlatformAdmin && !!user,
    }),
    [
      user,
      state,
      workspaces,
      currentWorkspace,
      switchWorkspace,
      createWorkspace,
      updateWorkspace,
      permissions,
      hydrated,
      selectedYear,
      selectedMonth,
      setSelectedMonth,
      goToPreviousMonth,
      goToNextMonth,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      markTransactionPaid,
      addAccount,
      updateAccount,
      addContact,
      updateContact,
      addTransfer,
      deleteTransfer,
      addCategory,
      updateCategory,
      deleteCategory,
      resetAllData,
      exportData,
      importData,
      signOut,
      reload,
      isPlatformAdmin,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance debe usarse dentro de FinanceProvider");
  return ctx;
}
