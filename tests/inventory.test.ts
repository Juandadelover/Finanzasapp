import { describe, expect, it } from "vitest";
import { gtinCheckDigit, internalEan13, isValidGtin } from "@/lib/inventory/gtin";
import { lateCostAverage, weightedAverageCost } from "@/lib/inventory/cost";
import { isValidQuantity, UNITS } from "@/lib/inventory/units";
import { parseImportRows } from "@/lib/inventory/importRows";
import { createBurstDetector } from "@/lib/inventory/scanner";
import { inventoryErrorMessage } from "@/lib/inventory/errors";

describe("gtin", () => {
  it("validates GS1 mod 10", () => {
    expect(isValidGtin("7702004003508")).toBe(true);
    expect(isValidGtin("7702004003509")).toBe(false);
    expect(isValidGtin("96385074")).toBe(true); // EAN-8
    expect(isValidGtin("036000291452")).toBe(true); // UPC-A
    expect(isValidGtin("036000291453")).toBe(false);
  });
  it("does not validate other formats", () => {
    expect(isValidGtin("ABC-123")).toBe(true);
    expect(isValidGtin("12345")).toBe(true);
  });
  it("computes check digit and internal EAN-13", () => {
    expect(gtinCheckDigit("770200400350")).toBe(8);
    expect(internalEan13(1)).toBe("2000000000015");
    expect(internalEan13(1)).toHaveLength(13);
    expect(isValidGtin(internalEan13(123456))).toBe(true);
    expect(internalEan13(123456).startsWith("200000123456")).toBe(true);
  });
});

describe("cost", () => {
  it("weighted average on receipt", () => {
    expect(weightedAverageCost(10, 1000, 10, 2000)).toBe(1500);
    expect(weightedAverageCost(0, 0, 5, 800)).toBe(800);
  });
  it("late cost average", () => {
    expect(lateCostAverage(0, 0, 5, 800)).toBe(800);
    expect(lateCostAverage(20, 1000, 10, 1600)).toBe(1300);
  });
});

describe("units", () => {
  it("integer units reject decimals", () => {
    expect(isValidQuantity("unidad", 1.5)).toBe(false);
    expect(isValidQuantity("caja", 2)).toBe(true);
    expect(isValidQuantity("kg", 1.5)).toBe(true);
    expect(isValidQuantity("kg", 1.2345)).toBe(false);
    expect(isValidQuantity("kg", -1)).toBe(false);
    expect(isValidQuantity("kg", Number.NaN)).toBe(false);
  });
  it("lists all units", () => {
    expect(UNITS.map((u) => u.value)).toEqual(["unidad", "caja", "kg", "g", "litro", "ml", "metro"]);
  });
});

describe("parseImportRows row numbers", () => {
  it("maps each valid row to its file row, skipping empty rows", () => {
    const r = parseImportRows([{ nombre: "A" }, { nombre: "" }, { nombre: "B" }]);
    expect(r.validRowNumbers).toEqual([2, 4]);
  });
});

describe("parseImportRows", () => {
  it("parses a valid row with Colombian numbers and flexible headers", () => {
    const { valid, errors } = parseImportRows([
      { Código: "7702004003508", Nombre: "Arroz", Categoría: "Granos", Unidad: "kg", Precio: "1.250.000", Costo: "2,5", Cantidad: "3,5", Mínimo: "1" },
    ]);
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      { barcode: "7702004003508", name: "Arroz", category: "Granos", unit: "kg", price_cash: 1250000, price_credit: 1250000, cost: 2.5, stock: 3.5, min_stock: 1 },
    ]);
  });
  it("defaults unit and credit price", () => {
    const { valid } = parseImportRows([{ nombre: "Lápiz", precio_contado: "1000", precio_credito: "1200" }]);
    expect(valid[0]).toMatchObject({ unit: "unidad", price_cash: 1000, price_credit: 1200, barcode: null, cost: null, stock: 0, min_stock: 0 });
  });
  it("reports duplicate barcode in file", () => {
    const { valid, errors } = parseImportRows([
      { codigo: "ABC1", nombre: "A" },
      { codigo: "ABC1", nombre: "B" },
    ]);
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([{ row: 3, message: expect.stringContaining("repetido") }]);
  });
  it("reports empty name, invalid unit, decimal in unidad, negatives", () => {
    const { errors } = parseImportRows([
      { nombre: "", precio: "100" },
      { nombre: "X", unidad: "docena" },
      { nombre: "Y", stock: "1,5" },
      { nombre: "Z", precio: "-5" },
      { nombre: "W", precio: "abc" },
    ]);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
  });
  it("reports invalid GTIN", () => {
    const { errors } = parseImportRows([{ codigo: "7702004003509", nombre: "A" }]);
    expect(errors).toHaveLength(1);
  });
  it("skips fully empty rows", () => {
    const { valid, errors } = parseImportRows([{ nombre: "", codigo: "" }, { nombre: "A" }]);
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
  });
});

