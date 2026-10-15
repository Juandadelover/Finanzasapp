"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, FileText, Inbox, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Badge, Initials, PaymentBadge } from "@/components/admin/AdminUI";
import { Button, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/components/admin/shared";
import { cn } from "@/lib/cn";
import {
  approvePayment,
  fetchAdminPayments,
  getReceiptUrl,
  rejectPayment,
  type AdminPayment,
  type PaymentFilter,
} from "@/lib/admin";
import { formatAmount } from "@/lib/format";

const FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "in_review", label: "En revisión" },
  { value: "awaiting_receipt", label: "Esperando comprobante" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
  { value: "all", label: "Todos" },
];

const QUICK_REASONS = ["El pago no llegó", "Monto incorrecto", "Comprobante ilegible"];

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]";

const EMPTY_COPY: Record<PaymentFilter, { icon: typeof Inbox; title: string; description: string }> = {
  in_review: {
    icon: CheckCircle2,
    title: "No hay comprobantes por revisar",
    description: "No hay pagos en esta vista. Cuando un cliente suba un comprobante aparecerá aquí.",
  },
  awaiting_receipt: {
    icon: Clock,
    title: "Nadie está esperando comprobante",
    description: "No hay pagos en esta vista. Aquí verás a quienes iniciaron un pago y aún no lo envían.",
  },
  approved: {
    icon: Receipt,
    title: "Aún no hay pagos aprobados",
    description: "No hay pagos en esta vista. Los pagos que apruebes quedarán aquí.",
  },
  rejected: {
    icon: Inbox,
    title: "No hay pagos rechazados",
    description: "No hay pagos en esta vista. Los pagos que rechaces quedarán aquí con su motivo.",
  },
  all: {
    icon: Inbox,
    title: "Todavía no hay pagos",
    description: "No hay pagos en esta vista. Cuando los clientes paguen aparecerán aquí.",
  },
};

function cycleLabel(c: string): string {
  return c === "annual" ? "anual" : c === "monthly" ? "mensual" : c;
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: AdminPayment[]) {
  const header = "reference,email,plan,ciclo,monto_esperado,monto_declarado,medio,estado,fecha,revisado";
  const lines = rows.map((p) =>
    [
      p.reference,
      p.email,
      p.plan_code,
      p.billing_cycle,
      p.expected_amount,
      p.declared_amount,
      p.channel,
      p.status,
      p.created_at,
      p.reviewed_at,
    ]
      .map(csvCell)
      .join(",")
  );
  const blob = new Blob(["﻿" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ReceiptSheet({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getReceiptUrl(payment.receipt_path ?? "").then((u) => {
      if (!alive) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [payment.receipt_path]);

  const isPdf = (payment.receipt_path ?? "").toLowerCase().endsWith(".pdf");

  return (
    <BottomSheet isOpen onClose={onClose} title="Comprobante">
      {loading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !url ? (
        <p role="alert" className="text-sm text-[var(--color-text-muted)]">
          No se pudo cargar el comprobante. Cierra esta ventana e intenta de nuevo.
        </p>
      ) : isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ fullWidth: true })}
        >
          <FileText size={16} aria-hidden /> Abrir PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Comprobante de pago" className="w-full rounded-xl" />
        </a>
      )}
    </BottomSheet>
  );
}

function RejectSheet({
  payment,
  onClose,
  onDone,
}: {
  payment: AdminPayment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Indica el motivo del rechazo.");
      return;
    }
    setBusy(true);
    const ok = await rejectPayment(payment.id, reason.trim());
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Rechazar pago">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-sm font-medium",
                reason === r
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <label className="block">
          <span className={labelClass}>Motivo (se le muestra al cliente)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Explica por qué se rechaza"
            className={inputClass}
          />
        </label>
        <Button
          type="submit"
          variant="danger"
          loading={busy}
          fullWidth
          className="border-[var(--color-expense)]"
        >
          {busy ? "Rechazando..." : "Rechazar pago"}
        </Button>
      </form>
    </BottomSheet>
  );
}

