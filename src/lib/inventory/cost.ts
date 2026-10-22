/** Costo promedio ponderado al recibir `qty` unidades a `unitCost`. */
export function weightedAverageCost(stock: number, avg: number, qty: number, unitCost: number): number {
  const total = stock + qty;
  if (total <= 0) return unitCost;
  return (stock * avg + qty * unitCost) / total;
}

/** Ajuste del promedio al completar tarde el costo de una entrada ya sumada al stock. */
export function lateCostAverage(stockNow: number, avg: number, qty: number, unitCost: number): number {
  if (stockNow <= 0) return unitCost;
  return avg + (qty * (unitCost - avg)) / stockNow;
}
