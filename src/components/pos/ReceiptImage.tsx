"use client";

import { useEffect, useRef, useState } from "react";
import { Download, MessageCircle, Share2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { formatAmount } from "@/lib/format";
import { getSale } from "@/lib/pos/api";
import { inventoryErrorMessage } from "@/lib/inventory/api";

export const RECEIPT_LEGEND = "Comprobante de venta - No es factura electrónica";

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  card: "Tarjeta",
};

type SaleData = Awaited<ReturnType<typeof getSale>>;

const bogotaDate = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function qty(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
}

/** Solo dígitos del teléfono, con el indicativo de Colombia si viene de 10 dígitos. */
function waPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `57${digits}`;
  return digits.length >= 11 ? digits : null;
}

/**
 * Hoja con el tiquete de una venta. Genera un JPG en el navegador (nunca se sube)
 * y lo comparte, descarga o manda por WhatsApp.
 */
export function ReceiptImage({ saleId, open, onClose }: { saleId: string; open: boolean; onClose: () => void }) {
  const { state, currentWorkspace } = useFinance();
  const currency = state.settings.currency;
  const [data, setData] = useState<SaleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getSale(saleId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(inventoryErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [saleId, open]);

  // Genera el JPG cuando el tiquete ya está en el DOM con sus fuentes cargadas.
  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        await document.fonts?.ready;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const node = ticketRef.current;
        if (!node || cancelled) return;
        const { toJpeg } = await import("html-to-image");
        const dataUrl = await toJpeg(node, { quality: 0.95, pixelRatio: 2, backgroundColor: "#ffffff" });
        const b = await (await fetch(dataUrl)).blob();
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setError("No pudimos crear la imagen. Inténtalo de nuevo.");
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setBlob(null);
      setPreviewUrl(null);
    };
  }, [open, data]);

  const fileName = data ? `comprobante-${data.sale.number}.jpg` : "comprobante.jpg";
  const money = (v: number) => formatAmount(v, currency);

  function download() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/jpeg" });
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Venta #${data?.sale.number ?? ""}` });
      } catch {
        // La persona cerró el menú de compartir: no es un error.
      }
      return;
    }
    download();
  }

  const phone = waPhone(data?.contact?.phone);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function whatsapp() {
    if (!phone || !data) return;
    // WhatsApp no recibe imágenes por enlace: se descarga y la persona la adjunta en el chat.
    download();
    const text = encodeURIComponent(`Hola, te comparto el comprobante de tu compra #${data.sale.number}.`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener");
  }

  const sale = data?.sale;
  const credit = sale?.kind === "credit";

  return (
    <BottomSheet isOpen={open} onClose={onClose} title={sale ? `Comprobante #${sale.number}` : "Comprobante"}>
      {error && !data ? (
        <p role="alert" className="text-sm text-[var(--color-expense)]">
          {error}
        </p>
      ) : !data || !sale ? (
        <SkeletonList count={3} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* El tiquete siempre es claro: se ve igual en pantalla y en la imagen. */}
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-[var(--color-border)]">
            <div
              ref={ticketRef}
              style={{ backgroundColor: "#ffffff", color: "#17151c", width: 340, margin: "0 auto", padding: 20, fontSize: 13, lineHeight: 1.4 }}
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{currentWorkspace?.name ?? "Mi negocio"}</p>
                {currentWorkspace?.document ? <p style={{ color: "#5c5868" }}>NIT {currentWorkspace.document}</p> : null}
              </div>
              <div style={{ margin: "12px 0", borderTop: "1px dashed #8b8697" }} />
              <p style={{ fontWeight: 600 }}>Venta #{sale.number}</p>
              <p style={{ color: "#5c5868" }}>{bogotaDate.format(new Date(sale.created_at))}</p>
              <p style={{ color: "#5c5868" }}>{credit ? "A crédito" : "De contado"}</p>
              {data.contact ? (
                <p style={{ marginTop: 4 }}>
                  Cliente: <strong>{data.contact.name}</strong>
                  {data.contact.document ? ` · ${data.contact.document}` : ""}
                </p>
              ) : null}
              <div style={{ margin: "12px 0", borderTop: "1px dashed #8b8697" }} />
              {data.items.map((it) => (
                <div key={it.id} style={{ marginBottom: 8 }}>
                  <p style={{ fontWeight: 600 }}>{it.name}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "#5c5868" }}>
                    <span>
                      {qty(it.quantity)} x {money(it.unit_price)}
                    </span>
                    <span style={{ color: "#17151c" }}>{money(it.quantity * it.unit_price)}</span>
                  </div>
                  {it.line_total !== Math.round(it.quantity * it.unit_price) ? (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#5c5868" }}>
                      <span>Descuento</span>
                      <span>-{money(Math.round(it.quantity * it.unit_price) - it.line_total)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
              <div style={{ margin: "12px 0", borderTop: "1px dashed #8b8697" }} />
              <Row label="Subtotal" value={money(sale.subtotal)} />
              {sale.line_discount_total + sale.total_discount > 0 ? (
                <Row label="Descuentos" value={`-${money(sale.line_discount_total + sale.total_discount)}`} />
              ) : null}
              <Row label="Total" value={money(sale.total)} bold />
              {data.payments.map((p) => (
                <div key={p.id}>
                  <Row label={PAYMENT_LABELS[p.method] ?? p.method} value={money(p.method === "cash" ? p.received : p.amount)} />
                  {p.change > 0 ? <Row label="Vueltas" value={money(p.change)} /> : null}
                </div>
              ))}
              {credit && sale.balance > 0 ? <Row label="Saldo pendiente" value={money(sale.balance)} bold /> : null}
              <div style={{ margin: "12px 0", borderTop: "1px dashed #8b8697" }} />
              <p style={{ textAlign: "center", fontSize: 11, color: "#5c5868" }}>{RECEIPT_LEGEND}</p>
              {sale.status === "void" ? (
                <p style={{ textAlign: "center", marginTop: 6, fontWeight: 700, color: "#dc2626" }}>VENTA ANULADA</p>
              ) : null}
            </div>
          </div>
          {previewUrl ? <span className="sr-only">La imagen del comprobante está lista.</span> : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-expense)]">
              {error}
            </p>
          ) : null}
          <div className="grid gap-2">
            {canShare ? (
              <Button onClick={share} disabled={!blob} loading={!blob && !error}>
                <Share2 size={16} aria-hidden /> Compartir
              </Button>
            ) : null}
            <Button variant={canShare ? "secondary" : "primary"} onClick={download} disabled={!blob}>
              <Download size={16} aria-hidden /> Descargar
            </Button>
            {phone ? (
              <Button variant="secondary" onClick={whatsapp} disabled={!blob}>
                <MessageCircle size={16} aria-hidden /> WhatsApp
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: bold ? 700 : 400, fontSize: bold ? 15 : 13 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
