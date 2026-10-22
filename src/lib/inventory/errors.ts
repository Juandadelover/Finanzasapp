const FALLBACK = "No se pudo completar la acción. Intenta de nuevo.";

const MESSAGES: Record<string, string> = {
  SIN_PERMISO: "No tienes permiso para hacer esto.",
  STOCK_NEGATIVO: "No hay suficiente stock para esa cantidad.",
  CANTIDAD_INVALIDA: "La cantidad no es válida para la unidad del producto.",
  MOTIVO_REQUERIDO: "Escribe el motivo del ajuste.",
  PRODUCTO_CON_MOVIMIENTOS: "Este producto ya tiene movimientos. Usa una entrada o un ajuste.",
  CODIGO_DUPLICADO: "Ya existe un producto con ese código.",
  "LIMITE_PLAN:max_active_products": "Llegaste al límite de 30 productos activos del plan Gratis.",
};

function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object" && "message" in err) return String((err as { message: unknown }).message ?? "");
  return "";
}

/** Traduce los códigos de error de las funciones de inventario a frases para el usuario. */
export function inventoryErrorMessage(err: unknown): string {
  const raw = rawMessage(err);
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  if (raw.includes("LIMITE_PLAN:")) return "Llegaste al límite de tu plan actual.";
  return FALLBACK;
}
