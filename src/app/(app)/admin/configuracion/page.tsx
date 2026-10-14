"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
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

const KINDS: { kind: PaymentMethodKind; label: string; valueLabel: string }[] = [
  { kind: "nequi", label: "Nequi", valueLabel: "Número" },
  { kind: "bancolombia", label: "Bancolombia", valueLabel: "Número de cuenta" },
  { kind: "breb", label: "Llave Bre-B", valueLabel: "Llave" },
];

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />
      {label}
    </label>
  );
}

function MethodCard({
  kind,
  label,
  valueLabel,
  existing,
  index,
  onSaved,
}: {
  kind: PaymentMethodKind;
  label: string;
  valueLabel: string;
  existing: PaymentMethodConfig | undefined;
  index: number;
  onSaved: () => void;
}) {
  const [holder, setHolder] = useState(existing?.holder_name ?? "");
  const [value, setValue] = useState(existing?.value ?? "");
  const [details, setDetails] = useState(existing?.details ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className={cardClass}>
      <p className="mb-3 text-sm font-semibold">{label}</p>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className={labelClass}>Titular</span>
          <input className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{valueLabel}</span>
          <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>Detalles</span>
          <input
            className={inputClass}
            value={details}
            placeholder="Ej. Cuenta de ahorros"
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <Toggle checked={active} onChange={setActive} label="Visible para clientes" />
          <Button onClick={save} loading={busy}>
            {busy ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
  const [monthly, setMonthly] = useState(plan.monthly_price);
  const [annual, setAnnual] = useState(plan.annual_price);
  const [active, setActive] = useState(plan.active);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const ok = await updatePlan(plan.code, { monthly_price: monthly, annual_price: annual, active });
    setBusy(false);
    if (ok) onSaved();
  }

  return (
    <div className={cardClass}>
      <p className="mb-3 text-sm font-semibold">{plan.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Mensual (COP)</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={formatAmountInput(monthly)}
            onChange={(e) => setMonthly(parseAmountInput(e.target.value))}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Anual (COP)</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={formatAmountInput(annual)}
            onChange={(e) => setAnnual(parseAmountInput(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Toggle checked={active} onChange={setActive} label="Plan activo" />
        <Button onClick={save} loading={busy}>
          {busy ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
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
        <div role="alert" className={cardClass}>
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
        <h2 id="cfg-medios" className="text-sm font-semibold">Medios de pago</h2>
        <p className="-mt-1 text-xs text-[var(--color-text-muted)]">
          Los clientes ven estos datos al pagar su suscripción.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
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
        <h2 id="cfg-planes" className="text-sm font-semibold">Precios de planes</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={`${p.code}-${version}`} plan={p} onSaved={load} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="cfg-audit">
        <h2 id="cfg-audit" className="text-sm font-semibold">Auditoría (últimos 50)</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Sin registros.</p>
        ) : (
          <ul className={`${cardClass} divide-y divide-[var(--color-border)] p-0`}>
            {audit.map((a) => (
              <li key={a.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{a.action}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {new Date(a.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  {a.entity}
                  {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                </p>
                {Object.keys(a.details ?? {}).length > 0 ? (
                  <p className="mt-0.5 break-all text-[var(--color-text-muted)]">{JSON.stringify(a.details)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
