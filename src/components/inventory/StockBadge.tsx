import { cn } from "@/lib/cn";

export type StockLevel = "ok" | "low" | "out";

export function stockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return "ok";
}

/** Productos activos que piden atención en Inicio: mismo criterio que `stockLevel` (la pantalla de Inventario). */
export function needsRestock(p: { active: boolean; stock: number; min_stock: number }): boolean {
  return p.active && stockLevel(p.stock, p.min_stock) !== "ok";
}

const LABEL: Record<StockLevel, string> = { ok: "Disponible", low: "Stock bajo", out: "Agotado" };
const TONE: Record<StockLevel, string> = {
  ok: "bg-[var(--color-income)]/15 text-[var(--color-income)]",
  low: "bg-[var(--color-warning,var(--color-expense))]/15 text-[var(--color-warning,var(--color-expense))]",
  out: "bg-[var(--color-expense)]/15 text-[var(--color-expense)]",
};

export function StockBadge({ stock, minStock, className }: { stock: number; minStock: number; className?: string }) {
  const level = stockLevel(stock, minStock);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TONE[level], className)}>
      {LABEL[level]}
    </span>
  );
}
