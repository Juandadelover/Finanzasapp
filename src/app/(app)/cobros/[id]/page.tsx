"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, FileCheck, FileX, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { formatAmount, toISODate } from "@/lib/format";
import {
  convertQuoteToCollection,
  formatDocNumber,
  getDocument,
  setDocumentTransaction,
  STATUS_CHIP,
  STATUS_LABELS,
  updateDocumentStatus,
  whatsappNumber,
  type CollectionDocumentWithItems,
} from "@/lib/documents";

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso + "T00:00:00"),
  );
}

export default function CobroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentWorkspace, state, permissions, addTransaction } = useFinance();
  const [doc, setDoc] = useState<CollectionDocumentWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
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

  if (loading) {
    return (
      <div role="status">
        <span className="sr-only">Cargando documento…</span>
        <PageHeader title="Cobros" backHref="/cobros" backLabel="Cobros" />
        <Skeleton className="mx-4 mt-4 h-96 rounded-2xl" />
      </div>
    );
  }
  if (!doc) {
    return (
      <>
        <PageHeader title="Documento no encontrado" backHref="/cobros" backLabel="Cobros" />
        <div className="mx-4 mt-6">
          <EmptyState
            icon={FileX}
            title="No pudimos abrir este documento"
            description="Puede que se haya eliminado o que no tengas acceso. Vuelve a la lista e inténtalo de nuevo."
          />
          <Link href="/cobros" className={buttonClass({ className: "mt-3 w-full" })}>
            Ir a Cobros
          </Link>
        </div>
      </>
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
      ...current.items.map((i) => `- ${i.description} (${i.quantity} x ${formatAmount(i.unitPrice, currency)})`),
      "",
      `*Total: ${formatAmount(current.total, currency)}*`,
      ...(current.notes ? ["", current.notes] : []),
    ];
    const phone = whatsappNumber(contact?.phone);
    const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleVoid() {
    const ok = await confirm({
      title: "¿Anular este documento?",
      description:
        !isQuote && current.transactionId
          ? "Quedará marcado como anulado. El cobro pendiente en Me deben no se borra: elimínalo desde Movimientos si ya no aplica."
          : "Quedará marcado como anulado y no podrás usarlo para cobrar.",
      confirmLabel: "Anular",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (await updateDocumentStatus(current.id, "void")) setDoc({ ...current, status: "void" });
    } finally {
      setBusy(false);
    }
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
    <div className="pb-28">
      <PageContainer>
      <PageHeader
        className="no-print lg:mx-0 lg:mt-0"
        title={`${isQuote ? "Cotización" : "Cuenta de cobro"} ${formatDocNumber(current.number)}`}
        backHref="/cobros"
        backLabel="Cobros"
        actions={
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP[current.status])}>
            {STATUS_LABELS[current.status]}
          </span>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-6">
      <article
        id="print-area"
        className="mx-4 mt-3 break-words lg:mx-0 lg:w-full lg:max-w-3xl lg:justify-self-center rounded-2xl border border-[#e5e7eb] bg-white p-5 text-[#111827] shadow-sm"
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

      <div className="no-print mx-4 mt-4 flex flex-col gap-2 lg:sticky lg:top-[calc(var(--app-header-h)+1rem)] lg:mx-0 lg:mt-3">
        <Button variant="secondary" fullWidth onClick={() => window.print()} className="bg-[var(--color-surface)]">
          <Printer size={18} aria-hidden /> Descargar PDF
        </Button>
        <Button variant="secondary" fullWidth onClick={shareWhatsApp} className="bg-[var(--color-surface)]">
          <MessageCircle size={18} aria-hidden /> Compartir por WhatsApp
        </Button>
        {canEdit && isQuote && current.status !== "void" ? (
          <Button
            variant="secondary"
            fullWidth
            loading={busy}
            onClick={handleConvert}
            className="bg-[var(--color-surface)]"
          >
            <FileCheck size={18} aria-hidden /> Convertir en cuenta de cobro
          </Button>
        ) : null}
        {canEdit && current.status !== "void" ? (
          <Button variant="danger" fullWidth disabled={busy} onClick={handleVoid}>
            <Ban size={18} aria-hidden /> Anular documento
          </Button>
        ) : null}
      </div>
      </div>
      </PageContainer>
    </div>
  );
}
