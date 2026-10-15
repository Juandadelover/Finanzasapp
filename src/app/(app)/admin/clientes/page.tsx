"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw, Search, SearchX, Users, X } from "lucide-react";
import { Initials, StatusBadge } from "@/components/admin/AdminUI";
import { adminInputClass as inputClass, fmtDay } from "@/components/admin/shared";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { fetchAdminCustomers, type AdminCustomer } from "@/lib/admin";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "trial" | "grace" | "expired" | "free" | "vence";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Pagan" },
  { value: "trial", label: "En prueba" },
  { value: "grace", label: "En gracia" },
  { value: "expired", label: "Vencidos" },
  { value: "free", label: "Gratis" },
  { value: "vence", label: "Vencen en 7 días" },
];

const DAY_MS = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Días de calendario hasta una fecha (negativo si ya pasó). */
function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
}

function relativeHint(days: number): string {
  if (days < -1) return `hace ${-days} días`;
  if (days === -1) return "ayer";
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

function bucket(c: AdminCustomer): Filter {
  if (c.status === "active" || c.status === "trial" || c.status === "grace" || c.status === "expired") return c.status;
  if (c.status === "free" || !c.status) return "free";
  return "all";
}

function expiresSoon(c: AdminCustomer, now: number): boolean {
  if (c.status !== "active" && c.status !== "grace") return false;
  const d = daysUntil(c.current_period_end, now);
  if (d === null || d > 7) return false;
  return c.status === "grace" || d >= 0;
}

function matches(c: AdminCustomer, f: Filter, now: number): boolean {
  if (f === "all") return true;
  if (f === "vence") return expiresSoon(c, now);
  return bucket(c) === f;
}

function parseFilter(estado: string | null, vence: string | null): Filter {
  if (vence === "7") return "vence";
  const valid = FILTERS.find((f) => f.value === estado && f.value !== "vence");
  return valid ? valid.value : "all";
}

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

function PlanCell({ c }: { c: AdminCustomer }) {
  const effective = c.effective_plan ?? c.plan_code;
  const differs = !!c.plan_code && !!c.effective_plan && c.plan_code !== c.effective_plan;
  return (
    <>
      <p className="text-sm font-medium">{cap(effective)}</p>
      {differs ? <p className="text-xs text-[var(--color-text-muted)]">Contrató: {cap(c.plan_code)}</p> : null}
    </>
  );
}

function DueCell({ c, now }: { c: AdminCustomer; now: number }) {
  const end = c.current_period_end ?? c.trial_end;
  const days = daysUntil(end, now);
  const showHint = days !== null && days <= 7 && c.status !== "expired" && c.status !== "free" && !!c.status;
  return (
    <>
      <p className="tabular whitespace-nowrap text-sm">{fmtDay(end)}</p>
      {showHint && days !== null ? (
        <p className="text-xs text-[var(--color-warning)]">{relativeHint(days)}</p>
      ) : null}
    </>
  );
}

function ClientesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useFinance();
  const selfId = user?.id ?? null;

  const filter = parseFilter(params.get("estado"), params.get("vence"));

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  const load = useCallback(async (q: string) => {
    const data = await fetchAdminCustomers(q);
    setFailed(data === null);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const people = useMemo(() => (rows ?? []).filter((c) => c.owner_id !== selfId), [rows, selfId]);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.value] = people.filter((c) => matches(c, f.value, now)).length;
    return out;
  }, [people, now]);

  const visible = useMemo(() => people.filter((c) => matches(c, filter, now)), [people, filter, now]);

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params.toString());
    next.delete("estado");
    next.delete("vence");
    if (f === "vence") next.set("vence", "7");
    else if (f !== "all") next.set("estado", f);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearAll = () => {
    setSearch("");
    setFilter("all");
  };

  const retry = () => {
    setLoading(true);
    void load(search.trim());
  };

  const nameOf = (c: AdminCustomer) => c.full_name || c.email || "Sin nombre";
  const hasQuery = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative md:max-w-md">
        <label htmlFor="clientes-search" className="sr-only">
          Buscar clientes por nombre o correo
        </label>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          id="clientes-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo"
          className={cn(inputClass, "pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none")}
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Borrar búsqueda"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition duration-(--duration-fast) ease-(--ease-out) hover:text-[var(--color-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-light)]"
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Filtrar por estado"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const selected = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition duration-(--duration-fast) ease-(--ease-out) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-light)]",
                selected
                  ? "border-[var(--color-brand)] bg-[color-mix(in_oklab,var(--color-brand)_16%,transparent)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              )}
            >
              {f.label}
              {!loading && !failed ? (
                <span
                  className={cn(
                    "tabular text-xs",
                    selected ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-faint)]"
                  )}
                >
                  {counts[f.value]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Cargando clientes...</span>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : failed ? (
        <div role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">No se pudieron cargar los clientes.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      ) : people.length === 0 && !hasQuery ? (
        <EmptyState icon={Users} title="Aún no hay clientes" description="Aparecerán aquí cuando se registren." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description={
            hasQuery
              ? "Revisa la ortografía o busca por correo."
              : "Ningún cliente cumple este filtro. Prueba con otro estado."
          }
          action={{ label: hasQuery ? "Limpiar búsqueda y filtros" : "Ver todos", onClick: clearAll }}
        />
      ) : (
        <>
          <div className="hidden overflow-clip rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Clientes</caption>
              <thead className="bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Plan</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Negocios</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Vence</th>
                  <th scope="col" className="w-12 px-4 py-2.5"><span className="sr-only">Ver ficha</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr
                    key={c.owner_id}
                    className="relative border-t border-[var(--color-border)] transition-colors duration-(--duration-fast) hover:bg-[var(--color-surface-2)] focus-within:bg-[var(--color-surface-2)]"
                  >
                    <td className="max-w-[18rem] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Initials name={nameOf(c)} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/clientes/${c.owner_id}`}
                            className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:after:rounded-xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[var(--color-brand-light)]"
                          >
                            {nameOf(c)}
                          </Link>
                          {c.full_name ? (
                            <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><PlanCell c={c} /></td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="tabular px-3 py-3 text-right">{c.workspaces}</td>
                    <td className="px-3 py-3"><DueCell c={c} now={now} /></td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={16} aria-hidden className="ml-auto text-[var(--color-text-faint)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 lg:hidden">
            {visible.map((c) => (
              <li key={c.owner_id}>
                <Link
                  href={`/admin/clientes/${c.owner_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 transition duration-(--duration-fast) ease-(--ease-out) hover:bg-[var(--color-surface-2)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-light)]"
                >
                  <Initials name={nameOf(c)} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nameOf(c)}</p>
                    {c.full_name ? (
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {cap(c.effective_plan ?? c.plan_code)}
                        {c.plan_code && c.effective_plan && c.plan_code !== c.effective_plan
                          ? ` · Contrató ${cap(c.plan_code)}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--color-text-faint)]" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AdminClientesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-11 rounded-xl md:max-w-md" />}>
      <ClientesContent />
    </Suspense>
  );
}
