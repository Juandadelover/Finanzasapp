"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import {
  fetchAdminCustomers,
  fetchPlans,
  setSubscription,
  type AdminCustomer,
  type PlanRow,
} from "@/lib/admin";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

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

function CustomerSheet({
  customer,
  plans,
  onClose,
  onDone,
}: {
  customer: AdminCustomer;
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
        <div>
          <label className={labelClass}>Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Ciclo</label>
          <select value={cycle} onChange={(e) => changeCycle(e.target.value)} className={inputClass}>
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Vence el</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Motivo</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ej. Pago confirmado por WhatsApp"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </BottomSheet>
  );
}

export default function AdminClientesPage() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminCustomer[] | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const data = await fetchAdminCustomers(q);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    fetchPlans().then((p) => setPlans(p ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo"
          className={`${inputClass} pl-10`}
        />
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState icon={Users} title="No se encontraron clientes" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.owner_id}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:bg-[var(--color-surface-2)]"
              >
                <p className="truncate text-sm font-semibold">{c.full_name || c.email}</p>
                {c.full_name ? (
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p>
                ) : null}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span>
                    Plan: <strong className="capitalize text-[var(--color-text)]">{c.plan_code ?? "—"}</strong>
                  </span>
                  <span>
                    Vigente:{" "}
                    <strong className="capitalize text-[var(--color-text)]">{c.effective_plan ?? "—"}</strong>
                  </span>
                  <span>
                    Estado: <strong className="text-[var(--color-text)]">{c.status ?? "—"}</strong>
                  </span>
                  <span>
                    Negocios: <strong className="text-[var(--color-text)]">{c.workspaces}</strong>
                  </span>
                  <span className="col-span-2">
                    Vence:{" "}
                    <strong className="text-[var(--color-text)]">
                      {fmtDay(c.current_period_end ?? c.trial_end)}
                    </strong>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <CustomerSheet
          customer={selected}
          plans={plans}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            void load(search.trim());
          }}
        />
      ) : null}
    </div>
  );
}
