export type ProductUnit = "unidad" | "caja" | "kg" | "g" | "litro" | "ml" | "metro";

export interface ProductCategory {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  workspace_id: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  unit: ProductUnit;
  price_cash: number;
  price_credit: number;
  stock: number;
  min_stock: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCost {
  product_id: string;
  workspace_id: string;
  avg_cost: number;
  updated_at: string;
}

export type StockReceiptStatus = "complete" | "pending_cost";

export interface StockReceipt {
  id: string;
  workspace_id: string;
  number: number;
  supplier_id: string | null;
  date: string; // yyyy-MM-dd
  status: StockReceiptStatus;
  total_cost: number | null;
  transaction_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export type StockMovementKind = "opening" | "receipt" | "adjustment" | "sale" | "sale_void";
export type StockMovementReason = "damage" | "loss" | "count" | "other";

export interface StockMovement {
  id: number;
  workspace_id: string;
  product_id: string;
  kind: StockMovementKind;
  quantity: number; // con signo
  stock_after: number;
  unit_cost: number | null;
  avg_cost_after: number | null;
  reason: StockMovementReason | null;
  note: string | null;
  receipt_id: string | null;
  created_by: string | null;
  created_at: string;
}