describe("createBurstDetector", () => {
  const type = (d: ReturnType<typeof createBurstDetector>, code: string, gap: number, start = 0) => {
    let t = start;
    for (const ch of code) { d.push(ch, t); t += gap; }
    return t;
  };
  it("detects a fast burst ended by Enter", () => {
    const d = createBurstDetector();
    const t = type(d, "7702004003508", 10);
    expect(d.push("Enter", t)).toBe("7702004003508");
  });
  it("ignores short bursts (5 keys)", () => {
    const d = createBurstDetector();
    const t = type(d, "12345", 10);
    expect(d.push("Enter", t)).toBeNull();
  });
  it("ignores human typing speed", () => {
    const d = createBurstDetector();
    const t = type(d, "7702004003508", 120);
    expect(d.push("Enter", t)).toBeNull();
  });
  it("ignores bursts ended by Tab", () => {
    const d = createBurstDetector();
    const t = type(d, "7702004003508", 10);
    expect(d.push("Tab", t)).toBeNull();
    expect(d.push("Enter", t + 10)).toBeNull();
  });
  it("ignores modifier keys and supports reset", () => {
    const d = createBurstDetector();
    let t = type(d, "770200", 10);
    d.push("Shift", t); t += 10;
    t = type(d, "4003508", 10, t);
    expect(d.push("Enter", t)).toBe("7702004003508");
    d.reset();
    expect(d.push("Enter", t + 10)).toBeNull();
  });
  it("starts over after a slow gap", () => {
    const d = createBurstDetector();
    let t = type(d, "AAAAAA", 200);
    t = type(d, "7702004003508", 10, t + 500);
    expect(d.push("Enter", t)).toBe("7702004003508");
  });
});

describe("inventoryErrorMessage", () => {
  it("translates known codes", () => {
    expect(inventoryErrorMessage({ message: "STOCK_NEGATIVO" })).toMatch(/stock/i);
    expect(inventoryErrorMessage(new Error("SIN_PERMISO"))).toMatch(/permiso/i);
    expect(inventoryErrorMessage({ message: "LIMITE_PLAN:max_active_products" })).toMatch(/30 productos/);
    expect(inventoryErrorMessage({ message: "CODIGO_DUPLICADO" })).toMatch(/código/i);
  });
  it("translates every code raised by the inventory migration", () => {
    const codes = [
      "STOCK_SOLO_POR_FUNCION", "PRODUCTO_NO_ENCONTRADO", "COSTO_INVALIDO", "COSTO_REQUERIDO", "CUENTA_REQUERIDA",
      "ENTRADA_COMPLETA", "ESTADO_INVALIDO", "SIN_PERMISO", "STOCK_NEGATIVO", "CANTIDAD_INVALIDA",
      "MOTIVO_REQUERIDO", "PRODUCTO_CON_MOVIMIENTOS", "CODIGO_DUPLICADO",
    ];
    for (const code of codes) {
      expect(inventoryErrorMessage({ message: code }), code).not.toBe("No se pudo completar la acción. Intenta de nuevo.");
    }
  });
  it("falls back", () => {
    expect(inventoryErrorMessage({ message: "boom" })).toBe("No se pudo completar la acción. Intenta de nuevo.");
    expect(inventoryErrorMessage(null)).toBe("No se pudo completar la acción. Intenta de nuevo.");
  });
});
