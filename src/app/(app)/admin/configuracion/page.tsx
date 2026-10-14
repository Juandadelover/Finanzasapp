"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const saveClass =
  "gradient-brand rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
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
        <div>
          <label className={labelClass}>Titular</label>
          <input className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{valueLabel}</label>
          <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Detalles</label>
          <input
            className={inputClass}
            value={details}
            placeholder="Ej. Cuenta de ahorros"
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Toggle checked={active} onChange={setActive} label="Activo" />
          <button type="button" onClick={save} disabled={busy} className={saveClass}>
            {busy ? "Guardando..." : "Guardar"}
          </button>
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
        <div>
          <label className={labelClass}>Mensual</label>
          <input
            inputMode="numeric"
            className={inputClass}
            value={formatAmountInput(monthly)}
            onChange={(e) => setMonthly(parseAmountInput(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass}>Anual</label>
          <input
            inputMode="numeric"
            className={inputClass}
            value={formatAmountInput(annual)}
            onChange={(e) => setAnnual(parseAmountInput(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Toggle checked={active} onChange={setActive} label="Activo" />
        <button type="button" onClick={save} disabled={busy} className={saveClass}>
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export default function AdminConfiguracionPage() {
  const [methods, setMethods] = useState<PaymentMethodConfig[] | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const [m, p, a] = await Promise.all([fetchPaymentMethods(), fetchPlans(), fetchAuditLog(50)]);
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
    return <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-surface)]" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Medios de pago</h2>
        {KINDS.map((k, i) => (
          <MethodCard
            key={`${k.kind}-${version}`}
            {...k}
            index={i}
            existing={methods.find((m) => m.kind === k.kind)}
            onSaved={load}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Precios de planes</h2>
        {plans.map((p) => (
          <PlanCard key={`${p.code}-${version}`} plan={p} onSaved={load} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Auditoría (últimos 50)</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Sin registros.</p>
        ) : (
          <ul className={`${cardClass} divide-y divide-[var(--color-border)] p-0`}>
            {audit.map((a) => (
              <li key={a.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{a.action}</span>
                  <span className="text-[var(--color-text-faint)]">
                    {new Date(a.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  {a.entity}
                  {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                </p>
                {Object.keys(a.details ?? {}).length > 0 ? (
                  <p className="mt-0.5 break-all text-[var(--color-text-faint)]">{JSON.stringify(a.details)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
