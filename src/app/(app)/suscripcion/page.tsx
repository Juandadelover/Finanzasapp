"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatAmountInput, parseAmountInput } from "@/lib/format";
import {
  fetchCancelAtPeriodEnd,
  fetchMySubscription,
  fetchPaymentMethods,
  fetchPayments,
  fetchPlans,
  fetchWorkspacePlan,
  setCancelAtPeriodEnd,
  startPayment,
  submitReceipt,
  type BillingCycle,
  type MySubscription,
  type Payment,
  type PaymentChannel,
  type PaymentMethod,
  type Plan,
  type PlanLimits,
  type SubscriptionStatus,
  type WorkspacePlan,
} from "@/lib/subscription";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Activo",
  grace: "En gracia",
  provisional: "Acceso provisional",
  trial: "Prueba gratis",
  free: "Gratis",
  expired: "Vencido",
};

const PAYMENT_STATUS: Record<Payment["status"], { label: string; cls: string }> = {
  awaiting_receipt: { label: "Falta comprobante", cls: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]" },
  in_review: { label: "En revisión", cls: "bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]" },
  approved: { label: "Aprobado", cls: "bg-[var(--color-income)]/15 text-[var(--color-income)]" },
  rejected: { label: "Rechazado", cls: "bg-[var(--color-expense)]/15 text-[var(--color-expense)]" },
};

const CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "nequi", label: "Nequi" },
  { value: "bancolombia", label: "Bancolombia" },
  { value: "breb", label: "Llave Bre-B" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function planPrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === "annual" ? plan.annual_price : plan.monthly_price;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  } catch {
    toast.error("No se pudo copiar.");
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)]"
    >
      <Copy size={16} aria-hidden />
    </button>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null | undefined }) {
  const unlimited = limit == null;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-medium">{unlimited ? `${used} / Ilimitado` : `${used} / ${limit}`}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit ?? 0}
        aria-valuenow={used}
        className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
      >
        <div
          className={cn("progress-fill h-full rounded-full", pct >= 100 ? "bg-[var(--color-expense)]" : "gradient-brand")}
          style={{ width: `${unlimited ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

function PaySheet({
  payment,
  planName,
  methods,
  userId,
  onClose,
  onDone,
}: {
  payment: Payment;
  planName: string;
  methods: PaymentMethod[];
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const noMethods = methods.length === 0;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [channel, setChannel] = useState<PaymentChannel>(methods[0]?.kind ?? "nequi");
  const [amount, setAmount] = useState(payment.expected_amount);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Adjunta el comprobante de pago.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera 5 MB.");
      return;
    }
    if (amount <= 0) {
      toast.error("Ingresa el monto que pagaste.");
      return;
    }
    setBusy(true);
    try {
      await submitReceipt({ paymentId: payment.id, userId, channel, declaredAmount: amount, file });
      setStep(3);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo enviar el comprobante.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Cómo pagar">
      {step === 3 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="gradient-brand flex h-12 w-12 items-center justify-center rounded-full text-white">
            <Check size={24} />
          </span>
          <p className="text-sm">Recibimos tu comprobante. Tienes 48 horas de acceso mientras lo revisamos.</p>
          <Button onClick={onClose} fullWidth>
            Listo
          </Button>
        </div>
      ) : step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">
              Plan {planName} · {payment.billing_cycle === "annual" ? "Anual" : "Mensual"}
            </p>
            <p className="mt-1 text-3xl font-bold">{formatAmount(payment.expected_amount, "COP")}</p>
            <p className="text-xs text-[var(--color-text-muted)]">COP, sin IVA</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-brand)] bg-[var(--color-brand)]/10 p-3.5">
            <p className={labelClass}>Referencia de pago</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 break-all text-2xl font-bold tracking-wider">{payment.reference}</span>
              <CopyButton text={payment.reference} label="Copiar referencia" />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Escríbela en la descripción o mensaje del pago para que podamos identificarlo.
            </p>
          </div>
          {noMethods ? (
            <p role="status" className="rounded-xl bg-[var(--color-surface-2)] p-3 text-center text-sm text-[var(--color-text-muted)]">
              Aún no hay medios de pago disponibles. Vuelve a intentarlo en unos minutos.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {methods.map((m) => (
                <div
                  key={`${m.kind}-${m.value}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{CHANNELS.find((c) => c.value === m.kind)?.label ?? m.kind}</p>
                    {m.holder_name ? (
                      <p className="text-xs text-[var(--color-text-muted)]">{m.holder_name}</p>
                    ) : null}
                    <p className="break-all text-sm">{m.value}</p>
                    {m.details ? <p className="text-xs text-[var(--color-text-muted)]">{m.details}</p> : null}
                  </div>
                  <CopyButton text={m.value} label={`Copiar dato de ${m.kind}`} />
                </div>
              ))}
            </div>
          )}
          <Button disabled={noMethods} onClick={() => setStep(2)} fullWidth>
            Ya pagué, subir comprobante
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div role="group" aria-label="Medio de pago">
            <p className={labelClass}>Medio de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  aria-pressed={channel === c.value}
                  className={cn(
                    "min-h-11 rounded-xl border px-1 py-2.5 text-sm font-medium transition active:scale-[0.97]",
                    channel === c.value
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={labelClass}>Monto pagado (COP)</span>
            <input
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(parseAmountInput(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Comprobante</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">Imagen o PDF, máximo 5 MB.</span>
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              Atrás
            </Button>
            <Button type="submit" loading={busy} className="flex-1">
              {busy ? "Enviando..." : "Enviar comprobante"}
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}

export default function SuscripcionPage() {
  const { user, currentWorkspace } = useFinance();
  const confirm = useConfirm();
  const isOwner = currentWorkspace?.role === "owner";
  const workspaceId = currentWorkspace?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [wsPlan, setWsPlan] = useState<WorkspacePlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [cancelFlag, setCancelFlag] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [starting, setStarting] = useState<string | null>(null);
  const [active, setActive] = useState<{ payment: Payment; planName: string } | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !user) return;
    setLoadError(false);
    if (!isOwner) {
      setWsPlan(await fetchWorkspacePlan(workspaceId));
      setLoading(false);
      return;
    }
    const [s, p, pay, m, c] = await Promise.all([
      fetchMySubscription(),
      fetchPlans(),
      fetchPayments(),
      fetchPaymentMethods(),
      fetchCancelAtPeriodEnd(user.id),
    ]);
    setSub(s);
    setPlans(p);
    setPayments(pay);
    setMethods(m);
    setCancelFlag(c);
    setLoading(false);
  }, [workspaceId, user, isOwner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [load]);

  const planName = (code: string | null | undefined) => plans.find((p) => p.code === code)?.name ?? code ?? "";

  async function handleChoose(plan: Plan) {
    setStarting(plan.code);
    try {
      const payment = await startPayment(plan.code, cycle);
      setActive({ payment, planName: plan.name });
      load().catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo iniciar el pago.");
    } finally {
      setStarting(null);
    }
  }

  async function handleToggleCancel() {
    const next = !cancelFlag;
    const ok = await confirm(
      next
        ? {
            title: "¿Cancelar la renovación?",
            description: "Conservas tu plan hasta que termine el periodo pagado.",
            confirmLabel: "Cancelar renovación",
            cancelLabel: "Mantener plan",
            destructive: true,
          }
        : {
            title: "¿Reanudar la renovación?",
            description: "Tu plan seguirá activo al terminar el periodo pagado.",
            confirmLabel: "Reanudar renovación",
          },
    );
    if (!ok) return;
    try {
      await setCancelAtPeriodEnd(next);
      setCancelFlag(next);
      toast.success(next ? "Renovación cancelada." : "Renovación reanudada.");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "No se pudo actualizar la renovación.");
    }
  }

  const dateLine = (() => {
    if (!sub) return null;
    if (sub.status === "trial") return sub.trial_end ? `Tu prueba termina el ${formatDate(sub.trial_end)}` : null;
    if (sub.status === "active") return sub.current_period_end ? `Vence el ${formatDate(sub.current_period_end)}` : null;
    if (sub.status === "grace") return sub.grace_until ? `Vence el ${formatDate(sub.grace_until)}` : null;
    if (sub.status === "provisional")
      return sub.provisional_until ? `Vence el ${formatDate(sub.provisional_until)}` : null;
    return null;
  })();

  const limits: PlanLimits | undefined = sub?.limits;
  const hasPaidPeriod = !!sub && ["active", "grace"].includes(sub.status) && !!sub.current_period_end;

  return (
    <>
      <AppHeader />
      <PageHeader title="Mi suscripción" backHref="/ajustes" backLabel="Ajustes" />
      <main className="mx-4 mt-4 flex flex-col gap-5 pb-8 lg:mx-0">
        {loading ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Cargando tu suscripción...</span>
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : loadError ? (
          <div role="alert" className={cardClass}>
            <p className="text-sm text-[var(--color-text-muted)]">
              No pudimos cargar tu suscripción. Revisa tu conexión e intenta de nuevo.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setLoading(true);
                load().catch(() => {
                  setLoadError(true);
                  setLoading(false);
                });
              }}
            >
              <RefreshCw size={14} aria-hidden /> Reintentar
            </Button>
          </div>
        ) : !isOwner ? (
          <div className={cardClass}>
            <p className={labelClass}>Plan del negocio</p>
            <p className="text-lg font-semibold capitalize">{wsPlan?.effective_plan ?? "—"}</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">El plan lo gestiona el dueño del negocio.</p>
          </div>
        ) : (
          <>
            {sub ? (
              <section className={cn(cardClass, "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-x-8 lg:p-6")}>
                <div className="flex items-start justify-between gap-3 lg:col-start-1 lg:row-start-1">
                  <div>
                    <p className={labelClass}>Tu plan</p>
                    <p className="text-xl font-bold">{planName(sub.effective_plan)}</p>
                    {dateLine ? <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{dateLine}</p> : null}
                  </div>
                  <span className="rounded-full bg-[var(--color-brand)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-brand-light)]">
                    {STATUS_LABEL[sub.status]}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3.5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:grid lg:grid-cols-3 lg:gap-6">
                  <Meter label="Movimientos este mes" used={sub.usage.tx_this_month} limit={limits?.max_tx_per_month} />
                  <Meter
                    label="Documentos de cobro este mes"
                    used={sub.usage.collection_docs_this_month}
                    limit={limits?.max_collection_docs_per_month}
                  />
                  <Meter label="Negocios" used={sub.usage.workspaces_owned} limit={limits?.max_workspaces_owned} />
                </div>
                {hasPaidPeriod ? (
                  <div className="lg:col-start-1 lg:row-start-2">
                    {cancelFlag ? (
                      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                        La renovación está cancelada: conservas tu plan hasta que termine el periodo pagado.
                      </p>
                    ) : null}
                    <Button variant="secondary" onClick={handleToggleCancel} fullWidth className="mt-3 lg:w-fit">
                      {cancelFlag ? "Reanudar renovación" : "Cancelar renovación"}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : (
              <p role="alert" className="text-sm text-[var(--color-text-muted)]">No se pudo cargar tu suscripción. Recarga la página para intentarlo otra vez.</p>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Planes</h2>
                <div role="group" aria-label="Ciclo de pago" className="flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5 text-sm font-medium">
                  {(["monthly", "annual"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      aria-pressed={cycle === c}
                      className={cn(
                        "min-h-11 rounded-xl px-4 transition active:scale-[0.97]",
                        cycle === c ? "gradient-brand text-white" : "text-[var(--color-text-muted)]"
                      )}
                    >
                      {c === "monthly" ? "Mensual" : "Anual"}
                    </button>
                  ))}
                </div>
              </div>
              {cycle === "annual" ? (
                <p className="mb-2 text-xs text-[var(--color-income)]">Pagas el año y te ahorras 2 meses.</p>
              ) : null}
              <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] lg:gap-4">
                {plans.map((plan) => {
                  const current = sub?.plan_code === plan.code && ["active", "grace"].includes(sub.status);
                  const price = planPrice(plan, cycle);
                  const free = plan.monthly_price === 0 && plan.annual_price === 0;
                  return (
                    <div
                      key={plan.code}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border bg-[var(--color-surface)] p-4 lg:flex-col lg:items-stretch lg:gap-4 lg:p-5",
                        current ? "border-[var(--color-brand)]" : "border-[var(--color-border)]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {plan.name}
                          {current ? (
                            <span className="ml-2 text-xs font-medium text-[var(--color-brand-light)]">Plan actual</span>
                          ) : null}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {free ? "Gratis" : `${formatAmount(price, "COP")} / ${cycle === "annual" ? "año" : "mes"}`}
                        </p>
                        {!free ? <p className="text-xs text-[var(--color-text-muted)]">Sin IVA</p> : null}
                      </div>
                      {!free ? (
                        <Button
                          disabled={starting !== null}
                          loading={starting === plan.code}
                          onClick={() => handleChoose(plan)}
                          aria-label={`Elegir plan ${plan.name}`}
                        >
                          Elegir
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold">Historial de pagos</h2>
              {payments.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Aún no tienes pagos. Cuando elijas un plan, aquí verás cada pago y su estado.</p>
              ) : (
                <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
                  {payments.map((p) => {
                    const st = PAYMENT_STATUS[p.status];
                    return (
                      <div key={p.id} className={cardClass}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold">{p.reference}</span>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", st.cls)}>
                            {st.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {planName(p.plan_code)} · {p.billing_cycle === "annual" ? "Anual" : "Mensual"} ·{" "}
                          {formatAmount(p.expected_amount, "COP")}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{formatDate(p.created_at)}</p>
                        {p.status === "rejected" && p.rejection_reason ? (
                          <p className="mt-1 text-sm text-[var(--color-expense)]">{p.rejection_reason}</p>
                        ) : null}
                        {p.status === "awaiting_receipt" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-2 text-[var(--color-brand-light)]"
                            onClick={() => setActive({ payment: p, planName: planName(p.plan_code) })}
                          >
                            Subir comprobante
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {active && user ? (
        <PaySheet
          payment={active.payment}
          planName={active.planName}
          methods={methods}
          userId={user.id}
          onClose={() => setActive(null)}
          onDone={() => load().catch(() => {})}
        />
      ) : null}
    </>
  );
}
