import type { Product, ProductUnit } from "@/types/inventory";
import type { Discount, PaymentMethod, SaleKind } from "@/types/pos";

// Cálculo para mostrar. La fuente de verdad es `pos_confirm_sale` en el servidor.

export type CartLine = {
  productId: string;
  name: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: number;
  discount: Discount | null;
};

const money = (n: number) => Math.round(n);

/** Valor del descuento sobre una base, acotado entre 0 y la base. */
function discountAmount(base: number, d: Discount | null): number {
  if (!d || !(d.value > 0) || base <= 0) return 0;
  const raw = d.type === "pct" ? (base * d.value) / 100 : d.value;
  return Math.min(base, Math.max(0, money(raw)));
}

const gross = (l: CartLine) => money(l.quantity * l.unitPrice);

/** Total de la línea en pesos enteros; nunca baja de 0. */
export function lineTotal(l: CartLine): number {
  const g = gross(l);
  return Math.max(0, g - discountAmount(g, l.discount));
}

/** Cambia el precio de todas las líneas a la lista del tipo de venta. */
export function recalcLines(lines: CartLine[], products: Product[], kind: SaleKind): CartLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.map((l) => {
    const p = byId.get(l.productId);
    return p ? { ...l, unitPrice: kind === "credit" ? p.price_credit : p.price_cash } : l;
  });
}

export function cartTotals(lines: CartLine[], totalDiscount: Discount | null) {
  const subtotal = lines.reduce((s, l) => s + gross(l), 0);
  const net = lines.reduce((s, l) => s + lineTotal(l), 0);
  const lineDiscounts = subtotal - net;
  const totalDisc = discountAmount(net, totalDiscount);
  const total = net - totalDisc;
  const discountPct = subtotal > 0 ? Math.round(((lineDiscounts + totalDisc) / subtotal) * 10000) / 100 : 0;
  return { subtotal, lineDiscounts, totalDiscount: totalDisc, total, discountPct };
}

/** Vueltas (solo salen del efectivo recibido) y lo que falta por cobrar. */
export function cashChange(total: number, payments: { method: PaymentMethod; amount: number }[]): { change: number; missing: number } {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const cash = payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  return { change: Math.min(cash, Math.max(0, paid - total)), missing: Math.max(0, total - paid) };
}
