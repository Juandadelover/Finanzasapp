import type { ProductUnit } from "@/types/inventory";

export const UNITS: { value: ProductUnit; label: string; integer: boolean }[] = [
  { value: "unidad", label: "Unidad", integer: true },
  { value: "caja", label: "Caja", integer: true },
  { value: "kg", label: "Kilogramo", integer: false },
  { value: "g", label: "Gramo", integer: false },
  { value: "litro", label: "Litro", integer: false },
  { value: "ml", label: "Mililitro", integer: false },
  { value: "metro", label: "Metro", integer: false },
];

/** Cantidad no negativa: entera para unidad/caja, hasta 3 decimales para el resto. */
export function isValidQuantity(unit: ProductUnit, q: number): boolean {
  if (!Number.isFinite(q) || q < 0) return false;
  const def = UNITS.find((u) => u.value === unit);
  if (!def) return false;
  const scaled = q * (def.integer ? 1 : 1000);
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}
