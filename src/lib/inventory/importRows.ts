import type { ProductUnit } from "@/types/inventory";
import { isValidGtin } from "./gtin";
import { isValidQuantity, UNITS } from "./units";

export interface ImportRow {
  barcode: string | null;
  name: string;
  category: string | null;
  unit: ProductUnit;
  price_cash: number;
  price_credit: number;
  cost: number | null;
  stock: number;
  min_stock: number;
}

export interface ImportError {
  row: number;
  message: string;
}

export const IMPORT_HEADERS = ["codigo", "nombre", "categoria", "unidad", "precio_contado", "precio_credito", "costo", "stock", "stock_minimo"] as const;

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  codigo: "barcode",
  codigo_barras: "barcode",
  nombre: "name",
  categoria: "category",
  unidad: "unit",
  precio_contado: "price_cash",
  precio: "price_cash",
  precio_credito: "price_credit",
  costo: "cost",
  stock: "stock",
  cantidad: "stock",
  stock_minimo: "min_stock",
  minimo: "min_stock",
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

/** Número en formato colombiano: "1.250.000", "2,5", "1.250,50". Devuelve NaN si no es un número. */
export function parseColombianNumber(raw: string): number {
  let s = raw.trim().replace(/[$\s]/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return Number.NaN;
  const hasComma = s.includes(",");
  const dots = (s.match(/\./g) ?? []).length;
  if (hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if ((s.match(/\./g) ?? []).length > 1) return Number.NaN;
  return Number(s);
}

const UNIT_LOOKUP = new Map<string, ProductUnit>();
for (const u of UNITS) {
  UNIT_LOOKUP.set(normalize(u.value), u.value);
  UNIT_LOOKUP.set(normalize(u.label), u.value);
}
UNIT_LOOKUP.set("unidades", "unidad");
UNIT_LOOKUP.set("cajas", "caja");
UNIT_LOOKUP.set("litros", "litro");
UNIT_LOOKUP.set("metros", "metro");
UNIT_LOOKUP.set("kilogramo", "kg");
UNIT_LOOKUP.set("gramo", "g");

/** `validRowNumbers[i]` es la fila del archivo de `valid[i]` (el servidor numera por posición dentro de `valid`). */
export function parseImportRows(rows: Record<string, string>[]): { valid: ImportRow[]; validRowNumbers: number[]; errors: ImportError[] } {
  const valid: ImportRow[] = [];
  const validRowNumbers: number[] = [];
  const errors: ImportError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // fila 1 = encabezados
    const f: Partial<Record<keyof ImportRow, string>> = {};
    for (const [k, v] of Object.entries(raw)) {
      const field = HEADER_ALIASES[normalize(k)];
      if (field) f[field] = String(v ?? "").trim();
    }
    if (Object.values(f).every((v) => !v)) return; // fila vacía

    const problems: string[] = [];
    const name = f.name ?? "";
    if (!name) problems.push("Falta el nombre.");

    const barcode = f.barcode || null;
    if (barcode) {
      if (!isValidGtin(barcode)) problems.push(`El código ${barcode} no es válido.`);
      const first = seen.get(barcode);
      if (first !== undefined) problems.push(`Código repetido (ya está en la fila ${first}).`);
      else seen.set(barcode, rowNum);
    }

    let unit: ProductUnit = "unidad";
    if (f.unit) {
      const u = UNIT_LOOKUP.get(normalize(f.unit));
      if (u) unit = u;
      else problems.push(`Unidad no válida: ${f.unit}.`);
    }

    const num = (field: keyof ImportRow, label: string, fallback: number | null): number | null => {
      const v = f[field];
      if (!v) return fallback;
      const n = parseColombianNumber(v);
      if (!Number.isFinite(n)) {
        problems.push(`${label} no es un número.`);
        return fallback;
      }
      if (n < 0) {
        problems.push(`${label} no puede ser negativo.`);
        return fallback;
      }
      return n;
    };

    const priceCash = num("price_cash", "El precio", 0) ?? 0;
    const priceCredit = num("price_credit", "El precio a crédito", priceCash) ?? priceCash;
    const cost = num("cost", "El costo", null);
    const stock = num("stock", "El stock", 0) ?? 0;
    const minStock = num("min_stock", "El stock mínimo", 0) ?? 0;

    if (!isValidQuantity(unit, stock)) problems.push(`Cantidad no válida para la unidad ${unit}.`);
    if (!isValidQuantity(unit, minStock)) problems.push(`Stock mínimo no válido para la unidad ${unit}.`);

    if (problems.length) {
      errors.push({ row: rowNum, message: problems.join(" ") });
      return;
    }
    validRowNumbers.push(rowNum);
    valid.push({
      barcode,
      name,
      category: f.category || null,
      unit,
      price_cash: priceCash,
      price_credit: priceCredit,
      cost,
      stock,
      min_stock: minStock,
    });
  });

  return { valid, validRowNumbers, errors };
}

/** Lee un .csv (papaparse) o .xlsx (read-excel-file) como filas con encabezados. */
export async function readImportFile(file: File): Promise<Record<string, string>[]> {
  const isXlsx = /\.xlsx$/i.test(file.name);
  if (isXlsx) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = (await readSheet(file)) as unknown[][];
    if (data.length === 0) return [];
    const headers = data[0].map((h) => String(h ?? ""));
    return data.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = r[idx] == null ? "" : String(r[idx]);
      });
      return obj;
    });
  }
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
  });
  return res.data;
}
