"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SubscriptionSheet } from "@/components/admin/SubscriptionSheet";
import { Badge, DefinitionRow, Initials, Panel, PaymentBadge, StatusBadge, type Tone } from "@/components/admin/AdminUI";
import { STATUS_LABEL, cycleLabel, fmtDateTime, fmtDay } from "@/components/admin/shared";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAdminCustomerDetail,
  fetchPlans,
  type AdminCustomerDetail,
  type CustomerPayment,
  type CustomerSubscription,
  type CustomerWorkspace,
  type PlanRow,
} from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const DAY_MS = 86_400_000;

const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

function dayDiff(iso: string, now: number): number {
  const a = new Date(iso);
  const b = new Date(now);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

function plural(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

/** Resumen del periodo vigente: fecha clave, cuenta regresiva y tono. */
function periodSummary(sub: CustomerSubscription, now: number): { text: string; tone: Tone } | null {
  const status = sub.status;
  const target =
    status === "trial" ? sub.trial_end : status === "grace" ? (sub.grace_until ?? sub.current_period_end) : sub.current_period_end;
  if (!target || status === "free") return null;
  const d = dayDiff(target, now);
  const label = status === "trial" ? "La prueba termina el" : status === "grace" ? "La gracia termina el" : "Vence el";
  const date = fmtDay(target);
  if (d < 0) {
    return {
      text: status === "expired" ? `Venció el ${date} · hace ${plural(-d)}` : `${label} ${date} · pasaron ${plural(-d)}`,
      tone: "negative",
    };
  }
  if (d === 0) return { text: `${label} ${date} · es hoy`, tone: "warning" };
  return { text: `${label} ${date} · faltan ${plural(d)}`, tone: d <= 7 ? "warning" : "neutral" };
}

function Count({ value }: { value: number }) {
  return <span className={cn("tabular", value === 0 && "text-[var(--color-text-faint)]")}>{value}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label}:{" "}
      <strong className={cn("tabular font-semibold", value === 0 ? "text-[var(--color-text-faint)]" : "text-[var(--color-text)]")}>
        {value}
      </strong>
    </span>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/clientes"
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm text-[var(--color-text-muted)] transition duration-(--duration-fast) ease-(--ease-out) hover:text-[var(--color-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-light)]"
    >
      <ChevronLeft size={18} aria-hidden />
      Clientes
    </Link>
  );
}

