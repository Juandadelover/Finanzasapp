import type { ProductUnit } from "@/types/inventory";

export type SaleKind = "cash" | "credit";
export type SaleStatus = "active" | "void";
export type PaymentMethod = "cash" | "transfer" | "nequi" | "daviplata" | "card";

export type Discount = { type: "pct" | "amount"; value: number };

export interface Sale {
  id: string;
  workspace_id: string;
  number: number;
  kind: SaleKind;
  contact_id: string | null;
  subtotal: number;
  line_discount_total: number;
  total_discount: number;
  total: number;
  paid_now: number;
  balance: number;
  status: SaleStatus;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  workspace_id: string;
  position: number;
  product_id: string;
  name: string;
  unit: ProductUnit;
  quantity: number;
  unit_price: number;
  discount: Discount | null;
  line_total: number;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  workspace_id: string;
  method: PaymentMethod;
  account_id: string | null;
  amount: number;
  received: number;
  change: number;
}

/** Costo por línea; solo lo leen owner, admin, editor y accountant. */
export interface SaleItemCost {
  sale_item_id: string;
  workspace_id: string;
  unit_cost: number;
}

export interface PosConfirmResult {
  sale_id: string;
  number: number;
  total: number;
  balance: number;
}
