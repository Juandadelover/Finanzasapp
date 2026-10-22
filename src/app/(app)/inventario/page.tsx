"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { StockBadge, stockLevel } from "@/components/inventory/StockBadge";
import { formatQty } from "@/components/inventory/KardexTable";
import { ProductSheet } from "@/components/inventory/ProductSheet";
import { CameraScanButton } from "@/components/inventory/CameraScanButton";
import { Button, buttonClass } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import { inventoryErrorMessage, listCategories, listProductCosts, listProducts } from "@/lib/inventory/api";
import { useBarcodeScanner } from "@/lib/inventory/useBarcodeScanner";
import type { Product, ProductCategory, ProductCost } from "@/types/inventory";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";

type StockFilter = "all" | "low" | "out" | "inactive";
const FILTERS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "low", label: "Stock bajo" },
  { value: "out", label: "Agotados" },
  { value: "inactive", label: "Inactivos" },
];

/** Sonido corto (200 ms) cuando el código escaneado no existe. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 330;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    // Sin audio disponible: el aviso visual basta.
  }
}

export default function InventarioPage() {
  const router = useRouter();
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const canViewCosts = permissions.canViewCosts;
  const canManage = permissions.canManageProducts;

  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [costs, setCosts] = useState<ProductCost[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sheet, setSheet] = useState<{ barcode?: string } | null>(null);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const id = ++loadId.current;
    try {
      const [p, c, pc] = await Promise.all([
        listProducts(workspaceId),
        listCategories(workspaceId),
        canViewCosts ? listProductCosts(workspaceId) : Promise.resolve([] as ProductCost[]),
      ]);
      if (id !== loadId.current) return;
      setProducts(p);
      setCategories(c);
      setCosts(pc);
      setLoadError(false);
    } catch (err) {
      if (id !== loadId.current) return;
      setLoadError(true);
      toast.error(inventoryErrorMessage(err));
    }
  }, [workspaceId, canViewCosts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    void load();
  }, [load]);

  const handleScan = useCallback(
    (code: string) => {
      const found = products?.find((p) => p.barcode === code);
      if (found) {
        router.push(`/inventario/${found.id}`);
        return;
      }
      beep();
      if (canManage) {
        toast(`No existe un producto con el código ${code}.`, {
          action: { label: "Crear producto", onClick: () => setSheet({ barcode: code }) },
        });
      } else {
        toast.error(`No existe un producto con el código ${code}.`);
      }
    },
    [products, router, canManage],
  );
  useBarcodeScanner(handleScan, sheet === null && products !== null);

  const costById = useMemo(() => new Map(costs.map((c) => [c.product_id, c.avg_cost])), [costs]);
  const categoryName = useCallback(
    (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sin categoría",
    [categories],
  );

  const summary = useMemo(() => {
    const active = (products ?? []).filter((p) => p.active);
    return {
      value: active.reduce((sum, p) => sum + p.stock * (costById.get(p.id) ?? 0), 0),
      low: active.filter((p) => stockLevel(p.stock, p.min_stock) === "low").length,
      out: active.filter((p) => p.stock <= 0).length,
    };
  }, [products, costById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (stockFilter === "inactive") {
        if (p.active) return false;
      } else if (!p.active) return false;
      if (stockFilter === "low" && stockLevel(p.stock, p.min_stock) !== "low") return false;
      if (stockFilter === "out" && p.stock > 0) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.barcode ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, stockFilter, categoryFilter]);

  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  if (!hydrated || (products === null && !loadError)) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Inventario" />
        <SkeletonList count={4} className="mx-4 mt-5" />
      </>
    );
  }

  const tiles = [
    ...(canViewCosts ? [{ label: "Valor del inventario", value: money(summary.value) }] : []),
    { label: "Stock bajo", value: String(summary.low) },
    { label: "Agotados", value: String(summary.out) },
  ];

  return (
    <>
      <AppHeader />
      <PageContainer>
        <PageHeader
          className="lg:mx-0 lg:mt-0"
          title="Inventario"
          subtitle="Productos, existencias y movimientos."
          actions={
            canManage ? (
              <Button size="sm" onClick={() => setSheet({})}>
                <Plus size={16} aria-hidden />
                Nuevo
              </Button>
            ) : undefined
          }
        />

        {loadError || products === null ? (
          <div className="mx-4 mt-5 lg:mx-0">
            <EmptyState icon={Package} tone="error" title="No pudimos cargar el inventario" description="Revisa tu conexión e inténtalo de nuevo." />
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="mx-4 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mx-0">
              {tiles.map((t) => (
                <div key={t.label} className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3">
                  <p className="text-xs text-[var(--color-text-faint)]">{t.label}</p>
                  <p title={t.value} className="tabular truncate text-base font-semibold">{t.value}</p>
                </div>
              ))}
            </div>

            <div className="mx-4 mt-4 flex flex-col gap-3 lg:mx-0">
              <div className="flex gap-2">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Buscar por nombre o código</span>
                  <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar o escanear un código"
                    className={cn(inputClass, "pl-10")}
                  />
                </label>
                <CameraScanButton onScan={handleScan} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={stockFilter === f.value}
                    onClick={() => setStockFilter(f.value)}
                    className={cn(
                      "min-h-11 rounded-full border px-3.5 text-sm transition active:scale-[0.97]",
                      stockFilter === f.value
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                {categories.length > 0 ? (
                  <select
                    aria-label="Filtrar por categoría"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="min-h-11 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            <div className="mx-4 mt-4 mb-4 lg:mx-0">
              <DataTable
                caption="Productos"
                rows={filtered}
                getRowKey={(p) => p.id}
                onRowClick={(p) => router.push(`/inventario/${p.id}`)}
                mobileClassName="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5"
                empty={
                  products.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="Aún no tienes productos"
                      description="Crea tu primer producto o importa tu catálogo desde un archivo."
                      action={canManage ? { label: "Crear producto", onClick: () => setSheet({}) } : undefined}
                    />
                  ) : (
                    <EmptyState icon={Search} title="No hay productos con ese filtro" description="Prueba con otra búsqueda." />
                  )
                }
                columns={[
                  {
                    key: "name",
                    header: "Producto",
                    className: "w-full max-w-0",
                    cell: (p) => (
                      <Link href={`/inventario/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium">
                        {p.name}
                      </Link>
                    ),
                  },
                  { key: "code", header: "Código", cell: (p) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{p.barcode ?? "—"}</span> },
                  { key: "cat", header: "Categoría", cell: (p) => <span className="whitespace-nowrap text-[var(--color-text-muted)]">{categoryName(p.category_id)}</span> },
                  { key: "price", header: "Precio", align: "right", cell: (p) => <span className="whitespace-nowrap">{money(p.price_cash)}</span> },
                  { key: "stock", header: "Stock", align: "right", cell: (p) => <span className="whitespace-nowrap">{formatQty(p.stock)} {p.unit}</span> },
                  { key: "state", header: "Estado", cell: (p) => (p.active ? <StockBadge stock={p.stock} minStock={p.min_stock} /> : <span className="text-xs text-[var(--color-text-muted)]">Inactivo</span>) },
                ]}
                renderMobile={(p) => (
                  <Link href={`/inventario/${p.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-[var(--color-surface-2)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {categoryName(p.category_id)}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                      </span>
                      <span className="mt-1 block">
                        {p.active ? <StockBadge stock={p.stock} minStock={p.min_stock} /> : <span className="text-xs text-[var(--color-text-muted)]">Inactivo</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">{formatQty(p.stock)} {p.unit}</span>
                      <span className="block text-xs text-[var(--color-text-muted)] tabular-nums">{money(p.price_cash)}</span>
                    </span>
                  </Link>
                )}
              />
            </div>

            {(permissions.canViewCosts || permissions.canReceiveStock || permissions.canImportProducts) ? (
              <div className="mx-4 mb-4 flex flex-wrap gap-2 lg:mx-0">
                {permissions.canViewCosts ? (
                  <Link href="/inventario/entradas" className={buttonClass({ variant: "secondary", size: "sm" })}>Entradas</Link>
                ) : permissions.canReceiveStock ? (
                  <Link href="/inventario/entradas/nueva" className={buttonClass({ variant: "secondary", size: "sm" })}>Nueva entrada</Link>
                ) : null}
                {permissions.canImportProducts ? (
                  <Link href="/inventario/importar" className={buttonClass({ variant: "secondary", size: "sm" })}>Importar catálogo</Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </PageContainer>

      {sheet && workspaceId ? (
        <ProductSheet
          workspaceId={workspaceId}
          product={null}
          initialBarcode={sheet.barcode}
          categories={categories}
          canViewCosts={canViewCosts}
          onClose={() => setSheet(null)}
          onSaved={() => void load()}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
        />
      ) : null}
    </>
  );
}