function Actions({
  p,
  onReceipt,
  onApprove,
  onReject,
  stretch = false,
}: {
  p: AdminPayment;
  onReceipt: () => void;
  onApprove: () => void;
  onReject: () => void;
  stretch?: boolean;
}) {
  const who = p.full_name || p.email || "este cliente";
  const review = p.status === "in_review";
  return (
    <div className={cn("flex flex-wrap gap-2", stretch && "flex-col")}>
      {p.receipt_path ? (
        <Button
          variant={review && stretch ? "secondary" : "ghost"}
          size="sm"
          onClick={onReceipt}
          aria-label={`Ver comprobante de ${who}`}
          className={cn(!stretch && "px-2 underline-offset-2 hover:underline", stretch && "w-full")}
        >
          <FileText size={14} aria-hidden /> Ver comprobante
        </Button>
      ) : null}
      {review ? (
        <div className={cn("flex gap-2", stretch && "w-full")}>
          <Button size="sm" onClick={onApprove} aria-label={`Aprobar pago de ${who}`} className={cn(stretch && "flex-1")}>
            Aprobar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onReject}
            aria-label={`Rechazar pago de ${who}`}
            className={cn(stretch && "flex-1")}
          >
            Rechazar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPagosPage() {
  const [filter, setFilter] = useState<PaymentFilter>("in_review");
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<AdminPayment | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);
  const [confirming, setConfirming] = useState<AdminPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  const load = useCallback(async (f: PaymentFilter) => {
    setLoading(true);
    const data = await fetchAdminPayments(f);
    setFailed(data === null);
    setRows(data ?? []);
    setLoading(false);
    if (f === "in_review") {
      if (data) setPending(data.length);
    } else {
      void fetchAdminPayments("in_review").then((d) => {
        if (d) setPending(d.length);
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(filter);
  }, [filter, load]);

  async function handleApprove() {
    if (!confirming) return;
    setBusy(true);
    const ok = await approvePayment(confirming.id);
    setBusy(false);
    if (ok) {
      setConfirming(null);
      void load(filter);
    }
  }

  const empty = EMPTY_COPY[filter];
  const EmptyIcon = empty.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Filtrar pagos por estado"
          className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 py-1 lg:ml-0 lg:px-0"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-[background-color,color,transform] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]",
                filter === f.value
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {f.label}
              {f.value === "in_review" && pending ? (
                <span className="tabular min-w-5 rounded-full bg-[var(--color-brand)] px-1.5 text-center text-xs font-semibold leading-5 text-white">
                  <span className="sr-only">(</span>
                  {pending}
                  <span className="sr-only"> por revisar)</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!rows || rows.length === 0}
          onClick={() => rows && exportCsv(rows)}
          aria-label="Exportar CSV"
          className="shrink-0"
        >
          <Download size={16} aria-hidden /> <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Cargando pagos...</span>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : failed ? (
        <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">No se pudieron cargar los pagos.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load(filter)}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center">
          <span
            aria-hidden
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)]",
              filter === "in_review" ? "text-[var(--color-income)]" : "text-[var(--color-text-faint)]"
            )}
          >
            <EmptyIcon size={22} />
          </span>
          <p className="text-sm font-semibold">{empty.title}</p>
          <p className="max-w-xs text-xs text-[var(--color-text-muted)]">{empty.description}</p>
          {filter !== "all" ? (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setFilter("all")}>
              Ver todos los pagos
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Pagos de suscripción</caption>
              <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Esperado</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Declarado</th>
                  <th scope="col" className="px-3 py-3 font-medium">Referencia y medio</th>
                  <th scope="col" className="px-3 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((p) => {
                  const mismatch = p.declared_amount != null && p.declared_amount !== p.expected_amount;
                  const name = p.full_name || p.email || "Sin nombre";
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="max-w-[15rem] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Initials name={name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{name}</p>
                            {p.full_name && p.email ? (
                              <p className="truncate text-xs text-[var(--color-text-muted)]">{p.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 capitalize">
                        {p.plan_code} · {cycleLabel(p.billing_cycle)}
                        <p className="text-xs text-[var(--color-text-muted)]">Actual: {p.current_plan ?? "—"}</p>
                      </td>
                      <td className="tabular px-3 py-3 text-right">{formatAmount(p.expected_amount, "COP")}</td>
                      <td className="tabular px-3 py-3 text-right">
                        <span className={cn(mismatch && "font-semibold")}>
                          {p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")}
                        </span>
                        {mismatch ? (
                          <div className="mt-1">
                            <Badge tone="warning">Monto distinto</Badge>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="break-all">{p.reference ?? "—"}</p>
                        <p className="text-xs capitalize text-[var(--color-text-muted)]">{p.channel ?? "—"}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--color-text-muted)]">
                        {fmtDateTime(p.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <PaymentBadge status={p.status} />
                        {p.status === "rejected" && p.rejection_reason ? (
                          <p className="mt-1 max-w-[12rem] text-xs text-[var(--color-text-muted)]">
                            Motivo: {p.rejection_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <Actions
                          p={p}
                          onReceipt={() => setReceipt(p)}
                          onApprove={() => setConfirming(p)}
                          onReject={() => setRejecting(p)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((p) => {
              const mismatch = p.declared_amount != null && p.declared_amount !== p.expected_amount;
              const name = p.full_name || p.email || "Sin nombre";
              return (
                <li key={p.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-center gap-3">
                    <Initials name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {p.full_name && p.email ? `${p.email} · ` : ""}
                        {fmtDateTime(p.created_at)}
                      </p>
                    </div>
                    <PaymentBadge status={p.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[var(--color-border)] pt-3 text-xs">
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Plan</dt>
                      <dd className="font-medium capitalize">
                        {p.plan_code} · {cycleLabel(p.billing_cycle)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Plan actual</dt>
                      <dd className="font-medium capitalize">{p.current_plan ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Esperado</dt>
                      <dd className="tabular font-medium">{formatAmount(p.expected_amount, "COP")}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Declarado</dt>
                      <dd className="tabular flex flex-wrap items-center gap-1.5 font-medium">
                        {p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")}
                        {mismatch ? <Badge tone="warning">Monto distinto</Badge> : null}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--color-text-muted)]">Referencia</dt>
                      <dd className="break-all font-medium">{p.reference ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Medio</dt>
                      <dd className="font-medium capitalize">{p.channel ?? "—"}</dd>
                    </div>
                  </dl>
                  {p.status === "rejected" && p.rejection_reason ? (
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">Motivo: {p.rejection_reason}</p>
                  ) : null}
                  {p.receipt_path || p.status === "in_review" ? (
                    <div className="mt-3">
                      <Actions
                        p={p}
                        stretch
                        onReceipt={() => setReceipt(p)}
                        onApprove={() => setConfirming(p)}
                        onReject={() => setRejecting(p)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {receipt ? <ReceiptSheet payment={receipt} onClose={() => setReceipt(null)} /> : null}
      {rejecting ? (
        <RejectSheet
          payment={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            void load(filter);
          }}
        />
      ) : null}
      {confirming ? (
        <BottomSheet isOpen onClose={() => setConfirming(null)} title="Confirmar aprobación">
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              ¿Aprobar el plan <strong className="capitalize">{confirming.plan_code}</strong> (
              {cycleLabel(confirming.billing_cycle)}) por{" "}
              <strong>{formatAmount(confirming.expected_amount, "COP")}</strong> para{" "}
              {confirming.email ?? confirming.full_name}?
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button className="flex-1" loading={busy} onClick={handleApprove}>
                {busy ? "Aprobando..." : "Aprobar pago"}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
