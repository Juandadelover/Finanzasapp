"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { setSubscription, type PlanRow } from "@/lib/admin";
import { adminInputClass as inputClass, adminLabelClass as labelClass } from "@/components/admin/shared";

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function defaultEnd(current: string | null, cycle: string): string {
  const now = new Date();
  const base = current && new Date(current) > now ? new Date(current) : now;
  const d = new Date(base);
  if (cycle === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return toInputDate(d);
}

export interface SubscriptionTarget {
  owner_id: string;
  email: string | null;
  full_name: string | null;
  plan_code: string | null;
  billing_cycle: string | null;
  current_period_end: string | null;
}

export function SubscriptionSheet({
  customer,
  plans,
  onClose,
  onDone,
}: {
  customer: SubscriptionTarget;
  plans: PlanRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const initialCycle = customer.billing_cycle === "annual" ? "annual" : "monthly";
  const [plan, setPlan] = useState(customer.plan_code ?? plans[0]?.code ?? "");
  const [cycle, setCycle] = useState(initialCycle);
  const [end, setEnd] = useState(defaultEnd(customer.current_period_end, initialCycle));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function changeCycle(c: string) {
    setCycle(c);
    setEnd(defaultEnd(customer.current_period_end, c));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !end) {
      toast.error("Completa plan y fecha.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Indica el motivo.");
      return;
    }
    setBusy(true);
    const ok = await setSubscription({
      owner: customer.owner_id,
      plan,
      cycle,
      periodEnd: new Date(`${end}T23:59:59`).toISOString(),
      reason: reason.trim(),
    });
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Activar o extender">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold">{customer.full_name || customer.email}</p>
          {customer.full_name ? (
            <p className="text-xs text-[var(--color-text-muted)]">{customer.email}</p>
          ) : null}
        </div>
        <label className="block">
          <span className={labelClass}>Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Ciclo</span>
          <select value={cycle} onChange={(e) => changeCycle(e.target.value)} className={inputClass}>
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Vence el</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Motivo (queda en la auditoría)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ej. Pago confirmado por WhatsApp"
            className={inputClass}
          />
        </label>
        <Button type="submit" loading={busy} fullWidth>
          {busy ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </BottomSheet>
  );
}
