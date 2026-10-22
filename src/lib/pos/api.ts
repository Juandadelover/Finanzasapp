import { createClient } from "@/lib/supabase/client";
import type { Discount, PaymentMethod, PosConfirmResult, Sale, SaleItem, SaleItemCost, SaleKind, SalePayment, SaleStatus } from "@/types/pos";

export { inventoryErrorMessage } from "@/lib/inventory/errors";

// Todas las funciones lanzan el error de Supabase; la UI lo traduce con `inventoryErrorMessage`.

type PgError = { message: string; code?: string };

function fail(error: PgError | null): asserts error is null {
  if (error) throw error;
}

const num = (v: unknown): number => Number(v);

function mapSale(r: Sale): Sale {
  return {
    ...r,
    subtotal: num(r.subtotal),
    line_discount_total: num(r.line_discount_total),
    total_discount: num(r.total_discount),
    total: num(r.total),
    paid_now: num(r.paid_now),
    balance: num(r.balance),
  };
}
const mapItem = (r: SaleItem): SaleItem => ({ ...r, quantity: num(r.quantity), unit_price: num(r.unit_price), line_total: num(r.line_total) });
const mapPayment = (r: SalePayment): SalePayment => ({ ...r, amount: num(r.amount), received: num(r.received), change: num(r.change) });

export interface PaymentInput {
  method: PaymentMethod;
  accountId: string;
  /** En efectivo es lo recibido (puede superar el total: la diferencia son las vueltas). */
  amount: number;
}

export interface ConfirmSaleInput {
  workspaceId: string;
  kind: SaleKind;
  contactId: string | null;
  /** Sin precio: el servidor usa el de `products`. */
  lines: { productId: string; quantity: number; discount: Discount | null }[];
  totalDiscount: Discount | null;
  /** Contado. */
  payments: PaymentInput[];
  /** Crédito: abono inicial opcional. */
  initialPayment: PaymentInput | null;
  notes: string;
}

const paymentParam = (p: PaymentInput) => ({ method: p.method, account_id: p.accountId, amount: p.amount });

export async function confirmSale(input: ConfirmSaleInput): Promise<PosConfirmResult> {
  const cash = input.kind === "cash";
  const { data, error } = await createClient().rpc("pos_confirm_sale", {
    p_workspace: input.workspaceId,
    p_kind: input.kind,
    p_contact: input.contactId,
    p_lines: input.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, discount: l.discount })),
    p_total_discount: input.totalDiscount,
    p_payments: cash ? input.payments.map(paymentParam) : [],
    p_initial_payment: !cash && input.initialPayment ? paymentParam(input.initialPayment) : null,
    p_notes: input.notes.trim() || null,
  });
  fail(error);
  const r = data as PosConfirmResult;
  return { sale_id: r.sale_id, number: num(r.number), total: num(r.total), balance: num(r.balance) };
}

export async function voidSale(saleId: string, reason: string): Promise<void> {
  const { error } = await createClient().rpc("pos_void_sale", { p_sale: saleId, p_reason: reason.trim() });
  fail(error);
}

export interface SaleFilters {
  /** yyyy-MM-dd, hora de Bogotá, ambos incluidos. */
  from?: string;
  to?: string;
  kind?: SaleKind;
  status?: SaleStatus;
}

export type SaleListRow = Sale & { contact_name: string | null };

export async function listSales(ws: string, filters: SaleFilters = {}): Promise<SaleListRow[]> {
  let q = createClient().from("sales").select("*, contacts(name)").eq("workspace_id", ws);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00-05:00`);
  if (filters.to) q = q.lt("created_at", `${nextDay(filters.to)}T00:00:00-05:00`);
  if (filters.kind) q = q.eq("kind", filters.kind);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q.order("number", { ascending: false });
  fail(error);
  return ((data ?? []) as (Sale & { contacts: { name: string } | null })[]).map(({ contacts, ...s }) => ({ ...mapSale(s as Sale), contact_name: contacts?.name ?? null }));
}

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface SaleContact {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  address: string | null;
}

export interface SaleDetail {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
  contact: SaleContact | null;
  /** Costo por línea (sale_item_id → costo); vacío si el rol no puede verlos. */
  costs: Record<string, number>;
}

export async function getSale(saleId: string): Promise<SaleDetail | null> {
  const supabase = createClient();
  const s = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
  fail(s.error);
  if (!s.data) return null;
  const sale = mapSale(s.data as Sale);
  const [items, payments, contact, costs] = await Promise.all([
    supabase.from("sale_items").select("*").eq("sale_id", saleId).order("position"),
    supabase.from("sale_payments").select("*").eq("sale_id", saleId).order("id"),
    sale.contact_id ? supabase.from("contacts").select("id, name, document, phone, address").eq("id", sale.contact_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("sale_item_costs").select("*").eq("workspace_id", sale.workspace_id),
  ]);
  fail(items.error);
  fail(payments.error);
  fail(contact.error);
  const mappedItems = ((items.data ?? []) as SaleItem[]).map(mapItem);
  const ids = new Set(mappedItems.map((i) => i.id));
  // RLS oculta los costos a quien no debe verlos: la consulta vuelve vacía, no con error.
  const costMap: Record<string, number> = {};
  for (const c of (costs.error ? [] : ((costs.data ?? []) as SaleItemCost[]))) if (ids.has(c.sale_item_id)) costMap[c.sale_item_id] = num(c.unit_cost);
  return {
    sale,
    items: mappedItems,
    payments: ((payments.data ?? []) as SalePayment[]).map(mapPayment),
    contact: (contact.data as SaleContact | null) ?? null,
    costs: costMap,
  };
}

export interface PosSettings {
  maxDiscountPct: number;
  allowNegativeStock: boolean;
}

export async function getPosSettings(ws: string): Promise<PosSettings> {
  const { data, error } = await createClient().from("workspaces").select("pos_max_discount_pct, pos_allow_negative_stock").eq("id", ws).single();
  fail(error);
  const r = data as { pos_max_discount_pct: number | string; pos_allow_negative_stock: boolean };
  return { maxDiscountPct: num(r.pos_max_discount_pct), allowNegativeStock: r.pos_allow_negative_stock };
}

export async function updatePosSettings(input: PosSettings & { workspaceId: string }): Promise<void> {
  const { error } = await createClient().rpc("pos_update_settings", {
    p_workspace: input.workspaceId,
    p_max_discount_pct: input.maxDiscountPct,
    p_allow_negative_stock: input.allowNegativeStock,
  });
  fail(error);
}
