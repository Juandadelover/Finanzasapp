import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PAYMENT_STATUS_LABEL, STATUS_LABEL } from "@/components/admin/shared";

/**
 * Piezas visuales de la consola de administración. Una sola gramática para todas las pantallas:
 * - Panel: superficie con título, descripción y acción opcional.
 * - Kpi: cifra con etiqueta y contexto; el tono solo se usa cuando la cifra pide atención.
 * - StatusBadge / PaymentBadge: punto + texto (el color nunca es la única señal).
 * - Initials: avatar de iniciales para identificar clientes de un vistazo.
 */

export type Tone = "neutral" | "brand" | "positive" | "warning" | "negative";

const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--color-text-faint)",
  brand: "var(--color-brand-light)",
  positive: "var(--color-income)",
  warning: "var(--color-warning)",
  negative: "var(--color-expense)",
};

export function toneColor(tone: Tone): string {
  return TONE_VAR[tone];
}

export function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-5">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? (
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              >
                <Icon size={15} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 id={headingId} className="text-sm font-semibold leading-snug">
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("px-4 pb-4 lg:px-5 lg:pb-5", title ? "pt-3" : "pt-4 lg:pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const attention = tone === "warning" || tone === "negative";
  const cls = cn(
    "group relative flex min-w-0 flex-col rounded-2xl border bg-[var(--color-surface)] p-4",
    attention ? "border-[color-mix(in_oklab,var(--kpi-tone)_45%,var(--color-border))]" : "border-[var(--color-border)]",
    href &&
      "transition-[background-color,transform] duration-(--duration-fast) ease-(--ease-out) hover:bg-[var(--color-surface-2)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]",
    className
  );
  const inner = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
        {tone !== "neutral" ? (
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kpi-tone)]" />
        ) : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="tabular mt-1.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 truncate text-xs text-[var(--color-text-faint)]">{hint}</p> : null}
      {href ? (
        <ChevronRight
          size={16}
          aria-hidden
          className="absolute right-3 top-4 text-[var(--color-text-faint)] transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
        />
      ) : null}
    </>
  );
  const style = { "--kpi-tone": TONE_VAR[tone] } as React.CSSProperties;
  return href ? (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        color: TONE_VAR[tone],
        backgroundColor: `color-mix(in oklab, ${TONE_VAR[tone]} 14%, transparent)`,
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
      {children}
    </span>
  );
}

export const SUBSCRIPTION_TONE: Record<string, Tone> = {
  active: "positive",
  grace: "warning",
  provisional: "brand",
  trial: "brand",
  free: "neutral",
  expired: "negative",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-[var(--color-text-faint)]">Sin suscripción</span>;
  return <Badge tone={SUBSCRIPTION_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export const PAYMENT_TONE: Record<string, Tone> = {
  in_review: "brand",
  awaiting_receipt: "warning",
  approved: "positive",
  rejected: "negative",
};

export function PaymentBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{PAYMENT_STATUS_LABEL[status] ?? status}</Badge>;
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-xs font-semibold text-[var(--color-text-muted)]",
        className
      )}
    >
      {initials}
    </span>
  );
}

/** Lista de definición compacta (etiqueta a la izquierda, valor a la derecha). */
export function DefinitionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-[var(--color-border)] py-2 text-sm last:border-b-0">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="tabular min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}
