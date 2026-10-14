export const adminInputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
export const adminLabelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

export const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  grace: "En gracia",
  provisional: "Provisional",
  trial: "En prueba",
  free: "Gratis",
  expired: "Vencido",
};

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  in_review: "En revisión",
  awaiting_receipt: "Esperando comprobante",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const PAYMENT_STATUS_CHIP: Record<string, string> = {
  in_review: "bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]",
  awaiting_receipt: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  approved: "bg-[var(--color-income)]/15 text-[var(--color-income)]",
  rejected: "bg-[var(--color-expense)]/15 text-[var(--color-expense)]",
};

export function cycleLabel(c: string | null | undefined): string {
  return c === "annual" ? "Anual" : c === "monthly" ? "Mensual" : (c ?? "—");
}
