"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
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
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)]"
    >
      <Copy size={15} />
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
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-[var(--color-expense)]" : "gradient-brand")}
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
          <button
            type="button"
            onClick={onClose}
            className="gradient-brand w-full rounded-xl py-3 text-sm font-semibold text-white"
          >
            Listo
          </button>
        </div>
      ) : step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-faint)]">
              Plan {planName} · {payment.billing_cycle === "annual" ? "Anual" : "Mensual"}
            </p>
            <p className="mt-1 text-3xl font-bold">{formatAmount(payment.expected_amount, "COP")}</p>
            <p className="text-xs text-[var(--color-text-faint)]">COP, sin IVA</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-brand)] bg-[var(--color-brand)]/10 p-3.5">
            <p className={labelClass}>Referencia</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 break-all text-2xl font-bold tracking-wider">{payment.reference}</span>
              <CopyButton text={payment.reference} label="Copiar referencia" />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Escribe esta referencia en la descripción del pago
            </p>
          </div>
          {noMethods ? (
            <p className="rounded-xl bg-[var(--color-surface-2)] p-3 text-center text-sm text-[var(--color-text-muted)]">
              Pronto publicaremos los datos de pago
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
                    {m.details ? <p className="text-xs text-[var(--color-text-faint)]">{m.details}</p> : null}
                  </div>
                  <CopyButton text={m.value} label={`Copiar dato de ${m.kind}`} />
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={noMethods}
            onClick={() => setStep(2)}
            className="gradient-brand w-full rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99] disabled:opacity-50"
          >
            Ya pagué, subir comprobante
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Medio de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  className={cn(
                    "rounded-xl border py-2.5 text-xs font-medium transition",
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
          <div>
            <label className={labelClass}>Monto pagado</label>
            <input
              inputMode="numeric"
              value={formatAmountInput(amount)}
              onChange={(e) => setAmount(parseAmountInput(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Comprobante (imagen o PDF, máx. 5 MB)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={busy}
              className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] disabled:opacity-60"
            >
              {busy ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}

export default function SuscripcionPage() {
  const { user, currentWorkspace } = useFinance();
  const isOwner = currentWorkspace?.role === "owner";
  const workspaceId = currentWorkspace?.id ?? null;

  const [loading, setLoading] = useState(true);
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
    load().catch(() => setLoading(false));
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
    const msg = next
      ? "¿Cancelar la renovación? Conservas tu plan hasta que termine el periodo pagado."
      : "¿Reanudar la renovación de tu plan?";
    if (!window.confirm(msg)) return;
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
      <main className="flex flex-col gap-5 px-4 pt-5">
        <h1 className="text-xl font-bold">Mi suscripción</h1>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
        ) : !isOwner ? (
          <div className={cardClass}>
            <p className={labelClass}>Plan del negocio</p>
            <p className="text-lg font-semibold capitalize">{wsPlan?.effective_plan ?? "—"}</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">El plan lo gestiona el dueño del negocio.</p>
          </div>
        ) : (
          <>
            {sub ? (
              <section className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={labelClass}>Tu plan</p>
                    <p className="text-xl font-bold">{planName(sub.effective_plan)}</p>
                    {dateLine ? <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{dateLine}</p> : null}
                  </div>
                  <span className="rounded-full bg-[var(--color-brand)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-brand-light)]">
                    {STATUS_LABEL[sub.status]}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3.5">
                  <Meter label="Movimientos este mes" used={sub.usage.tx_this_month} limit={limits?.max_tx_per_month} />
                  <Meter
                    label="Documentos de cobro este mes"
                    used={sub.usage.collection_docs_this_month}
                    limit={limits?.max_collection_docs_per_month}
                  />
                  <Meter label="Negocios" used={sub.usage.workspaces_owned} limit={limits?.max_workspaces_owned} />
                </div>
                {hasPaidPeriod ? (
                  <button
                    type="button"
                    onClick={handleToggleCancel}
                    className="mt-4 w-full rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
                  >
                    {cancelFlag ? "Reanudar" : "Cancelar renovación"}
                  </button>
                ) : null}
              </section>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No se pudo cargar tu suscripción.</p>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Planes</h2>
                <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5 text-xs font-medium">
                  {(["monthly", "annual"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      className={cn(
                        "rounded-[10px] px-3 py-1.5 transition",
                        cycle === c ? "gradient-brand text-white" : "text-[var(--color-text-muted)]"
                      )}
                    >
                      {c === "monthly" ? "Mensual" : "Anual"}
                    </button>
                  ))}
                </div>
              </div>
              {cycle === "annual" ? (
                <p className="mb-2 text-xs text-[var(--color-income)]">Paga anual y obtén 2 meses gratis</p>
              ) : null}
              <div className="flex flex-col gap-3">
                {plans.map((plan) => {
                  const current = sub?.plan_code === plan.code && ["active", "grace"].includes(sub.status);
                  const price = planPrice(plan, cycle);
                  const free = plan.monthly_price === 0 && plan.annual_price === 0;
                  return (
                    <div
                      key={plan.code}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border bg-[var(--color-surface)] p-4",
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
                        {!free ? <p className="text-xs text-[var(--color-text-faint)]">Sin IVA</p> : null}
                      </div>
                      {!free ? (
                        <button
                          type="button"
                          disabled={starting !== null}
                          onClick={() => handleChoose(plan)}
                          className="gradient-brand rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {starting === plan.code ? "..." : "Elegir"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold">Historial de pagos</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Aún no tienes pagos.</p>
              ) : (
                <div className="flex flex-col gap-2">
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
                        <p className="text-xs text-[var(--color-text-faint)]">{formatDate(p.created_at)}</p>
                        {p.status === "rejected" && p.rejection_reason ? (
                          <p className="mt-1 text-sm text-[var(--color-expense)]">{p.rejection_reason}</p>
                        ) : null}
                        {p.status === "awaiting_receipt" ? (
                          <button
                            type="button"
                            onClick={() => setActive({ payment: p, planName: planName(p.plan_code) })}
                            className="mt-2 text-sm font-semibold text-[var(--color-brand-light)]"
                          >
                            Subir comprobante
                          </button>
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
