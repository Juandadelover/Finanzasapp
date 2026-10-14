"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import { Button, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
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

const STATUS_LABEL: Record<string, string> = {
  in_review: "En revisión",
  awaiting_receipt: "Esperando comprobante",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const QUICK_REASONS = ["El pago no llegó", "Monto incorrecto", "Comprobante ilegible"];

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

const STATUS_CHIP: Record<string, string> = {
  in_review: "bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]",
  awaiting_receipt: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  approved: "bg-[var(--color-income)]/15 text-[var(--color-income)]",
  rejected: "bg-[var(--color-expense)]/15 text-[var(--color-expense)]",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

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
}: {
  p: AdminPayment;
  onReceipt: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const who = p.full_name || p.email || "este cliente";
  return (
    <div className="flex flex-wrap gap-2">
      {p.receipt_path ? (
        <Button variant="secondary" size="sm" onClick={onReceipt} aria-label={`Ver comprobante de ${who}`}>
          Ver comprobante
        </Button>
      ) : null}
      {p.status === "in_review" ? (
        <>
          <Button size="sm" onClick={onApprove} aria-label={`Aprobar pago de ${who}`}>
            Aprobar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onReject}
            aria-label={`Rechazar pago de ${who}`}
            className="border-[var(--color-expense)]"
          >
            Rechazar
          </Button>
        </>
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

  const load = useCallback(async (f: PaymentFilter) => {
    setLoading(true);
    const data = await fetchAdminPayments(f);
    setFailed(data === null);
    setRows(data ?? []);
    setLoading(false);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div role="group" aria-label="Filtrar pagos por estado" className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition",
                filter === f.value
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!rows || rows.length === 0}
          onClick={() => rows && exportCsv(rows)}
          className="shrink-0"
        >
          <Download size={14} aria-hidden /> <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sr-only sm:hidden">Exportar CSV</span>
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
        <EmptyState
          icon={Inbox}
          title="No hay pagos en esta vista"
          description={filter === "in_review" ? "Cuando un cliente suba un comprobante aparecerá aquí." : "Prueba con otro filtro."}
        />
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
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="max-w-[14rem] px-4 py-3">
                        <p className="truncate font-medium">{p.full_name || p.email || "Sin nombre"}</p>
                        {p.full_name && p.email ? (
                          <p className="truncate text-xs text-[var(--color-text-muted)]">{p.email}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 capitalize">
                        {p.plan_code} · {cycleLabel(p.billing_cycle)}
                        <p className="text-xs text-[var(--color-text-muted)]">Actual: {p.current_plan ?? "—"}</p>
                      </td>
                      <td className="tabular px-3 py-3 text-right">{formatAmount(p.expected_amount, "COP")}</td>
                      <td className={cn("tabular px-3 py-3 text-right", mismatch && "font-semibold text-[var(--color-expense)]")}>
                        {p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")}
                        {mismatch ? <p className="text-xs font-normal">No coincide</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="break-all">{p.reference ?? "—"}</p>
                        <p className="text-xs capitalize text-[var(--color-text-muted)]">{p.channel ?? "—"}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--color-text-muted)]">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP[p.status])}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                        {p.status === "rejected" && p.rejection_reason ? (
                          <p className="mt-1 max-w-[12rem] text-xs text-[var(--color-expense)]">Motivo: {p.rejection_reason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
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
              return (
                <li key={p.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.full_name || p.email || "Sin nombre"}</p>
                      {p.full_name && p.email ? (
                        <p className="truncate text-xs text-[var(--color-text-muted)]">{p.email}</p>
                      ) : null}
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP[p.status])}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
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
                      <dd className={cn("tabular font-medium", mismatch && "text-[var(--color-expense)]")}>
                        {p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")}
                        {mismatch ? " (no coincide)" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Referencia</dt>
                      <dd className="break-all font-medium">{p.reference ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-text-muted)]">Medio</dt>
                      <dd className="font-medium capitalize">{p.channel ?? "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">{fmtDate(p.created_at)}</p>
                  {p.status === "rejected" && p.rejection_reason ? (
                    <p className="mt-1 text-xs text-[var(--color-expense)]">Motivo: {p.rejection_reason}</p>
                  ) : null}
                  <div className="mt-3">
                    <Actions
                      p={p}
                      onReceipt={() => setReceipt(p)}
                      onApprove={() => setConfirming(p)}
                      onReject={() => setRejecting(p)}
                    />
                  </div>
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
