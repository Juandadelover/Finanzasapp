"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/AdminUI";
import { adminInputClass, fmtDateTime } from "@/components/admin/shared";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAuditLog,
  fetchPaymentMethods,
  fetchPlans,
  savePaymentMethod,
  updatePlan,
  type AuditEntry,
  type PaymentMethodConfig,
  type PaymentMethodKind,
  type PlanRow,
} from "@/lib/admin";
import { formatAmountInput, parseAmountInput } from "@/lib/format";

const KINDS: {
  kind: PaymentMethodKind;
  label: string;
  valueLabel: string;
  valuePlaceholder: string;
}[] = [
  { kind: "nequi", label: "Nequi", valueLabel: "Número", valuePlaceholder: "300 123 4567" },
  { kind: "bancolombia", label: "Bancolombia", valueLabel: "Número de cuenta", valuePlaceholder: "Ahorros 123-456789-01" },
  { kind: "breb", label: "Llave Bre-B", valueLabel: "Llave", valuePlaceholder: "@tunegocio o celular" },
];

const AUDIT_LABEL: Record<string, string> = {
  approve_payment: "Pago aprobado",
  reject_payment: "Pago rechazado",
  set_subscription: "Suscripción ajustada",
  save_payment_method: "Medio de pago guardado",
  update_plan: "Plan actualizado",
};
const ENTITY_LABEL: Record<string, string> = {
  payment: "Pago",
  subscription: "Suscripción",
  payment_method: "Medio de pago",
  plan: "Plan",
};

const inputClass = adminInputClass;
const labelClass = "mb-1.5 block text-sm font-medium";

function auditLabel(action: string): string {
  if (AUDIT_LABEL[action]) return AUDIT_LABEL[action];
  const t = action.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[var(--color-brand)]"
      />
      {label}
    </label>
  );
}

