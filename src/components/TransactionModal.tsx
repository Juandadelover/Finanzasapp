"use client";

import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { haptic } from "@/components/ui/motion";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CategoryPicker } from "@/components/CategoryPicker";
import { CategoryModal } from "@/components/CategoryModal";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";
import { formatAmountInput, parseAmountInput, toISODate } from "@/lib/format";
import { createRecurrence, FREQUENCY_LABEL, type Frequency } from "@/lib/recurrences";
import { toastDbError } from "@/lib/subscription";
import type { CategoryIcon, Transaction, TransactionStatus, TransactionType } from "@/types/finance";

interface TransactionSheetProps {
  type: TransactionType;
  editing: Transaction | null;
  onClose: () => void;
}

function TransactionSheet({ type: initialType, editing, onClose }: TransactionSheetProps) {
  const {
    state,
    permissions,
    currentWorkspace,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    addContact,
    reload,
  } = useFinance();

  const confirm = useConfirm();
  const [type, setType] = useState<TransactionType>(editing?.type ?? initialType);
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.date ?? toISODate(new Date()));
  const [status, setStatus] = useState<TransactionStatus>(editing?.status ?? "paid");
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [contactId, setContactId] = useState<string | null>(editing?.contactId ?? null);
  const [newContact, setNewContact] = useState<{ name: string; phone: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [frequency, setFrequency] = useState<Frequency | "none">("none");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const canRepeat = !editing && permissions.canEditTransactions && !!currentWorkspace;

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

  const canAddContact = permissions.canEditTransactions;

  const categories = useMemo(
    () => state.categories.filter((c) => c.type === type),
    [state.categories, type]
  );

  async function handleSubmit(e: React.FormEvent) {
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

    let resolvedContactId = contactId;
    if (newContact && newContact.name.trim()) {
      setSaving(true);
      const created = await addContact({
        kind: type === "income" ? "client" : "supplier",
        name: newContact.name.trim(),
        phone: newContact.phone.trim() || null,
      });
      setSaving(false);
      if (!created) {
        setError("No se pudo guardar el contacto. Revisa los datos e inténtalo de nuevo.");
        return;
      }
      resolvedContactId = created.id;
    }

    const input = {
      type,
      amount,
      categoryId,
      description: description.trim(),
      date,
      accountId: status === "paid" || accountId ? accountId : null,
      contactId: resolvedContactId,
      status,
      dueDate: status === "pending" && dueDate ? dueDate : null,
    };
    if (!editing && canRepeat && frequency !== "none") {
      if (endDate && endDate < date) {
        setError("La fecha final debe ser posterior a la fecha de inicio.");
        return;
      }
      if (saving || !currentWorkspace) return;
      setSaving(true);
      const { error: dbError } = await createRecurrence({
        workspaceId: currentWorkspace.id,
        type,
        amount,
        categoryId,
        accountId: input.accountId,
        contactId: resolvedContactId,
        description: input.description,
        frequency,
        startDate: date,
        endDate: endDate || null,
        generatedStatus: status,
      });
      if (dbError) {
        setSaving(false);
        toastDbError(dbError, "No se pudo crear el movimiento recurrente.");
        return;
      }
      await reload();
      toast.success("Movimiento recurrente creado.");
      haptic();
      onClose();
      return;
    }
    if (editing) {
      updateTransaction(editing.id, input);
    } else {
      addTransaction(input);
    }
    haptic();
    toast.success(editing ? "Movimiento actualizado." : "Movimiento guardado.");
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    const ok = await confirm({
      title: "¿Eliminar este movimiento?",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    deleteTransaction(editing.id);
    onClose();
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
        <SegmentedControl
          aria-label="Tipo de movimiento"
          value={type}
          onChange={(next) => {
            setType(next);
            setCategoryId(null);
            setContactId(null);
            setNewContact(null);
          }}
          options={[
            { value: "expense", label: "Gasto", indicatorClass: "bg-[var(--color-expense)]", activeClass: "text-white" },
            ...(permissions.canCreateIncome || editing
              ? [{ value: "income" as const, label: "Ingreso", indicatorClass: "bg-[var(--color-income)]", activeClass: "text-white" }]
              : []),
          ]}
        />

        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Monto</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-[var(--color-text-muted)]">$</span>
            <input
              autoFocus
              aria-label="Monto"
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

        <SegmentedControl
          aria-label="Estado del pago"
          value={status}
          onChange={setStatus}
          options={[
            { value: "paid", label: "Pagado", indicatorClass: "gradient-brand", activeClass: "text-white" },
            { value: "pending", label: "Pendiente", indicatorClass: "gradient-brand", activeClass: "text-white" },
          ]}
        />

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
                    "inline-flex min-h-11 items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-[0.96]",
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
          {newContact ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="tx-f1" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                {type === "income" ? "Cliente nuevo" : "Proveedor nuevo"}
              </label>
              <input id="tx-f1"
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Nombre"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
              />
              <input
                type="tel"
                inputMode="tel"
                aria-label="WhatsApp (opcional)"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="WhatsApp (opcional), ej. 300 123 4567"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
              />
              <button
                type="button"
                onClick={() => setNewContact(null)}
                className="min-h-11 self-start text-sm font-medium text-[var(--color-brand-light)] hover:underline"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div>
              {contacts.length > 0 || contactId ? (
                <>
                  <label htmlFor="tx-f1" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                    {type === "income" ? "Cliente (opcional)" : "Proveedor (opcional)"}
                  </label>
                  <select id="tx-f1"
                    value={contactId ?? ""}
                    onChange={(e) => setContactId(e.target.value || null)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
                  >
                    <option value="">Sin contacto</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              {canAddContact ? (
                <button
                  type="button"
                  onClick={() => {
                    setContactId(null);
                    setNewContact({ name: "", phone: "" });
                  }}
                  className="min-h-11 text-sm font-medium text-[var(--color-brand-light)] hover:underline"
                >
                  + {type === "income" ? "Agregar cliente" : "Agregar proveedor"}
                </button>
              ) : null}
            </div>
          )}
          <div>
            <label htmlFor="tx-f2" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Descripción
            </label>
            <input id="tx-f2"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Almuerzo, Uber, Nómina..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
            />
          </div>
          <div>
            <label htmlFor="tx-f3" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Fecha
            </label>
            <input id="tx-f3"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
            />
          </div>
        </div>

        {status === "pending" ? (
          <div>
            <label htmlFor="tx-f4" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Vence (opcional)
            </label>
            <input id="tx-f4"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
            />
          </div>
        ) : null}

        {canRepeat ? (
          <div>
            <label htmlFor="tx-f5" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              <Repeat size={12} /> Repetir
            </label>
            <select id="tx-f5"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency | "none")}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
            >
              <option value="none">No se repite</option>
              {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
            {frequency !== "none" ? (
              <div className="mt-3">
                <label htmlFor="tx-f6" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                  Hasta (opcional)
                </label>
                <input id="tx-f6"
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
                />
                <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
                  Se crea el primero hoy o en la fecha elegida y los siguientes se generan solos.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}

        <div className="flex gap-3 pt-1">
          {editing ? (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Eliminar movimiento"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <Button type="submit" loading={saving} className="flex-1">
            {editing ? "Guardar cambios" : saving ? "Guardando..." : frequency !== "none" && canRepeat ? "Guardar recurrente" : "Guardar movimiento"}
          </Button>
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
