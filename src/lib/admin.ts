import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type PaymentStatus = "in_review" | "approved" | "rejected" | "awaiting_receipt";
export type PaymentFilter = PaymentStatus | "all";

export interface AdminMetrics {
  mrr: number;
  paying: number;
  by_plan: Record<string, number>;
  in_review: number;
  expiring_7d: number;
  in_grace: number;
  trials: number;
  revenue_this_month: number;
}

export interface AdminPayment {
  id: string;
  owner_id: string;
  email: string | null;
  full_name: string | null;
  plan_code: string;
  billing_cycle: string;
  expected_amount: number;
  declared_amount: number | null;
  reference: string | null;
  channel: string | null;
  status: PaymentStatus;
  receipt_path: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  current_plan: string | null;
}

export interface AdminCustomer {
  owner_id: string;
  email: string | null;
  full_name: string | null;
  plan_code: string | null;
  billing_cycle: string | null;
  status: string | null;
  effective_plan: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  workspaces: number;
  created_at: string;
}

export interface PlanRow {
  code: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  sort_order: number;
  active: boolean;
}

export type PaymentMethodKind = "nequi" | "bancolombia" | "breb";

export interface PaymentMethodConfig {
  id: string;
  kind: PaymentMethodKind;
  holder_name: string | null;
  value: string | null;
  details: string | null;
  active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

function fail(e: { message?: string } | null | undefined, fallback: string): string {
  const msg = e?.message?.trim();
  const text = msg && msg.length < 160 ? msg : fallback;
  toast.error(text);
  return text;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function checkIsAdmin(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const { data, error } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

export async function fetchAdminMetrics(): Promise<AdminMetrics | null> {
  const { data, error } = await createClient().rpc("admin_metrics");
  if (error || !data) {
    fail(error, "No se pudieron cargar las métricas.");
    return null;
  }
  const d = data as Record<string, unknown>;
  const byPlan: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.by_plan as Record<string, unknown>) ?? {})) byPlan[k] = num(v);
  return {
    mrr: num(d.mrr),
    paying: num(d.paying),
    by_plan: byPlan,
    in_review: num(d.in_review),
    expiring_7d: num(d.expiring_7d),
    in_grace: num(d.in_grace),
    trials: num(d.trials),
    revenue_this_month: num(d.revenue_this_month),
  };
}

export async function fetchAdminPayments(status: PaymentFilter): Promise<AdminPayment[] | null> {
  const { data, error } = await createClient().rpc("admin_payments", { p_status: status });
  if (error) {
    fail(error, "No se pudieron cargar los pagos.");
    return null;
  }
  return ((data ?? []) as AdminPayment[]).map((p) => ({
    ...p,
    expected_amount: num(p.expected_amount),
    declared_amount: p.declared_amount == null ? null : num(p.declared_amount),
  }));
}

export async function approvePayment(id: string): Promise<boolean> {
  const { error } = await createClient().rpc("approve_payment", { p_payment: id });
  if (error) {
    fail(error, "No se pudo aprobar el pago.");
    return false;
  }
  toast.success("Pago aprobado.");
  return true;
}

export async function rejectPayment(id: string, reason: string): Promise<boolean> {
  const { error } = await createClient().rpc("reject_payment", { p_payment: id, p_reason: reason });
  if (error) {
    fail(error, "No se pudo rechazar el pago.");
    return false;
  }
  toast.success("Pago rechazado.");
  return true;
}

export async function fetchAdminCustomers(search: string): Promise<AdminCustomer[] | null> {
  const { data, error } = await createClient().rpc("admin_customers", { p_search: search });
  if (error) {
    fail(error, "No se pudieron cargar los clientes.");
    return null;
  }
  return ((data ?? []) as AdminCustomer[]).map((c) => ({ ...c, workspaces: num(c.workspaces) }));
}

export async function setSubscription(args: {
  owner: string;
  plan: string;
  cycle: string;
  periodEnd: string;
  reason: string;
}): Promise<boolean> {
  const { error } = await createClient().rpc("admin_set_subscription", {
    p_owner: args.owner,
    p_plan: args.plan,
    p_cycle: args.cycle,
    p_period_end: args.periodEnd,
    p_reason: args.reason,
  });
  if (error) {
    fail(error, "No se pudo actualizar la suscripción.");
    return false;
  }
  toast.success("Suscripción actualizada.");
  return true;
}

export async function getReceiptUrl(path: string): Promise<string | null> {
  const { data, error } = await createClient().storage.from("payment-receipts").createSignedUrl(path, 300);
  if (error || !data) {
    fail(error, "No se pudo abrir el comprobante.");
    return null;
  }
  return data.signedUrl;
}

export async function fetchPlans(): Promise<PlanRow[] | null> {
  const { data, error } = await createClient().from("plans").select("*").order("sort_order");
  if (error) {
    fail(error, "No se pudieron cargar los planes.");
    return null;
  }
  return ((data ?? []) as PlanRow[]).map((p) => ({
    ...p,
    monthly_price: num(p.monthly_price),
    annual_price: num(p.annual_price),
  }));
}

