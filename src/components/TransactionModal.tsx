"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CategoryPicker } from "@/components/CategoryPicker";
import { CategoryModal } from "@/components/CategoryModal";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";
import { formatAmountInput, parseAmountInput, toISODate } from "@/lib/format";
import type { CategoryIcon, Transaction, TransactionStatus, TransactionType } from "@/types/finance";

interface TransactionSheetProps {
  type: TransactionType;
  editing: Transaction | null;
  onClose: () => void;
}

function TransactionSheet({ type: initialType, editing, onClose }: TransactionSheetProps) {
  const { state, permissions, addTransaction, updateTransaction, deleteTransaction, addCategory } =
    useFinance();

  const [type, setType] = useState<TransactionType>(editing?.type ?? initialType);
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.date ?? toISODate(new Date()));
  const [status, setStatus] = useState<TransactionStatus>(editing?.status ?? "paid");
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [contactId, setContactId] = useState<string | null>(editing?.contactId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const accounts = useMemo(() => state.accounts.filter((a) => !a.archived), [state.accounts]);
  const [accountId, setAccountId] = useState<string | null>(
    () => editing?.accountId ?? accounts[0]?.id ?? null
  );

  const contacts = useMemo(
    () =>
      state.contacts.filter(
        (c) =>
          c.id === contactId ||
          (!c.archived && (c.kind === "both" || c.kind === (type === "income" ? "client" : "supplier")))
      ),
    [state.contacts, type, contactId]
  );

  const categories = useMemo(
    () => state.categories.filter((c) => c.type === type),
    [state.categories, type]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }

    if (status === "paid" && accounts.length > 0 && !accountId) {
      setError("Selecciona una cuenta.");
      return;
    }

    const input = {
      type,
      amount,
      categoryId,
      description: description.trim(),
      date,
      accountId: status === "paid" || accountId ? accountId : null,
      contactId,
      status,
      dueDate: status === "pending" && dueDate ? dueDate : null,
    };
    if (editing) {
      updateTransaction(editing.id, input);
    } else {
      addTransaction(input);
    }
    onClose();
  }

  function handleDelete() {
    if (editing) {
      deleteTransaction(editing.id);
      onClose();
    }
  }

  async function handleCreateCategory(data: {
    name: string;
    icon: CategoryIcon;
    color: string;
    type: TransactionType;
    monthlyBudget: number | null;
  }) {
    const created = await addCategory(data);
    setCreatingCategory(false);
    if (created) setCategoryId(created.id);
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar movimiento" : "Nuevo movimiento"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex rounded-full bg-[var(--color-surface-2)] p-1">
          <button
            type="button"
            onClick={() => {
              setType("expense");
              setCategoryId(null);
              setContactId(null);
            }}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition",
              type === "expense" ? "bg-[var(--color-expense)] text-white" : "text-[var(--color-text-muted)]"
            )}
          >
            Gasto
          </button>
          {permissions.canCreateIncome || editing ? (
          <button
            type="button"
            onClick={() => {
              setType("income");
              setCategoryId(null);
              setContactId(null);
            }}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition",
              type === "income" ? "bg-[var(--color-income)] text-white" : "text-[var(--color-text-muted)]"
            )}
          >
            Ingreso
          </button>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Monto</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-[var(--color-text-muted)]">$</span>
            <input
              autoFocus
              inputMode="numeric"
              placeholder="0"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(parseAmountInput(e.target.value))}
              className="w-48 bg-transparent text-center text-4xl font-bold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Categoría
          </label>
          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            onCreateNew={permissions.canManageCategories ? () => setCreatingCategory(true) : undefined}
          />
        </div>

        <div className="flex rounded-full bg-[var(--color-surface-2)] p-1">
          {(["paid", "pending"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-medium transition",
                status === value ? "gradient-brand text-white" : "text-[var(--color-text-muted)]"
              )}
            >
              {value === "paid" ? "Pagado" : "Pendiente"}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Cuenta{status === "pending" ? " (opcional)" : ""}
          </label>
          {accounts.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)]">
              Aún no tienes cuentas.{" "}
              {permissions.canEditTransactions ? (
                <Link href="/cuentas" onClick={onClose} className="font-medium text-[var(--color-brand-light)]">
                  Crear una cuenta
                </Link>
              ) : null}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(status === "pending" && accountId === a.id ? null : a.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    accountId === a.id
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {contacts.length > 0 || contactId ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                {type === "income" ? "Cliente (opcional)" : "Proveedor (opcional)"}
              </label>
              <select
                value={contactId ?? ""}
                onChange={(e) => setContactId(e.target.value || null)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
              >
                <option value="">Sin contacto</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Almuerzo, Uber, Nómina..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </div>
        </div>

        {status === "pending" ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Vence (opcional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}

        <div className="flex gap-3 pt-1">
          {editing ? (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Eliminar movimiento"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <button
            type="submit"
            className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
          >
            {editing ? "Guardar cambios" : "Guardar movimiento"}
          </button>
        </div>
      </form>

      {creatingCategory ? (
        <CategoryModal
          onClose={() => setCreatingCategory(false)}
          editing={null}
          defaultType={type}
          lockType
          onSave={handleCreateCategory}
        />
      ) : null}
    </BottomSheet>
  );
}

export function TransactionModal() {
  const { transactionModal, closeTransactionModal } = useUI();
  if (!transactionModal.isOpen) return null;

  return (
    <TransactionSheet
      key={transactionModal.editing?.id ?? `new-${transactionModal.type}`}
      type={transactionModal.type}
      editing={transactionModal.editing}
      onClose={closeTransactionModal}
    />
  );
}
