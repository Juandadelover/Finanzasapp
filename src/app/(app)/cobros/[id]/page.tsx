"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, FileCheck, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/context/FinanceContext";
import { formatAmount, toISODate } from "@/lib/format";
import {
  convertQuoteToCollection,
  formatDocNumber,
  getDocument,
  setDocumentTransaction,
  STATUS_LABELS,
  updateDocumentStatus,
  whatsappNumber,
  type CollectionDocumentWithItems,
} from "@/lib/documents";

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso + "T00:00:00")
  );
}

const actionClass =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium";

export default function CobroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentWorkspace, state, permissions, addTransaction } = useFinance();
  const [doc, setDoc] = useState<CollectionDocumentWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const currency = currentWorkspace?.currency ?? "COP";

  useEffect(() => {
    let cancelled = false;
    getDocument(id).then((d) => {
      if (cancelled) return;
      setDoc(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="p-8 text-center text-sm text-[var(--color-text-muted)]">Cargando...</p>;
  if (!doc) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
        Documento no encontrado.{" "}
        <Link href="/cobros" className="text-[var(--color-brand)]">
          Volver
        </Link>
      </div>
    );
  }

  const current = doc;
  const contact = state.contacts.find((c) => c.id === current.contactId) ?? null;
  const isQuote = current.kind === "quote";
  const title = `${isQuote ? "COTIZACIÓN" : "CUENTA DE COBRO"} ${formatDocNumber(current.number)}`;
  const canEdit = permissions.canEditTransactions;

  function shareWhatsApp() {
    const lines = [
      `*${title}*`,
      `${currentWorkspace?.name ?? ""}`,
      `Fecha: ${longDate(current.issueDate)}`,
      ...(current.dueDate && !isQuote ? [`Vence: ${longDate(current.dueDate)}`] : []),
      "",
      ...current.items.map(
        (i) => `- ${i.description} (${i.quantity} x ${formatAmount(i.unitPrice, currency)})`
      ),
      "",
      `*Total: ${formatAmount(current.total, currency)}*`,
      ...(current.notes ? ["", current.notes] : []),
    ];
    const phone = whatsappNumber(contact?.phone);
    const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleVoid() {
    if (!window.confirm("¿Marcar este documento como anulado?")) return;
    setBusy(true);
    if (await updateDocumentStatus(current.id, "void")) setDoc({ ...current, status: "void" });
    setBusy(false);
  }

  async function handleConvert() {
    setBusy(true);
    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 15);
    const created = await convertQuoteToCollection(current, toISODate(today), toISODate(due));
    if (created) {
      // Igual que al crear una cuenta de cobro: queda pendiente en "Me deben".
      const category =
        state.categories.find((c) => c.type === "income" && c.name.toLowerCase() === "ventas") ??
        state.categories.find((c) => c.type === "income");
      if (category) {
        const transaction = await addTransaction({
          type: "income",
          amount: created.total,
          categoryId: category.id,
          description: `Cuenta de cobro ${formatDocNumber(created.number)}`,
          date: created.issueDate,
          accountId: null,
          contactId: created.contactId,
          status: "pending",
          dueDate: created.dueDate,
        });
        if (transaction) await setDocumentTransaction(created.id, transaction.id);
      }
    }
    setBusy(false);
    if (created) {
      toast.success("Cuenta de cobro creada.");
      router.push(`/cobros/${created.id}`);
    }
  }

  return (
    <div className="px-4 pb-28 pt-4">
      <div className="no-print mb-3 flex items-center gap-2">
        <Link href="/cobros" aria-label="Volver" className="rounded-full p-2 hover:bg-[var(--color-surface-2)]">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold">{title}</h1>
        <span className="ml-auto rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-medium">
          {STATUS_LABELS[current.status]}
        </span>
      </div>

      <article
        id="print-area"
        className="rounded-2xl border border-[#e5e7eb] bg-white p-5 text-[#111827] shadow-sm"
      >
        <header className="border-b border-[#e5e7eb] pb-4">
          <p className="text-lg font-bold">{currentWorkspace?.name}</p>
          <h2 className="mt-3 text-base font-extrabold tracking-wide">{title}</h2>
          <p className="text-sm text-[#4b5563]">{longDate(current.issueDate)}</p>
          {current.status === "void" ? (
            <p className="mt-2 inline-block rounded border border-red-500 px-2 py-0.5 text-xs font-bold text-red-600">
              ANULADO
            </p>
          ) : null}
        </header>

        <section className="py-4 text-sm">
          <p className="font-semibold">{isQuote ? "Cotización para:" : "Debe a:"}</p>
          {isQuote ? (
            <p className="mt-1">{contact?.name ?? current.contactName ?? "—"}</p>
          ) : (
            <p className="mt-1">{currentWorkspace?.name}</p>
          )}
          <p className="mt-3 font-semibold">{isQuote ? "Presentada por:" : "Cliente:"}</p>
          <p className="mt-1">{isQuote ? currentWorkspace?.name : (contact?.name ?? current.contactName ?? "—")}</p>
          {!isQuote && contact?.document ? <p className="text-[#4b5563]">Documento: {contact.document}</p> : null}
          {isQuote && contact?.document ? <p className="text-[#4b5563]">Cliente doc.: {contact.document}</p> : null}
          {current.dueDate && !isQuote ? (
            <p className="mt-2 text-[#4b5563]">Fecha de pago: {longDate(current.dueDate)}</p>
          ) : null}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[#d1d5db] bg-[#f3f4f6] text-left text-xs uppercase">
                <th className="px-2 py-2">Descripción</th>
                <th className="px-2 py-2 text-right">Cant.</th>
                <th className="px-2 py-2 text-right">Valor unit.</th>
                <th className="px-2 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {current.items.map((i, idx) => (
                <tr key={i.id ?? idx} className="border-b border-[#e5e7eb] align-top">
                  <td className="px-2 py-2">{i.description}</td>
                  <td className="px-2 py-2 text-right">{i.quantity}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{formatAmount(i.unitPrice, currency)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {formatAmount(i.quantity * i.unitPrice, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-right text-base font-extrabold">
          TOTAL: {formatAmount(current.total, currency)} {currency}
        </p>

        {current.notes ? (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Notas</p>
            <p className="whitespace-pre-wrap text-[#374151]">{current.notes}</p>
          </div>
        ) : null}

        <footer className="mt-8 border-t border-[#e5e7eb] pt-3 text-center text-xs text-[#6b7280]">
          Documento sin validez como factura electrónica.
        </footer>
      </article>

      <div className="no-print mt-4 flex flex-col gap-2">
        <button type="button" onClick={() => window.print()} className={actionClass}>
          <Printer size={18} /> Descargar PDF
        </button>
        <button type="button" onClick={shareWhatsApp} className={actionClass}>
          <MessageCircle size={18} /> Compartir por WhatsApp
        </button>
        {canEdit && isQuote && current.status !== "void" ? (
          <button type="button" disabled={busy} onClick={handleConvert} className={actionClass}>
            <FileCheck size={18} /> Convertir en cuenta de cobro
          </button>
        ) : null}
        {canEdit && current.status !== "void" ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleVoid}
            className={`${actionClass} text-red-500`}
          >
            <Ban size={18} /> Marcar como anulada
          </button>
        ) : null}
      </div>
    </div>
  );
}
