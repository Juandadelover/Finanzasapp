import { createLucideIcon, type IconNode } from "lucide-react";

// Íconos propios de Finanzas para el tipo de movimiento: una billetera con la
// plata que entra (ingreso) o sale (gasto). Se crean con lucide para heredar
// tamaño, trazo y accesibilidad; no usar las flechas de tendencia, que son el logo.
const wallet: IconNode = [
  ["path", { d: "M4 10h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1z", key: "wallet" }],
  ["path", { d: "M20 14h-3a1.5 1.5 0 0 0 0 3h3", key: "clasp" }],
];

export const IncomeIcon = createLucideIcon("finanzas-income", [
  ...wallet,
  ["path", { d: "M11 2v6", key: "stem" }],
  ["path", { d: "m8 5 3 3 3-3", key: "head" }],
]);

export const ExpenseIcon = createLucideIcon("finanzas-expense", [
  ...wallet,
  ["path", { d: "M11 8V2", key: "stem" }],
  ["path", { d: "m8 5 3-3 3 3", key: "head" }],
]);
