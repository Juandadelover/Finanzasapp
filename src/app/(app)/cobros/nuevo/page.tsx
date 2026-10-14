"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
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
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

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
      <>
        <PageHeader title="Nuevo documento" backHref="/cobros" backLabel="Cobros" />
        <p className="mx-4 mt-6 rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Tu rol no permite crear cuentas de cobro ni cotizaciones. Pídele al administrador del negocio que lo haga o
          que cambie tu rol.
        </p>
      </>
    );
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspace || saving) return;
    if (!contactId) return void toast.error("Elige un cliente para continuar.");
    if (items.some((i) => !i.description || i.quantity <= 0)) {
      return void toast.error("Cada ítem necesita descripción y cantidad mayor a cero.");
    }
    if (total <= 0) return void toast.error("El total debe ser mayor a cero. Revisa el valor de cada ítem.");
    if (!isQuote && dueDate && dueDate < issueDate) {
      return void toast.error("La fecha límite de pago no puede ser anterior a la fecha del documento.");
    }
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
          toast.error("No hay categoría de ingresos: la cuenta de cobro se creó, pero no aparecerá en Me deben.");
        }
      }
      router.push(`/cobros/${doc.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={isQuote ? "Nueva cotización" : "Nueva cuenta de cobro"}
        backHref="/cobros"
        backLabel="Cobros"
      />
      <form onSubmit={handleSave} className="flex flex-col gap-4 px-4 pb-40 pt-4">
        <label className="block">
          <span className={labelClass}>Cliente</span>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
            <option value="">Selecciona un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clients.length === 0 ? (
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Aún no tienes clientes.{" "}
              <Link
                href="/contactos"
                className="font-medium text-[var(--color-brand-light)] underline underline-offset-2"
              >
                Agrégalos en Contactos
              </Link>
              .
            </p>
          ) : null}
        </label>

        <div className={isQuote ? "" : "grid grid-cols-2 gap-3"}>
          <label className="block">
            <span className={labelClass}>Fecha</span>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputClass}
            />
          </label>
          {!isQuote ? (
            <label className="block">
              <span className={labelClass}>Fecha límite de pago</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </label>
          ) : null}
        </div>

        <div role="group" aria-label="Ítems">
          <p className={labelClass}>Ítems</p>
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
                  aria-label={`Descripción del ítem ${rows.indexOf(r) + 1}`}
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
                    className={`${inputClass} !w-20 shrink-0`}
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
                    aria-label={`Quitar ítem ${rows.indexOf(r) + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setRows((rs) => [...rs, { key: nextKey, description: "", quantity: "1", unitPrice: 0 }]);
              setNextKey((k) => k + 1);
            }}
            className="mt-2 text-[var(--color-brand-light)]"
          >
            <Plus size={16} aria-hidden /> Agregar ítem
          </Button>
        </div>

        <label className="block">
          <span className={labelClass}>Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Datos de pago, condiciones, etc."
            className={inputClass}
          />
        </label>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-text-muted)]">Total</p>
            <p className="truncate text-lg font-bold tabular-nums">{formatAmount(total, currency)}</p>
          </div>
          <Button type="submit" loading={saving} size="lg" className="shrink-0 px-6">
            {saving ? "Guardando..." : isQuote ? "Guardar cotización" : "Guardar cuenta"}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NuevoCobroPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-4 mt-6 h-40 rounded-3xl" />}>
      <NuevoForm />
    </Suspense>
  );
}
