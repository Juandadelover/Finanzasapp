"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/context/FinanceContext";
import { formatAmount, formatAmountInput, parseAmountInput, toISODate } from "@/lib/format";
import {
  computeTotal,
  createDocument,
  formatDocNumber,
  setDocumentTransaction,
  type DocumentItem,
} from "@/lib/documents";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

interface Row {
  key: number;
  description: string;
  quantity: string;
  unitPrice: number;
}

function NuevoForm() {
  const router = useRouter();
  const isQuote = useSearchParams().get("tipo") === "cotizacion";
  const { currentWorkspace, state, permissions, addTransaction } = useFinance();
  const currency = currentWorkspace?.currency ?? "COP";

  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(toISODate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return toISODate(d);
  });
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 1, description: "", quantity: "1", unitPrice: 0 }]);
  const [nextKey, setNextKey] = useState(2);
  const [saving, setSaving] = useState(false);

  const clients = state.contacts.filter((c) => !c.archived && c.kind !== "supplier");
  const items: DocumentItem[] = rows.map((r) => ({
    description: r.description.trim(),
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unitPrice: r.unitPrice,
  }));
  const total = computeTotal(items);

  if (!permissions.canEditTransactions) {
    return (
      <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
        No tienes permiso para crear documentos.
      </div>
    );
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspace || saving) return;
    if (!contactId) return void toast.error("Selecciona un cliente.");
    if (items.some((i) => !i.description || i.quantity <= 0)) {
      return void toast.error("Cada ítem necesita descripción y cantidad mayor a cero.");
    }
    if (total <= 0) return void toast.error("El total debe ser mayor a cero.");
    setSaving(true);
    try {
      const doc = await createDocument({
        workspaceId: currentWorkspace.id,
        kind: isQuote ? "quote" : "collection",
        contactId,
        issueDate,
        dueDate: isQuote ? null : dueDate || null,
        notes: notes.trim(),
        items,
      });
      if (!doc) return;

      if (!isQuote) {
        const category =
          state.categories.find((c) => c.type === "income" && c.name.toLowerCase() === "ventas") ??
          state.categories.find((c) => c.type === "income");
        if (category) {
          const description = `Cuenta de cobro ${formatDocNumber(doc.number)}`;
          const transaction = await addTransaction({
            type: "income",
            amount: total,
            categoryId: category.id,
            description,
            date: issueDate,
            accountId: null,
            contactId,
            status: "pending",
            dueDate: dueDate || null,
          });
          if (transaction) await setDocumentTransaction(doc.id, transaction.id);
        } else {
          toast.error("No hay categoría de ingresos; la cuenta se creó sin movimiento.");
        }
      }
      router.push(`/cobros/${doc.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 px-4 pb-32 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/cobros" aria-label="Volver" className="rounded-full p-2 hover:bg-[var(--color-surface-2)]">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold">{isQuote ? "Nueva cotización" : "Nueva cuenta de cobro"}</h1>
      </div>

      <div>
        <label className={labelClass}>Cliente</label>
        <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {clients.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
            Aún no tienes clientes. Créalos en Contactos.
          </p>
        ) : null}
      </div>

      <div className={isQuote ? "" : "grid grid-cols-2 gap-3"}>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
        </div>
        {!isQuote ? (
          <div>
            <label className={labelClass}>Vence</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Ítems</label>
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <input
                type="text"
                value={r.description}
                maxLength={300}
                onChange={(e) => updateRow(r.key, { description: e.target.value })}
                placeholder="Descripción del servicio o producto"
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.quantity}
                  onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                  aria-label="Cantidad"
                  placeholder="Cant."
                  className={`${inputClass} w-20 shrink-0`}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(r.unitPrice)}
                  onChange={(e) => updateRow(r.key, { unitPrice: parseAmountInput(e.target.value) })}
                  aria-label="Valor unitario"
                  placeholder="Valor unitario"
                  className={inputClass}
                />
                <button
                  type="button"
                  aria-label="Quitar ítem"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="rounded-full p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey, description: "", quantity: "1", unitPrice: 0 }]);
            setNextKey((k) => k + 1);
          }}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)]"
        >
          <Plus size={16} /> Agregar ítem
        </button>
      </div>

      <div>
        <label className={labelClass}>Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Datos de pago, condiciones, etc."
          className={inputClass}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div>
          <p className="text-xs text-[var(--color-text-faint)]">Total</p>
          <p className="text-lg font-bold">{formatAmount(total, currency)}</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="gradient-brand rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function NuevoCobroPage() {
  return (
    <Suspense fallback={null}>
      <NuevoForm />
    </Suspense>
  );
}