function SaveRow({ dirty, busy, onSave, children }: { dirty: boolean; busy: boolean; onSave: () => void; children?: ReactNode }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
      <div className="min-w-0 text-xs text-[var(--color-text-muted)]" aria-live="polite">
        {dirty ? "Cambios sin guardar" : "Sin cambios"}
      </div>
      {children}
      <Button size="sm" variant={dirty ? "primary" : "secondary"} onClick={onSave} loading={busy} disabled={!dirty}>
        {busy ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

function MethodCard({
  kind,
  label,
  valueLabel,
  valuePlaceholder,
  existing,
  index,
  onSaved,
}: {
  kind: PaymentMethodKind;
  label: string;
  valueLabel: string;
  valuePlaceholder: string;
  existing: PaymentMethodConfig | undefined;
  index: number;
  onSaved: () => void;
}) {
  const [holder, setHolder] = useState(existing?.holder_name ?? "");
  const [value, setValue] = useState(existing?.value ?? "");
  const [details, setDetails] = useState(existing?.details ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [busy, setBusy] = useState(false);
  const uid = useId();

  const dirty =
    holder.trim() !== (existing?.holder_name ?? "").trim() ||
    value.trim() !== (existing?.value ?? "").trim() ||
    details.trim() !== (existing?.details ?? "").trim() ||
    active !== (existing?.active ?? true);

  async function save() {
    if (!value.trim()) {
      toast.error(`Ingresa ${valueLabel.toLowerCase()} para ${label}.`);
      return;
    }
    setBusy(true);
    const ok = await savePaymentMethod(kind, existing?.id ?? null, {
      holder_name: holder.trim(),
      value: value.trim(),
      details: details.trim(),
      active,
      sort_order: existing?.sort_order ?? index + 1,
    });
    setBusy(false);
    if (ok) onSaved();
  }

  const preview = [label, value.trim(), holder.trim()].filter(Boolean).join(" · ");

  return (
    <Panel title={label} description={active ? "Visible al pagar" : "Oculto para clientes"} id={`${uid}-panel`}>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor={`${uid}-holder`} className={labelClass}>Titular</label>
          <input
            id={`${uid}-holder`}
            className={inputClass}
            value={holder}
            placeholder="Nombre como aparece en la cuenta"
            onChange={(e) => setHolder(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-value`} className={labelClass}>{valueLabel}</label>
          <input
            id={`${uid}-value`}
            className={inputClass}
            value={value}
            placeholder={valuePlaceholder}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-details`} className={labelClass}>Detalles</label>
          <input
            id={`${uid}-details`}
            className={inputClass}
            value={details}
            placeholder="Ej. Cuenta de ahorros"
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        <Toggle checked={active} onChange={setActive} label="Visible para clientes" />
        {value.trim() ? (
          <p className="rounded-xl bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">Así lo ven:</span> {preview}
            {details.trim() ? ` (${details.trim()})` : ""}
          </p>
        ) : null}
      </div>
      <SaveRow dirty={dirty} busy={busy} onSave={save} />
    </Panel>
  );
}

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
  const [monthly, setMonthly] = useState(plan.monthly_price);
  const [annual, setAnnual] = useState(plan.annual_price);
  const [active, setActive] = useState(plan.active);
  const [busy, setBusy] = useState(false);
  const uid = useId();
  const free = plan.code === "gratis";

  const dirty = active !== plan.active || (!free && (monthly !== plan.monthly_price || annual !== plan.annual_price));

  async function save() {
    setBusy(true);
    const ok = await updatePlan(plan.code, { monthly_price: monthly, annual_price: annual, active });
    setBusy(false);
    if (ok) onSaved();
  }

  const months = monthly > 0 && annual > 0 ? annual / monthly : null;
  const monthsText = months === null ? null : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(months);

  return (
    <Panel title={plan.name} description={active ? "Disponible para clientes" : "Plan desactivado"} id={`${uid}-panel`}>
      {free ? (
        <p className="tabular rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm">
          $ 0 <span className="text-[var(--color-text-muted)]">· Sin costo</span>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={`${uid}-m`} className={labelClass}>Precio mensual (COP)</label>
            <input
              id={`${uid}-m`}
              inputMode="numeric"
              className={cn(inputClass, "tabular")}
              placeholder="0"
              value={formatAmountInput(monthly)}
              onChange={(e) => setMonthly(parseAmountInput(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-a`} className={labelClass}>Precio anual (COP)</label>
            <input
              id={`${uid}-a`}
              inputMode="numeric"
              className={cn(inputClass, "tabular")}
              placeholder="0"
              value={formatAmountInput(annual)}
              onChange={(e) => setAnnual(parseAmountInput(e.target.value))}
            />
            {monthsText ? (
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">= {monthsText} meses de pago mensual</p>
            ) : null}
          </div>
        </div>
      )}
      <div className="mt-3">
        <Toggle checked={active} onChange={setActive} label="Plan activo" />
      </div>
      <SaveRow dirty={dirty} busy={busy} onSave={save} />
    </Panel>
  );
}

export default function AdminConfiguracionPage() {
  const [methods, setMethods] = useState<PaymentMethodConfig[] | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const [m, p, a] = await Promise.all([fetchPaymentMethods(), fetchPlans(), fetchAuditLog(50)]);
    setFailed(m === null || p === null);
    setMethods(m ?? []);
    setPlans(p ?? []);
    setAudit(a ?? []);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!methods || !plans || !audit) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Cargando configuración...</span>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {failed ? (
        <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            No se pudo cargar parte de la configuración. Lo que ves puede estar incompleto: no guardes cambios hasta
            recargar.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      ) : null}
      <section className="flex flex-col gap-3" aria-labelledby="cfg-medios">
        <div>
          <h2 id="cfg-medios" className="text-base font-semibold">Medios de pago</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Los clientes ven estos datos al pagar su suscripción.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {KINDS.map((k, i) => (
            <MethodCard
              key={`${k.kind}-${version}`}
              {...k}
              index={i}
              existing={methods.find((m) => m.kind === k.kind)}
              onSaved={load}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="cfg-planes">
        <div>
          <h2 id="cfg-planes" className="text-base font-semibold">Precios de planes</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Los cambios aplican a los pagos nuevos.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={`${p.code}-${version}`} plan={p} onSaved={load} />
          ))}
        </div>
      </section>

      <Panel title="Auditoría" description="Últimos 50 cambios registrados." id="cfg-audit">
        {audit.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">Aún no hay cambios registrados.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-[var(--color-border)] lg:-mx-5">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-0.5 px-4 py-2.5 text-sm lg:grid lg:grid-cols-[11rem_1fr_auto] lg:items-center lg:gap-4 lg:px-5"
              >
                <time dateTime={a.created_at} className="tabular text-xs text-[var(--color-text-muted)]">
                  {fmtDateTime(a.created_at)}
                </time>
                <span className="font-medium">{auditLabel(a.action)}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {ENTITY_LABEL[a.entity] ?? a.entity}
                  {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
