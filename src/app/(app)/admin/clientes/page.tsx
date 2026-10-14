"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAdminCustomers,
  fetchPlans,
  setSubscription,
  type AdminCustomer,
  type PlanRow,
} from "@/lib/admin";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  grace: "En gracia",
  provisional: "Provisional",
  trial: "En prueba",
  free: "Gratis",
  expired: "Vencido",
};

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

export default function AdminClientesPage() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const data = await fetchAdminCustomers(q);
    setFailed(data === null);
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
      <label className="relative block md:max-w-md">
        <span className="sr-only">Buscar clientes por nombre o correo</span>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo"
          className={`${inputClass} pl-10`}
        />
      </label>

      {loading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Cargando clientes...</span>
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : failed ? (
        <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">No se pudieron cargar los clientes.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load(search.trim())}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No se encontraron clientes"
          description={search.trim() ? "Revisa la ortografía o busca por correo." : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] md:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Clientes</caption>
              <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-3 py-3 font-medium">Vigente</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Negocios</th>
                  <th scope="col" className="px-3 py-3 font-medium">Vence</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((c) => (
                  <tr key={c.owner_id}>
                    <td className="max-w-[16rem] px-4 py-3">
                      <p className="truncate font-medium">{c.full_name || c.email}</p>
                      {c.full_name ? <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p> : null}
                    </td>
                    <td className="px-3 py-3 capitalize">{c.plan_code ?? "—"}</td>
                    <td className="px-3 py-3 capitalize">{c.effective_plan ?? "—"}</td>
                    <td className="px-3 py-3">{c.status ? (STATUS_LABEL[c.status] ?? c.status) : "—"}</td>
                    <td className="tabular px-3 py-3 text-right">{c.workspaces}</td>
                    <td className="whitespace-nowrap px-3 py-3">{fmtDay(c.current_period_end ?? c.trial_end)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelected(c)}
                        aria-label={`Activar o extender plan de ${c.full_name || c.email}`}
                      >
                        Activar o extender
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((c) => (
              <li key={c.owner_id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  aria-label={`Activar o extender plan de ${c.full_name || c.email}`}
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition active:scale-[0.98] hover:bg-[var(--color-surface-2)]"
                >
                  <p className="truncate text-sm font-semibold">{c.full_name || c.email}</p>
                  {c.full_name ? <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p> : null}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>
                      Plan: <strong className="capitalize text-[var(--color-text)]">{c.plan_code ?? "—"}</strong>
                    </span>
                    <span>
                      Vigente: <strong className="capitalize text-[var(--color-text)]">{c.effective_plan ?? "—"}</strong>
                    </span>
                    <span>
                      Estado:{" "}
                      <strong className="text-[var(--color-text)]">
                        {c.status ? (STATUS_LABEL[c.status] ?? c.status) : "—"}
                      </strong>
                    </span>
                    <span>
                      Negocios: <strong className="text-[var(--color-text)]">{c.workspaces}</strong>
                    </span>
                    <span className="col-span-2">
                      Vence:{" "}
                      <strong className="text-[var(--color-text)]">{fmtDay(c.current_period_end ?? c.trial_end)}</strong>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
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
