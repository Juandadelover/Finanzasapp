import { describe, expect, it } from "vitest";
import { cartTotals, cashChange, lineTotal, recalcLines, type CartLine } from "@/lib/pos/totals";
import type { Product } from "@/types/inventory";
import { inventoryErrorMessage } from "@/lib/inventory/errors";

const line = (o: Partial<CartLine> = {}): CartLine => ({ productId: "p1", name: "Arroz", unit: "unidad", quantity: 2, unitPrice: 5000, discount: null, ...o });

describe("lineTotal", () => {
  it("sin descuento", () => expect(lineTotal(line())).toBe(10000));
  it("descuento en porcentaje", () => expect(lineTotal(line({ discount: { type: "pct", value: 10 } }))).toBe(9000));
  it("descuento en valor", () => expect(lineTotal(line({ discount: { type: "amount", value: 1500 } }))).toBe(8500));
  it("nunca baja de 0", () => expect(lineTotal(line({ discount: { type: "amount", value: 99999 } }))).toBe(0));
  it("redondea a pesos", () => expect(lineTotal(line({ unit: "kg", quantity: 0.5, unitPrice: 3333 }))).toBe(1667));
});

describe("cartTotals", () => {
  it("carrito vacío", () => {
    expect(cartTotals([], null)).toEqual({ subtotal: 0, lineDiscounts: 0, totalDiscount: 0, total: 0, discountPct: 0 });
  });
  it("descuento total sobre el subtotal ya descontado", () => {
    const lines = [line({ discount: { type: "pct", value: 10 } }), line({ productId: "p2", quantity: 1, unitPrice: 10000 })];
    // bruto 20000, descuento de línea 1000, neto 19000, total 10% = 1900
    expect(cartTotals(lines, { type: "pct", value: 10 })).toEqual({ subtotal: 20000, lineDiscounts: 1000, totalDiscount: 1900, total: 17100, discountPct: 14.5 });
  });
  it("descuento total en valor y sin pasar de 0", () => {
    expect(cartTotals([line()], { type: "amount", value: 3000 }).total).toBe(7000);
    expect(cartTotals([line()], { type: "amount", value: 50000 }).total).toBe(0);
  });
});

describe("recalcLines", () => {
  const products = [{ id: "p1", price_cash: 5000, price_credit: 6000 }] as Product[];
  it("cambia de contado a crédito", () => {
    const out = recalcLines([line()], products, "credit");
    expect(out[0].unitPrice).toBe(6000);
    expect(recalcLines(out, products, "cash")[0].unitPrice).toBe(5000);
  });
  it("conserva cantidad y descuento; deja igual lo que no encuentra", () => {
    const l = line({ productId: "x", discount: { type: "pct", value: 5 } });
    const [a, b] = recalcLines([line({ discount: { type: "pct", value: 5 }, quantity: 3 }), l], products, "credit");
    expect(a).toMatchObject({ quantity: 3, discount: { type: "pct", value: 5 }, unitPrice: 6000 });
    expect(b).toEqual(l);
  });
});

describe("cashChange", () => {
  it("vueltas en efectivo", () => expect(cashChange(80000, [{ method: "cash", amount: 100000 }])).toEqual({ change: 20000, missing: 0 }));
  it("pago exacto", () => expect(cashChange(80000, [{ method: "nequi", amount: 80000 }])).toEqual({ change: 0, missing: 0 }));
  it("mixto que no alcanza", () => {
    expect(cashChange(80000, [{ method: "cash", amount: 30000 }, { method: "card", amount: 20000 }])).toEqual({ change: 0, missing: 30000 });
  });
  it("exceso en medio no efectivo no da vueltas", () => {
    expect(cashChange(80000, [{ method: "transfer", amount: 90000 }])).toEqual({ change: 0, missing: 0 });
  });
  it("mixto con exceso: vueltas hasta lo recibido en efectivo", () => {
    expect(cashChange(80000, [{ method: "card", amount: 50000 }, { method: "cash", amount: 50000 }])).toEqual({ change: 20000, missing: 0 });
  });
});

describe("errores de POS", () => {
  it.each(["DESCUENTO_SOBRE_TOPE", "CLIENTE_REQUERIDO", "PAGO_NO_CUADRA", "VENTA_ANULADA", "PRECIO_NEGATIVO", "DESCUENTO_INVALIDO", "SIN_PERMISO", "CANTIDAD_INVALIDA", "PRODUCTO_NO_ENCONTRADO", "MOTIVO_REQUERIDO", "CUENTA_REQUERIDA", "STOCK_INSUFICIENTE:Arroz"])("traduce %s", (c) => {
    expect(inventoryErrorMessage({ message: c })).not.toMatch(/No se pudo completar/);
  });
  it("nombra el producto sin stock", () => expect(inventoryErrorMessage({ message: "STOCK_INSUFICIENTE:Arroz" })).toContain("Arroz"));
});