export async function updatePlan(
  code: string,
  patch: Pick<PlanRow, "monthly_price" | "annual_price" | "active">
): Promise<boolean> {
  const { error } = await createClient().from("plans").update(patch).eq("code", code);
  if (error) {
    fail(error, "No se pudo guardar el plan.");
    return false;
  }
  toast.success("Plan guardado.");
  return true;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodConfig[] | null> {
  const { data, error } = await createClient()
    .from("payment_methods_config")
    .select("*")
    .order("sort_order");
  if (error) {
    fail(error, "No se pudieron cargar los medios de pago.");
    return null;
  }
  return (data ?? []) as PaymentMethodConfig[];
}

export async function savePaymentMethod(
  kind: PaymentMethodKind,
  existingId: string | null,
  values: { holder_name: string; value: string; details: string; active: boolean; sort_order: number }
): Promise<boolean> {
  const supabase = createClient();
  const payload = { ...values, updated_at: new Date().toISOString() };
  const { error } = existingId
    ? await supabase.from("payment_methods_config").update(payload).eq("id", existingId)
    : await supabase.from("payment_methods_config").insert({ kind, ...payload });
  if (error) {
    fail(error, "No se pudo guardar el medio de pago.");
    return false;
  }
  toast.success("Medio de pago guardado.");
  return true;
}

export async function fetchAuditLog(limit = 50): Promise<AuditEntry[] | null> {
  const { data, error } = await createClient()
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    fail(error, "No se pudo cargar la auditoría.");
    return null;
  }
  return (data ?? []) as AuditEntry[];
}

export interface CustomerSubscription {
  plan_code: string | null;
  billing_cycle: string | null;
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  provisional_until: string | null;
  cancel_at_period_end: boolean;
}

export interface CustomerWorkspace {
  id: string;
  name: string;
  created_at: string;
  members: number;
  transactions_total: number;
  transactions_this_month: number;
  collection_docs_this_month: number;
  last_activity_at: string | null;
}

export interface CustomerPayment {
  id: string;
  reference: string | null;
  plan_code: string;
  billing_cycle: string;
  expected_amount: number;
  declared_amount: number | null;
  channel: string | null;
  status: PaymentStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Ficha del cliente. Por privacidad no incluye montos ni movimientos del cliente, solo conteos. */
export interface AdminCustomerDetail {
  owner_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  terms_accepted_at: string | null;
  deletion_requested_at: string | null;
  effective_plan: string | null;
  subscription: CustomerSubscription | null;
  workspaces: CustomerWorkspace[];
  payments: CustomerPayment[];
}

export interface RevenuePoint {
  /** Primer día del mes (YYYY-MM-DD). */
  month: string;
  revenue: number;
  approved_payments: number;
  new_signups: number;
  new_paying: number;
  expired: number;
  trials_started: number;
  trials_converted: number;
}

export async function fetchAdminCustomerDetail(owner: string): Promise<AdminCustomerDetail | null> {
  const { data, error } = await createClient().rpc("admin_customer_detail", { p_owner: owner });
  if (error || !data) {
    fail(error, "No se pudo cargar el cliente.");
    return null;
  }
  const d = data as Record<string, unknown>;
  const sub = d.subscription as Record<string, unknown> | null | undefined;
  return {
    owner_id: String(d.owner_id ?? owner),
    email: (d.email as string | null) ?? null,
    full_name: (d.full_name as string | null) ?? null,
    created_at: (d.created_at as string | null) ?? null,
    last_sign_in_at: (d.last_sign_in_at as string | null) ?? null,
    terms_accepted_at: (d.terms_accepted_at as string | null) ?? null,
    deletion_requested_at: (d.deletion_requested_at as string | null) ?? null,
    effective_plan: (d.effective_plan as string | null) ?? null,
    subscription: sub
      ? {
          plan_code: (sub.plan_code as string | null) ?? null,
          billing_cycle: (sub.billing_cycle as string | null) ?? null,
          status: (sub.status as string | null) ?? null,
          trial_end: (sub.trial_end as string | null) ?? null,
          current_period_end: (sub.current_period_end as string | null) ?? null,
          grace_until: (sub.grace_until as string | null) ?? null,
          provisional_until: (sub.provisional_until as string | null) ?? null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
        }
      : null,
    workspaces: ((d.workspaces as CustomerWorkspace[] | null) ?? []).map((w) => ({
      ...w,
      members: num(w.members),
      transactions_total: num(w.transactions_total),
      transactions_this_month: num(w.transactions_this_month),
      collection_docs_this_month: num(w.collection_docs_this_month),
    })),
    payments: ((d.payments as CustomerPayment[] | null) ?? []).map((p) => ({
      ...p,
      expected_amount: num(p.expected_amount),
      declared_amount: p.declared_amount == null ? null : num(p.declared_amount),
    })),
  };
}

export async function fetchRevenueSeries(months: number): Promise<RevenuePoint[] | null> {
  const { data, error } = await createClient().rpc("admin_revenue_series", { p_months: months });
  if (error) {
    fail(error, "No se pudieron cargar los ingresos.");
    return null;
  }
  return ((data ?? []) as RevenuePoint[]).map((r) => ({
    month: String(r.month).slice(0, 10),
    revenue: num(r.revenue),
    approved_payments: num(r.approved_payments),
    new_signups: num(r.new_signups),
    new_paying: num(r.new_paying),
    expired: num(r.expired),
    trials_started: num(r.trials_started),
    trials_converted: num(r.trials_converted),
  }));
}
