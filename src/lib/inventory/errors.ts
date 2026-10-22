const FALLBACK = "No se pudo completar la acción. Intenta de nuevo.";

const MESSAGES: Record<string, string> = {
  SIN_PERMISO: "No tienes permiso para hacer esto.",
  STOCK_NEGATIVO: "No hay suficiente stock para esa cantidad.",
  CANTIDAD_INVALIDA: "La cantidad no es válida para la unidad del producto.",
  MOTIVO_REQUERIDO: "Escribe el motivo.",
  PRODUCTO_CON_MOVIMIENTOS: "Este producto ya tiene movimientos. Usa una entrada o un ajuste.",
  CODIGO_DUPLICADO: "Ya existe un producto con ese código.",
  STOCK_SOLO_POR_FUNCION: "El stock solo cambia con una entrada o un ajuste.",
  PRODUCTO_NO_ENCONTRADO: "Uno de los productos ya no existe en este negocio.",
  COSTO_INVALIDO: "El costo no es válido.",
  COSTO_REQUERIDO: "Falta el costo de uno o más productos.",
  CUENTA_REQUERIDA: "Elige la cuenta desde la que pagaste.",
  ENTRADA_COMPLETA: "Esta entrada ya tiene todos sus costos.",
  ESTADO_INVALIDO: "El estado del pago no es válido.",
  DESCUENTO_SOBRE_TOPE: "El descuento supera el tope permitido. Pídele a un administrador que haga la venta.",
  CLIENTE_REQUERIDO: "Elige un cliente para vender a crédito.",
  PAGO_NO_CUADRA: "Los pagos no cuadran con el total de la venta.",
  VENTA_ANULADA: "Esta venta ya fue anulada.",
  PRECIO_NEGATIVO: "El precio no puede ser negativo.",
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
  const noStock = raw.match(/STOCK_INSUFICIENTE:\s*([^\n"]+)/);
  if (noStock) return `No hay stock suficiente de ${noStock[1].trim()}.`;
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  if (raw.includes("LIMITE_PLAN:")) return "Llegaste al límite de tu plan actual.";
  return FALLBACK;
}
