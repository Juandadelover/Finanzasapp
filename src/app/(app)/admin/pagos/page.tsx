"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Inbox } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
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
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

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
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
      ) : !url ? (
        <p className="text-sm text-[var(--color-text-muted)]">No se pudo cargar el comprobante.</p>
      ) : isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="gradient-brand flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
        >
          <FileText size={16} /> Abrir PDF
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
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                reason === r
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div>
          <label className={labelClass}>Motivo</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Explica por qué se rechaza"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[var(--color-expense)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Rechazando..." : "Rechazar pago"}
        </button>
      </form>
    </BottomSheet>
  );
}

export default function AdminPagosPage() {
  const [filter, setFilter] = useState<PaymentFilter>("in_review");
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<AdminPayment | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);
  const [confirming, setConfirming] = useState<AdminPayment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (f: PaymentFilter) => {
    setLoading(true);
    const data = await fetchAdminPayments(f);
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
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              filter === f.value
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!rows || rows.length === 0}
          onClick={() => rows && exportCsv(rows)}
          className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState icon={Inbox} title="No hay pagos en esta vista" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((p) => {
            const mismatch = p.declared_amount != null && p.declared_amount !== p.expected_amount;
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.full_name || p.email || "Sin nombre"}</p>
                    {p.full_name && p.email ? (
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{p.email}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Plan</dt>
                    <dd className="font-medium capitalize">
                      {p.plan_code} · {cycleLabel(p.billing_cycle)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Plan actual</dt>
                    <dd className="font-medium capitalize">{p.current_plan ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Esperado</dt>
                    <dd className="font-medium">{formatAmount(p.expected_amount, "COP")}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Declarado</dt>
                    <dd className={cn("font-medium", mismatch && "text-[var(--color-expense)]")}>
                      {p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")}
                      {mismatch ? " (no coincide)" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Referencia</dt>
                    <dd className="break-all font-medium">{p.reference ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-faint)]">Medio</dt>
                    <dd className="font-medium capitalize">{p.channel ?? "—"}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[var(--color-text-faint)]">{fmtDate(p.created_at)}</p>
                {p.status === "rejected" && p.rejection_reason ? (
                  <p className="mt-1 text-xs text-[var(--color-expense)]">Motivo: {p.rejection_reason}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.receipt_path ? (
                    <button
                      type="button"
                      onClick={() => setReceipt(p)}
                      className="rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-xs font-semibold"
                    >
                      Ver comprobante
                    </button>
                  ) : null}
                  {p.status === "in_review" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirming(p)}
                        className="gradient-brand rounded-xl px-4 py-2 text-xs font-semibold text-white"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(p)}
                        className="rounded-xl border border-[var(--color-expense)] px-4 py-2 text-xs font-semibold text-[var(--color-expense)]"
                      >
                        Rechazar
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
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
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleApprove}
                className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Aprobando..." : "Aprobar"}
              </button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
