"use client";

import { use, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SubscriptionSheet } from "@/components/admin/SubscriptionSheet";
import {
  PAYMENT_STATUS_CHIP,
  PAYMENT_STATUS_LABEL,
  STATUS_LABEL,
  cycleLabel,
  fmtDateTime,
  fmtDay,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveGrid } from "@/components/ui/ResponsiveGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAdminCustomerDetail,
  fetchPlans,
  type AdminCustomerDetail,
  type CustomerPayment,
  type CustomerWorkspace,
  type PlanRow,
} from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const chipClass = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

function Fact({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        highlight
          ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      )}
    >
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="tabular text-right font-medium">{value}</dd>
    </div>
  );
}

export default function AdminClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

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

  const back = { backHref: "/admin/clientes", backLabel: "Clientes" } as const;

  if (loading) {
    return (
      <>
        <PageHeader title="Cliente" {...back} className="mx-4 lg:mx-0" />
        <div role="status" className="mx-4 mt-4 flex flex-col gap-3 lg:mx-0">
          <span className="sr-only">Cargando cliente...</span>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <PageHeader title="Cliente" {...back} className="mx-4 lg:mx-0" />
        <div role="alert" className={cn(cardClass, "mx-4 mt-4 lg:mx-0")}>
          <p className="text-sm text-[var(--color-text-muted)]">No se pudo cargar el cliente.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </Button>
        </div>
      </>
    );
  }

  const sub = detail.subscription;
  const name = detail.full_name || detail.email || "Cliente";
  const plan = detail.effective_plan ?? sub?.plan_code ?? "free";
  const status = sub?.status ?? null;

  const wsColumns = [
    { key: "name", header: "Negocio", cell: (w: CustomerWorkspace) => <span className="font-medium">{w.name}</span> },
    { key: "members", header: "Miembros", align: "right" as const, cell: (w: CustomerWorkspace) => w.members },
    {
      key: "month",
      header: "Movimientos del mes",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => w.transactions_this_month,
    },
    { key: "total", header: "Movimientos totales", align: "right" as const, cell: (w: CustomerWorkspace) => w.transactions_total },
    {
      key: "docs",
      header: "Cobros del mes",
      align: "right" as const,
      cell: (w: CustomerWorkspace) => w.collection_docs_this_month,
    },
    { key: "last", header: "Última actividad", cell: (w: CustomerWorkspace) => fmtDay(w.last_activity_at) },
  ];

  const payColumns = [
    { key: "date", header: "Fecha", cell: (p: CustomerPayment) => fmtDateTime(p.created_at) },
    { key: "ref", header: "Referencia", cell: (p: CustomerPayment) => p.reference ?? "—" },
    {
      key: "plan",
      header: "Plan",
      cell: (p: CustomerPayment) => (
        <span className="capitalize">
          {p.plan_code} · {cycleLabel(p.billing_cycle).toLowerCase()}
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
      cell: (p: CustomerPayment) => (p.declared_amount == null ? "—" : formatAmount(p.declared_amount, "COP")),
    },
    { key: "channel", header: "Medio", cell: (p: CustomerPayment) => p.channel ?? "—" },
    {
      key: "status",
      header: "Estado",
      cell: (p: CustomerPayment) => (
        <span className={cn(chipClass, PAYMENT_STATUS_CHIP[p.status])}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={name}
        subtitle={detail.full_name ? (detail.email ?? undefined) : undefined}
        {...back}
        className="mx-4 lg:mx-0"
        actions={
          <>
            <span className={cn(chipClass, "bg-[var(--color-brand)]/15 capitalize text-[var(--color-brand-light)]")}>
              {plan}
            </span>
            {status ? (
              <span className={cn(chipClass, "bg-[var(--color-surface-3)] text-[var(--color-text)]")}>
                {STATUS_LABEL[status] ?? status}
              </span>
            ) : null}
          </>
        }
      />

      <div className="mx-4 flex flex-col gap-5 lg:mx-0">
        {detail.deletion_requested_at ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4 text-sm"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden />
            <p>
              <strong>Solicitó eliminar su cuenta</strong> el {fmtDay(detail.deletion_requested_at)}.
            </p>
          </div>
        ) : null}

        <ResponsiveGrid variant="stats">
          <Fact label="Registro" value={fmtDay(detail.created_at)} />
          <Fact label="Último ingreso" value={fmtDateTime(detail.last_sign_in_at)} />
          <Fact label="Términos aceptados" value={fmtDay(detail.terms_accepted_at)} />
          <Fact
            label="Solicitud de eliminación"
            value={detail.deletion_requested_at ? fmtDay(detail.deletion_requested_at) : "Ninguna"}
            highlight={!!detail.deletion_requested_at}
          />
        </ResponsiveGrid>

        <section aria-labelledby="sub-title" className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="sub-title" className="text-sm font-semibold">
              Suscripción
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Activar o extender
            </Button>
          </div>
          {sub ? (
            <dl className="mt-2 divide-y divide-[var(--color-border)] lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
              <Row label="Plan contratado" value={sub.plan_code ? sub.plan_code.charAt(0).toUpperCase() + sub.plan_code.slice(1) : "—"} />
              <Row label="Plan vigente" value={plan.charAt(0).toUpperCase() + plan.slice(1)} />
              <Row label="Ciclo" value={cycleLabel(sub.billing_cycle)} />
              <Row label="Estado" value={status ? (STATUS_LABEL[status] ?? status) : "—"} />
              <Row label="Fin de la prueba" value={fmtDay(sub.trial_end)} />
              <Row label="Vence el" value={fmtDay(sub.current_period_end)} />
              <Row label="Gracia hasta" value={fmtDay(sub.grace_until)} />
              <Row label="Acceso provisional hasta" value={fmtDay(sub.provisional_until)} />
              <Row label="Cancela al terminar el periodo" value={sub.cancel_at_period_end ? "Sí" : "No"} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Este cliente aún no tiene suscripción.</p>
          )}
        </section>

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
                  <span>
                    Miembros: <strong className="text-[var(--color-text)]">{w.members}</strong>
                  </span>
                  <span>
                    Cobros del mes: <strong className="text-[var(--color-text)]">{w.collection_docs_this_month}</strong>
                  </span>
                  <span>
                    Movimientos del mes: <strong className="text-[var(--color-text)]">{w.transactions_this_month}</strong>
                  </span>
                  <span>
                    Totales: <strong className="text-[var(--color-text)]">{w.transactions_total}</strong>
                  </span>
                  <span className="col-span-2">
                    Última actividad: <strong className="text-[var(--color-text)]">{fmtDay(w.last_activity_at)}</strong>
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
                    <p className="text-xs capitalize text-[var(--color-text-muted)]">
                      {p.plan_code} · {cycleLabel(p.billing_cycle).toLowerCase()}
                    </p>
                  </div>
                  <span className={cn(chipClass, "shrink-0", PAYMENT_STATUS_CHIP[p.status])}>
                    {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                  </span>
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
