"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import {
  createCategory,
  inventoryErrorMessage,
  nextInternalBarcode,
  saveProduct,
  setOpeningStock,
} from "@/lib/inventory/api";
import { UNITS, isValidQuantity } from "@/lib/inventory/units";
import type { Product, ProductCategory, ProductUnit } from "@/types/inventory";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const NEW_CATEGORY = "__new__";

/** "1,5" o "1.5" -> 1.5 (campos de cantidad; los miles no se usan aquí). */
function parseQty(value: string): number {
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

interface ProductSheetProps {
  workspaceId: string;
  /** null = crear. */
  product: Product | null;
  /** Código precargado al crear (p. ej. el que se escaneó). */
  initialBarcode?: string;
  categories: ProductCategory[];
  canViewCosts: boolean;
  /** Costo promedio actual, solo al editar y si se pueden ver costos. */
  avgCost?: number | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
  onCategoryCreated: (category: ProductCategory) => void;
}

export function ProductSheet({
  workspaceId,
  product,
  initialBarcode,
  categories,
  canViewCosts,
  avgCost,
  onClose,
  onSaved,
  onCategoryCreated,
}: ProductSheetProps) {
  const editing = product !== null;
  const [name, setName] = useState(product?.name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? "unidad");
  const [priceCash, setPriceCash] = useState(product?.price_cash ?? 0);
  const [priceCredit, setPriceCredit] = useState(product?.price_credit ?? 0);
  const [creditTouched, setCreditTouched] = useState(editing);
  const [minStock, setMinStock] = useState(product ? String(product.min_stock) : "0");
  const [openingStock, setOpeningStockValue] = useState("");
  const [openingCost, setOpeningCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const costRef = editing ? (avgCost ?? 0) : openingCost;
  const belowCost = canViewCosts && costRef > 0 && (priceCash > 0 || priceCredit > 0) && Math.min(priceCash, priceCredit || priceCash) < costRef;

  async function generateBarcode() {
    setGenerating(true);
    try {
      setBarcode(await nextInternalBarcode(workspaceId));
    } catch (err) {
      toast.error(inventoryErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setError("Escribe el nombre del producto.");
    if (priceCash < 0 || priceCredit < 0) return setError("Los precios no pueden ser negativos.");
    const min = parseQty(minStock || "0");
    if (!isValidQuantity(unit, min)) return setError("El stock mínimo no es válido para esa unidad.");
    const opening = openingStock.trim() === "" ? 0 : parseQty(openingStock);
    if (!editing && !isValidQuantity(unit, opening)) return setError("El stock inicial no es válido para esa unidad.");
    if (newCategory.trim() === "" && categoryId === NEW_CATEGORY) return setError("Escribe el nombre de la categoría.");

    setError(null);
    setSaving(true);
    try {
      let catId: string | null = categoryId && categoryId !== NEW_CATEGORY ? categoryId : null;
      if (categoryId === NEW_CATEGORY) {
        const cat = await createCategory(workspaceId, newCategory.trim());
        onCategoryCreated(cat);
        catId = cat.id;
      }
      const saved = await saveProduct({
        id: product?.id,
        workspaceId,
        barcode: barcode.trim() || null,
        name: cleanName,
        categoryId: catId,
        unit,
        priceCash,
        priceCredit: creditTouched ? priceCredit : priceCash,
        minStock: min,
      });
      if (!editing && opening > 0) {
        try {
          await setOpeningStock({ productId: saved.id, quantity: opening, unitCost: canViewCosts ? openingCost : 0 });
        } catch (err) {
          toast.error(`Producto creado, pero el stock inicial falló. ${inventoryErrorMessage(err)}`);
        }
      }
      toast.success(editing ? "Producto actualizado." : "Producto creado.");
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar producto" : "Nuevo producto"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className={labelClass}>Nombre</span>
          <input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus={!initialBarcode} />
        </label>

        <div>
          <label htmlFor="product-barcode" className={labelClass}>Código de barras (opcional)</label>
          <div className="flex gap-2">
            <input
              id="product-barcode"
              type="text"
              inputMode="numeric"
              value={barcode}
              maxLength={40}
              onChange={(e) => setBarcode(e.target.value)}
              className={inputClass}
            />
            <Button variant="secondary" size="sm" onClick={generateBarcode} loading={generating} className="shrink-0">
              <QrCode size={16} aria-hidden />
              Generar código interno
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Categoría</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CATEGORY}>+ Nueva categoría</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Unidad</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} disabled={editing} className={inputClass}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </label>
        </div>
        {categoryId === NEW_CATEGORY ? (
          <label className="block">
            <span className={labelClass}>Nombre de la categoría</span>
            <input type="text" value={newCategory} maxLength={60} onChange={(e) => setNewCategory(e.target.value)} className={inputClass} />
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Precio contado</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={formatAmountInput(priceCash)}
              onChange={(e) => {
                const v = parseAmountInput(e.target.value);
                setPriceCash(v);
                if (!creditTouched) setPriceCredit(v);
              }}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Precio crédito</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={formatAmountInput(priceCredit)}
              onChange={(e) => {
                setCreditTouched(true);
                setPriceCredit(parseAmountInput(e.target.value));
              }}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Stock mínimo</span>
          <input inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} className={inputClass} />
        </label>

        {!editing ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Stock inicial (opcional)</span>
              <input inputMode="decimal" placeholder="0" value={openingStock} onChange={(e) => setOpeningStockValue(e.target.value)} className={inputClass} />
            </label>
            {canViewCosts ? (
              <label className="block">
                <span className={labelClass}>Costo unitario</span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={formatAmountInput(openingCost)}
                  onChange={(e) => setOpeningCost(parseAmountInput(e.target.value))}
                  className={inputClass}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {belowCost ? (
          <p role="status" className="rounded-xl bg-[var(--color-expense)]/10 px-3 py-2 text-sm text-[var(--color-expense)]">
            El precio es menor que el costo. Revisa que no estés vendiendo con pérdida.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">{error}</p>
        ) : null}
        <Button type="submit" loading={saving}>
          {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear producto"}
        </Button>
      </form>
    </BottomSheet>
  );
}