export default function AdminClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setDetail(await fetchAdminCustomerDetail(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    fetchPlans().then((p) => setPlans(p ?? []));
  }, []);

  if (loading) {
    return (
      <div className="mx-4 mt-2 flex flex-col gap-4 lg:mx-0">
        <BackLink />
        <h1 className="sr-only">Cliente</h1>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Cargando cliente...</span>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-4 mt-2 flex flex-col gap-4 lg:mx-0">
        <BackLink />
        <h1 className="sr-only">Cliente</h1>
        <div role="alert" className={cardClass}>
          <p className="text-sm text-[var(--color-text-muted)]">No se pudo cargar el cliente.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const sub = detail.subscription;
  const name = detail.full_name || detail.email || "Cliente";
  const plan = detail.effective_plan ?? sub?.plan_code ?? "free";
  const status = sub?.status ?? null;
  const period = sub ? periodSummary(sub, now) : null;
  const contractedDiffers = !!sub?.plan_code && sub.plan_code !== plan;

  const wsColumns = [
    { key: "name", header: "Negocio", cell: (w: CustomerWorkspace) => <span className="font-medium">{w.name}</span> },
    { key: "members", header: "Miembros", align: "right" as const, cell: (w: CustomerWorkspace) => <Count value={w.members} /> },
    {
      key: "month",
      header: "Movimientos del mes",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => <Count value={w.transactions_this_month} />,
    },
    {
      key: "total",
      header: "Movimientos totales",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => <Count value={w.transactions_total} />,
    },
    {
      key: "docs",
      header: "Cobros del mes",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => <Count value={w.collection_docs_this_month} />,
    },
    {
      key: "last",
      header: "Última actividad",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => <span className="whitespace-nowrap">{fmtDay(w.last_activity_at)}</span>,
    },
  ];

  const payColumns = [
    { key: "date", header: "Fecha", cell: (p: CustomerPayment) => <span className="whitespace-nowrap">{fmtDateTime(p.created_at)}</span> },
    { key: "ref", header: "Referencia", cell: (p: CustomerPayment) => p.reference ?? "—" },
    {
      key: "plan",
      header: "Plan",
      cell: (p: CustomerPayment) => (
        <span>
          {cap(p.plan_code)} · {cycleLabel(p.billing_cycle).toLowerCase()}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Monto esperado",
      align: "right" as const,
      cell: (p: CustomerPayment) => formatAmount(p.expected_amount, "COP"),
    },
    {
      key: "declared",
      header: "Declarado",
      align: "right" as const,
      cell: (p: CustomerPayment) =>
        p.declared_amount == null ? (
          <span className="text-[var(--color-text-faint)]">—</span>
        ) : (
          formatAmount(p.declared_amount, "COP")
        ),
    },
    { key: "channel", header: "Medio", cell: (p: CustomerPayment) => p.channel ?? "—" },
    { key: "status", header: "Estado", cell: (p: CustomerPayment) => <PaymentBadge status={p.status} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="mx-4 mt-2 flex flex-col gap-2 lg:mx-0">
        <BackLink />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <Initials name={name} className="h-14 w-14 text-base" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-snug">{name}</h1>
              {detail.full_name && detail.email ? (
                <p className="truncate text-sm text-[var(--color-text-muted)]">{detail.email}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="brand">Plan {cap(plan)}</Badge>
                <StatusBadge status={status} />
                {detail.deletion_requested_at ? <Badge tone="warning">Pidió eliminar su cuenta</Badge> : null}
              </div>
            </div>
          </div>
          <Button onClick={() => setEditing(true)} className="w-full lg:w-auto">
            Activar o extender
          </Button>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-5 lg:mx-0">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Panel id="cuenta" title="Cuenta">
            <dl>
              <DefinitionRow label="Registro">{fmtDay(detail.created_at)}</DefinitionRow>
              <DefinitionRow label="Último ingreso">{fmtDateTime(detail.last_sign_in_at)}</DefinitionRow>
              <DefinitionRow label="Términos aceptados">{fmtDay(detail.terms_accepted_at)}</DefinitionRow>
              <DefinitionRow label="Solicitud de eliminación">
                {detail.deletion_requested_at ? (
                  <Badge tone="warning">{fmtDay(detail.deletion_requested_at)}</Badge>
                ) : (
                  <span className="font-normal text-[var(--color-text-faint)]">Ninguna</span>
                )}
              </DefinitionRow>
            </dl>
          </Panel>

          <Panel id="sub" title="Suscripción">
            {sub ? (
              <>
                {period ? (
                  <p className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium">
                    <Badge tone={period.tone === "neutral" ? "positive" : period.tone} className="shrink-0">
                      {period.tone === "negative" ? "Atrasado" : period.tone === "warning" ? "Por vencer" : "Al día"}
                    </Badge>
                    <span className="tabular min-w-0">{period.text}</span>
                  </p>
                ) : null}
                <dl>
                  <DefinitionRow label="Plan vigente">{cap(plan)}</DefinitionRow>
                  {contractedDiffers ? <DefinitionRow label="Plan contratado">{cap(sub.plan_code)}</DefinitionRow> : null}
                  <DefinitionRow label="Ciclo">{cycleLabel(sub.billing_cycle)}</DefinitionRow>
                  <DefinitionRow label="Estado">{status ? (STATUS_LABEL[status] ?? status) : "—"}</DefinitionRow>
                  <DefinitionRow label="Fin de la prueba">{fmtDay(sub.trial_end)}</DefinitionRow>
                  <DefinitionRow label="Vence el">{fmtDay(sub.current_period_end)}</DefinitionRow>
                  <DefinitionRow label="Gracia hasta">{fmtDay(sub.grace_until)}</DefinitionRow>
                  <DefinitionRow label="Acceso provisional hasta">{fmtDay(sub.provisional_until)}</DefinitionRow>
                  <DefinitionRow label="Cancela al terminar el periodo">{sub.cancel_at_period_end ? "Sí" : "No"}</DefinitionRow>
                </dl>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Este cliente aún no tiene suscripción.</p>
            )}
          </Panel>
        </div>

        <section aria-labelledby="ws-title" className="flex flex-col gap-3">
          <h2 id="ws-title" className="text-sm font-semibold">
            Negocios
          </h2>
          <DataTable
            caption="Negocios del cliente"
            rows={detail.workspaces}
            columns={wsColumns}
            getRowKey={(w) => w.id}
            mobileClassName="flex flex-col gap-2"
            empty={<EmptyState icon={Building2} title="Sin negocios" description="El cliente aún no ha creado ninguno." />}
            renderMobile={(w) => (
              <div className={cardClass}>
                <p className="text-sm font-semibold">{w.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <Stat label="Miembros" value={w.members} />
                  <Stat label="Cobros del mes" value={w.collection_docs_this_month} />
                  <Stat label="Movimientos del mes" value={w.transactions_this_month} />
                  <Stat label="Totales" value={w.transactions_total} />
                  <span className="col-span-2">
                    Última actividad: <strong className="font-semibold text-[var(--color-text)]">{fmtDay(w.last_activity_at)}</strong>
                  </span>
                </div>
              </div>
            )}
          />
        </section>

        <section aria-labelledby="pay-title" className="flex flex-col gap-3">
          <h2 id="pay-title" className="text-sm font-semibold">
            Pagos
          </h2>
          <DataTable
            caption="Pagos del cliente"
            rows={detail.payments}
            columns={payColumns}
            getRowKey={(p) => p.id}
            mobileClassName="flex flex-col gap-2"
            empty={<EmptyState icon={ShieldCheck} title="Sin pagos" description="Aún no ha enviado comprobantes." />}
            renderMobile={(p) => (
              <div className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tabular text-sm font-semibold">{formatAmount(p.expected_amount, "COP")}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {cap(p.plan_code)} · {cycleLabel(p.billing_cycle).toLowerCase()}
                    </p>
                  </div>
                  <PaymentBadge status={p.status} />
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {fmtDateTime(p.created_at)}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.channel ? ` · ${p.channel}` : ""}
                </p>
                {p.rejection_reason ? (
                  <p className="mt-1 text-xs text-[var(--color-expense)]">Motivo: {p.rejection_reason}</p>
                ) : null}
              </div>
            )}
          />
        </section>

        <p className="text-xs text-[var(--color-text-faint)]">
          Por privacidad no se muestran montos ni movimientos del cliente.
        </p>
      </div>

      {editing ? (
        <SubscriptionSheet
          customer={{
            owner_id: detail.owner_id,
            email: detail.email,
            full_name: detail.full_name,
            plan_code: sub?.plan_code ?? null,
            billing_cycle: sub?.billing_cycle ?? null,
            current_period_end: sub?.current_period_end ?? null,
          }}
          plans={plans}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
