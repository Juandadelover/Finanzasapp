"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Ban, Receipt, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { PAYMENT_LABELS, ReceiptImage } from "@/components/pos/ReceiptImage";
import { VoidSaleSheet } from "@/components/pos/VoidSaleSheet";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import { inventoryErrorMessage } from "@/lib/inventory/api";
import { getSale } from "@/lib/pos/api";

type Detail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function qty(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
}

export default function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, hydrated, permissions } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail((await getSale(id)) as Detail | null);
      setLoadError(false);
    } catch (err) {
      toast.error(inventoryErrorMessage(err));
      setLoadError(true);
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    // load() actualiza el estado después de la consulta asíncrona, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const backHref = "/ventas";

  if (!hydrated || !loaded) {
    return (
      <>
        <AppHeader />
        <PageContainer size="narrow">
          <PageHeader title="Venta" backHref={backHref} />
          <SkeletonList count={3} className="mx-4 mt-5" />
        </PageContainer>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <AppHeader />
        <PageContainer size="narrow">
          <PageHeader title="Venta" backHref={backHref} />
          <div className="mx-4 mt-5">
            <EmptyState
              icon={Receipt}
              tone={loadError ? "error" : "empty"}
              title={loadError ? "No pudimos cargar esta venta" : "No encontramos esta venta"}
              description={loadError ? "Revisa tu conexión e inténtalo de nuevo." : undefined}
              action={
                loadError
                  ? {
                      label: "Reintentar",
                      onClick: () => {
                        setLoadError(false);
                        setLoaded(false);
                        void load();
                      },
                    }
                  : { label: "Volver a ventas", href: backHref }
              }
            />
          </div>
        </PageContainer>
      </>
    );
  }

  const { sale, items, payments, contact } = detail;
  const voided = sale.status === "void";
  const discounts = sale.line_discount_total + sale.total_discount;

  return (
    <>
      <AppHeader />
      <PageContainer size="narrow">
        <PageHeader
          title={`Venta #${sale.number}`}
          subtitle={`${dateFmt.format(new Date(sale.created_at))} · ${sale.kind === "credit" ? "Crédito" : "Contado"}`}
          backHref={backHref}
        />
        <div className="mx-4 mt-5 flex flex-col gap-5 pb-24">
          {voided ? (
            <div role="status" className="rounded-2xl border border-[var(--color-expense)]/40 bg-[var(--color-expense)]/10 px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--color-expense)]">Venta anulada</p>
              {sale.void_reason ? <p className="mt-0.5 text-[var(--color-text-muted)]">{sale.void_reason}</p> : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <span className="text-sm text-[var(--color-text-muted)]">Total</span>
            <span className="text-lg font-bold">{money(sale.total)}</span>
          </div>

          {contact ? (
            <p className="text-sm">
              <span className="text-[var(--color-text-muted)]">Cliente: </span>
              <span className="font-medium">{contact.name}</span>
              {contact.phone ? <span className="text-[var(--color-text-muted)]"> · {contact.phone}</span> : null}
            </p>
          ) : null}
          {sale.notes ? <p className="text-sm text-[var(--color-text-muted)]">{sale.notes}</p> : null}

          <ul className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{it.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {qty(it.quantity)} x {money(it.unit_price)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{money(it.line_total)}</span>
              </li>
            ))}
          </ul>

          <dl className="flex flex-col gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Subtotal</dt>
              <dd>{money(sale.subtotal)}</dd>
            </div>
            {discounts > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Descuentos</dt>
                <dd>-{money(discounts)}</dd>
              </div>
            ) : null}
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{PAYMENT_LABELS[p.method] ?? p.method}</dt>
                <dd>{money(p.amount)}</dd>
              </div>
            ))}
            {sale.kind === "credit" ? (
              <div className="flex justify-between font-semibold">
                <dt>Saldo pendiente</dt>
                <dd>{money(sale.balance)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="grid gap-2">
            <Button onClick={() => setReceiptOpen(true)}>
              <ReceiptText size={16} aria-hidden /> Ver comprobante
            </Button>
            {permissions.canVoidSale && !voided ? (
              <Button variant="danger" onClick={() => setVoidOpen(true)}>
                <Ban size={16} aria-hidden /> Anular venta
              </Button>
            ) : null}
          </div>
        </div>
      </PageContainer>
      <ReceiptImage saleId={sale.id} open={receiptOpen} onClose={() => setReceiptOpen(false)} />
      <VoidSaleSheet
        saleId={sale.id}
        number={sale.number}
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onVoided={() => void load()}
      />
    </>
  );
}
