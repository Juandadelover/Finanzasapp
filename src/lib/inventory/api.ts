import { createClient } from "@/lib/supabase/client";
import type { Product, ProductCategory, ProductCost, ProductUnit, StockMovement, StockReceipt } from "@/types/inventory";
import type { ImportRow } from "./importRows";

export { inventoryErrorMessage } from "./errors";

// Todas las funciones lanzan el error de Supabase; la UI lo traduce con `inventoryErrorMessage`.

type PgError = { message: string; code?: string };

function fail(error: PgError | null): asserts error is null {
  if (!error) return;
  // Violación de único (código de barras repetido) → mensaje de dominio.
  if (error.code === "23505" && /barcode/i.test(error.message)) throw new Error("CODIGO_DUPLICADO");
  throw error;
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

function mapProduct(r: Product): Product {
  return { ...r, price_cash: num(r.price_cash), price_credit: num(r.price_credit), stock: num(r.stock), min_stock: num(r.min_stock) };
}

function mapReceipt(r: StockReceipt): StockReceipt {
  return { ...r, total_cost: numOrNull(r.total_cost) };
}

function mapMovement(r: StockMovement): StockMovement {
  return { ...r, quantity: num(r.quantity), stock_after: num(r.stock_after), unit_cost: numOrNull(r.unit_cost), avg_cost_after: numOrNull(r.avg_cost_after) };
}

export async function listProducts(ws: string): Promise<Product[]> {
  const { data, error } = await createClient().from("products").select("*").eq("workspace_id", ws).order("name");
  fail(error);
  return ((data ?? []) as Product[]).map(mapProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await createClient().from("products").select("*").eq("id", id).maybeSingle();
  fail(error);
  return data ? mapProduct(data as Product) : null;
}

export async function listCategories(ws: string): Promise<ProductCategory[]> {
  const { data, error } = await createClient().from("product_categories").select("*").eq("workspace_id", ws).order("name");
  fail(error);
  return (data ?? []) as ProductCategory[];
}

export async function createCategory(ws: string, name: string): Promise<ProductCategory> {
  const { data, error } = await createClient().from("product_categories").insert({ workspace_id: ws, name: name.trim() }).select("*").single();
  fail(error);
  return data as ProductCategory;
}

export interface SaveProductInput {
  id?: string;
  workspaceId: string;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  unit: ProductUnit;
  priceCash: number;
  priceCredit: number;
  minStock: number;
}

/** Crea o edita un producto (el stock nunca se escribe aquí: nace en 0 y lo mueven las funciones). */
export async function saveProduct(input: SaveProductInput): Promise<Product> {
  const row = {
    workspace_id: input.workspaceId,
    barcode: input.barcode?.trim() || null,
    name: input.name.trim(),
    category_id: input.categoryId,
    unit: input.unit,
    price_cash: input.priceCash,
    price_credit: input.priceCredit,
    min_stock: input.minStock,
  };
  const q = createClient().from("products");
  const { data, error } = input.id
    ? await q.update(row).eq("id", input.id).select("*").single()
    : await q.insert(row).select("*").single();
  fail(error);
  return mapProduct(data as Product);
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await createClient().from("products").update({ active }).eq("id", id);
  fail(error);
}

export async function listProductCosts(ws: string): Promise<ProductCost[]> {
  const { data, error } = await createClient().from("product_costs").select("*").eq("workspace_id", ws);
  fail(error);
  return ((data ?? []) as ProductCost[]).map((c) => ({ ...c, avg_cost: num(c.avg_cost) }));
}

export async function listMovements(productId: string): Promise<StockMovement[]> {
  const { data, error } = await createClient().from("stock_movements").select("*").eq("product_id", productId).order("id", { ascending: false });
  fail(error);
  return ((data ?? []) as StockMovement[]).map(mapMovement);
}

export async function listReceipts(ws: string): Promise<StockReceipt[]> {
  const { data, error } = await createClient().from("stock_receipts").select("*").eq("workspace_id", ws).order("number", { ascending: false });
  fail(error);
  return ((data ?? []) as StockReceipt[]).map(mapReceipt);
}

export interface ReceiptLine {
  product_id: string;
  quantity: number;
  unit_cost: number | null;
}

export async function getReceipt(id: string): Promise<{ receipt: StockReceipt; lines: StockMovement[] } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("stock_receipts").select("*").eq("id", id).maybeSingle();
  fail(error);
  if (!data) return null;
  const mv = await supabase.from("stock_movements").select("*").eq("receipt_id", id).order("id");
  fail(mv.error);
  return { receipt: mapReceipt(data as StockReceipt), lines: ((mv.data ?? []) as StockMovement[]).map(mapMovement) };
}

export interface ExpenseOption {
  create: boolean;
  accountId: string | null;
  status: "paid" | "pending";
  dueDate: string | null;
}

const expenseParam = (e: ExpenseOption) => ({ create: e.create, account_id: e.accountId, status: e.status, due_date: e.dueDate });

export interface ReceiveStockInput {
  workspaceId: string;
  supplierId: string | null;
  date: string;
  lines: ReceiptLine[];
  expense: ExpenseOption;
}

/** Registra una entrada de mercancía; devuelve el id de la entrada. */
export async function receiveStock(input: ReceiveStockInput): Promise<string> {
  const { data, error } = await createClient().rpc("inventory_receive", {
    p_workspace: input.workspaceId,
    p_supplier: input.supplierId,
    p_date: input.date,
    p_lines: input.lines,
    p_expense: expenseParam(input.expense),
  });
  fail(error);
  return data as string;
}

export interface CompleteReceiptInput {
  receiptId: string;
  costs: { product_id: string; unit_cost: number }[];
  expense: ExpenseOption;
}

export async function completeReceipt(input: CompleteReceiptInput): Promise<void> {
  const { error } = await createClient().rpc("inventory_complete_receipt", {
    p_receipt: input.receiptId,
    p_costs: input.costs,
    p_expense: expenseParam(input.expense),
  });
  fail(error);
}

export interface AdjustStockInput {
  productId: string;
  mode: "count" | "out";
  quantity: number;
  reason: "damage" | "loss" | "count" | "other";
  note: string;
}

export async function adjustStock(input: AdjustStockInput): Promise<void> {
  const { error } = await createClient().rpc("inventory_adjust", {
    p_product: input.productId,
    p_mode: input.mode,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_note: input.note,
  });
  fail(error);
}

export interface SetOpeningInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export async function setOpeningStock(input: SetOpeningInput): Promise<void> {
  const { error } = await createClient().rpc("inventory_set_opening", {
    p_product: input.productId,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
  });
  fail(error);
}

export type ImportResult = { ok: true; created: number } | { ok: false; errors: { row: number; message: string }[] };

export async function importProducts(ws: string, rows: ImportRow[]): Promise<ImportResult> {
  const { data, error } = await createClient().rpc("inventory_import", { p_workspace: ws, p_rows: rows });
  fail(error);
  return data as ImportResult;
}

export async function nextInternalBarcode(ws: string): Promise<string> {
  const { data, error } = await createClient().rpc("inventory_next_internal_barcode", { p_workspace: ws });
  fail(error);
  return data as string;
}
