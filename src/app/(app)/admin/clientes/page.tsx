"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import { SubscriptionSheet } from "@/components/admin/SubscriptionSheet";
import { adminInputClass as inputClass, fmtDay, STATUS_LABEL } from "@/components/admin/shared";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAdminCustomers,
  fetchPlans,
  type AdminCustomer,
  type PlanRow,
} from "@/lib/admin";

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
                      <Link
                        href={`/admin/clientes/${c.owner_id}`}
                        className="block truncate font-medium hover:text-[var(--color-brand-light)] hover:underline"
                      >
                        {c.full_name || c.email}
                      </Link>
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
                <Link
                  href={`/admin/clientes/${c.owner_id}`}
                  aria-label={`Ver detalle de ${c.full_name || c.email}`}
                  className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition active:scale-[0.98] hover:bg-[var(--color-surface-2)]"
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
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSelected(c)}
                  aria-label={`Activar o extender plan de ${c.full_name || c.email}`}
                >
                  Activar o extender
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected ? (
        <SubscriptionSheet
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
