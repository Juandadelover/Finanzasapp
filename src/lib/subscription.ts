import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type SubscriptionStatus = "active" | "grace" | "provisional" | "trial" | "free" | "expired";
export type BillingCycle = "monthly" | "annual";
export type PaymentChannel = "nequi" | "bancolombia" | "breb";
export type PaymentStatus = "awaiting_receipt" | "in_review" | "approved" | "rejected";

export interface PlanLimits {
  max_workspaces_owned: number | null;
  max_members: number | null;
  max_tx_per_month: number | null;
  max_collection_docs_per_month: number | null;
  [key: string]: number | null | undefined;
}

export interface MySubscription {
  effective_plan: string;
  status: SubscriptionStatus;
  plan_code: string | null;
  billing_cycle: BillingCycle | null;
  trial_end: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  provisional_until: string | null;
  provisional_plan: string | null;
  cancel_at_period_end?: boolean | null;
  limits: PlanLimits;
  usage: { workspaces_owned: number; tx_this_month: number; collection_docs_this_month: number };
}

export interface WorkspacePlan {
  effective_plan: string;
  limits: PlanLimits;
}

export interface Plan {
  code: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  sort_order: number;
  active: boolean;
}

export interface Payment {
  id: string;
  reference: string;
  plan_code: string;
  billing_cycle: BillingCycle;
  expected_amount: number;
  status: PaymentStatus;
  rejection_reason: string | null;
  created_at: string;
  receipt_path: string | null;
}

export interface PaymentMethod {
  kind: PaymentChannel;
  holder_name: string | null;
  value: string;
  details: string | null;
  active: boolean;
  sort_order: number;
}

export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  max_tx_per_month: "Llegaste al límite de 100 movimientos del plan Gratis este mes.",
  max_collection_docs_per_month: "Llegaste al límite de documentos de cobro de tu plan este mes.",
  max_workspaces_owned: "Llegaste al límite de negocios de tu plan.",
  max_members: "Llegaste al límite de miembros de tu plan.",
};

const DEFAULT_LIMIT_MESSAGE = "Llegaste al límite de tu plan actual.";

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) return String((error as { message: unknown }).message ?? "");
  return "";
}

export function isPlanLimitError(error: unknown): boolean {
  return errorMessage(error).includes("LIMITE_PLAN:");
}

export function planLimitMessage(error: unknown): string {
  const match = errorMessage(error).match(/LIMITE_PLAN:([a-z_]+)/);
  return (match && PLAN_LIMIT_MESSAGES[match[1]]) || DEFAULT_LIMIT_MESSAGE;
}

/** Muestra el toast de límite de plan (con acción "Ver planes") o el mensaje genérico. */
export function toastDbError(error: unknown, fallback: string) {
  if (isPlanLimitError(error)) {
    toast.error(planLimitMessage(error), {
      action: { label: "Ver planes", onClick: () => { window.location.href = "/suscripcion"; } },
    });
  } else {
    toast.error(fallback);
  }
}

export async function fetchMySubscription(): Promise<MySubscription | null> {
  const { data, error } = await createClient().rpc("my_subscription");
  if (error || !data) return null;
  return data as MySubscription;
}

export async function fetchWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | null> {
  const { data, error } = await createClient().rpc("workspace_plan", { p_workspace: workspaceId });
  if (error || !data) return null;
  return data as WorkspacePlan;
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await createClient()
    .from("plans")
    .select("code, name, monthly_price, annual_price, sort_order, active")
    .eq("active", true)
    .order("sort_order");
  return (data as Plan[] | null) ?? [];
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data } = await createClient()
    .from("payments")
    .select("id, reference, plan_code, billing_cycle, expected_amount, status, rejection_reason, created_at, receipt_path")
    .order("created_at", { ascending: false });
  return (data as Payment[] | null) ?? [];
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await createClient()
    .from("payment_methods_config")
    .select("kind, holder_name, value, details, active, sort_order")
    .eq("active", true)
    .order("sort_order");
  return (data as PaymentMethod[] | null) ?? [];
}

export async function startPayment(plan: string, cycle: BillingCycle): Promise<Payment> {
  const { data, error } = await createClient().rpc("start_payment", { p_plan: plan, p_cycle: cycle });
  if (error || !data) throw new Error(error?.message ?? "No se pudo iniciar el pago.");
  return data as Payment;
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function submitReceipt(args: {
  paymentId: string;
  userId: string;
  channel: PaymentChannel;
  declaredAmount: number;
  file: File;
}): Promise<void> {
  const supabase = createClient();
  const safeName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${args.userId}/${Date.now()}-${safeName}`;
  const hash = await sha256Hex(args.file);
  const { error: upErr } = await supabase.storage
    .from("payment-receipts")
    .upload(path, args.file, { contentType: args.file.type, upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase.rpc("submit_payment_receipt", {
    p_payment: args.paymentId,
    p_channel: args.channel,
    p_declared_amount: args.declaredAmount,
    p_receipt_path: path,
    p_receipt_sha256: hash,
  });
  if (error) throw new Error(error.message);
}

export async function setCancelAtPeriodEnd(cancel: boolean): Promise<void> {
  const { error } = await createClient().rpc("set_cancel_at_period_end", { p_cancel: cancel });
  if (error) throw new Error(error.message);
}

export async function fetchIsPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await createClient().from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

/** my_subscription() no devuelve este flag; se lee de la tabla (si RLS lo permite). */
export async function fetchCancelAtPeriodEnd(userId: string): Promise<boolean> {
  const { data } = await createClient()
    .from("subscriptions")
    .select("cancel_at_period_end")
    .eq("owner_id", userId)
    .maybeSingle();
  return !!(data as { cancel_at_period_end?: boolean } | null)?.cancel_at_period_end;
}
