"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { AdjustSheet } from "@/components/inventory/AdjustSheet";
import { KardexTable, formatQty } from "@/components/inventory/KardexTable";
import { ProductSheet } from "@/components/inventory/ProductSheet";
import { StockBadge } from "@/components/inventory/StockBadge";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import {
  getProduct,
  inventoryErrorMessage,
  listCategories,
  listMovements,
  listProductCosts,
  setProductActive,
} from "@/lib/inventory/api";
import { UNITS } from "@/lib/inventory/units";
import type { Product, ProductCategory, StockMovement } from "@/types/inventory";

export default function ProductoPage() {
  const { id } = useParams<{ id: string }>();
  const { state, hydrated, permissions, currentWorkspace, user } = useFinance();
  const { hidden } = usePrivacy();
  const confirm = useConfirm();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const canViewCosts = permissions.canViewCosts;

  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [avgCost, setAvgCost] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const run = ++loadId.current;
    try {
      const p = await getProduct(id);
      if (run !== loadId.current) return;
      if (!p) {
        setStatus("missing");
        return;
      }
      const [mv, cats, costs] = await Promise.all([
        canViewCosts ? listMovements(id) : Promise.resolve([] as StockMovement[]),
        listCategories(workspaceId),
        canViewCosts ? listProductCosts(workspaceId) : Promise.resolve([]),
      ]);
      if (run !== loadId.current) return;
      setProduct(p);
      setMovements(mv);
      setCategories(cats);
      setAvgCost(canViewCosts ? (costs.find((c) => c.product_id === id)?.avg_cost ?? 0) : null);
      setStatus("ready");
    } catch (err) {
      if (run !== loadId.current) return;
      setStatus("error");
      toast.error(inventoryErrorMessage(err));
    }
  }, [id, workspaceId, canViewCosts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    void load();
  }, [load]);

  async function toggleActive(p: Product) {
    if (p.active) {
      const ok = await confirm({
        title: "¿Desactivar este producto?",
        description: "Deja de aparecer en la lista, pero su historial se conserva.",
        confirmLabel: "Desactivar",
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      await setProductActive(p.id, !p.active);
      toast.success(p.active ? "Producto desactivado." : "Producto reactivado.");
      void load();
    } catch (err) {
      toast.error(inventoryErrorMessage(err));
    }
  }

  if (!hydrated || status === "loading") {
    return (
      <>
        <AppHeader />
        <PageHeader title="Producto" backHref="/inventario" backLabel="Inventario" />
        <SkeletonList count={3} className="mx-4 mt-5" />
      </>
    );
  }

  if (status !== "ready" || !product) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Producto" backHref="/inventario" backLabel="Inventario" />
        <div className="mx-4 mt-5 lg:mx-0">
          <EmptyState
            icon={Package}
            tone={status === "error" ? "error" : "empty"}
            title={status === "missing" ? "No encontramos este producto" : "No pudimos cargar el producto"}
            description={status === "missing" ? "Puede que se haya eliminado o que no pertenezca a este negocio." : "Revisa tu conexión e inténtalo de nuevo."}
            action={{ label: "Volver al inventario", href: "/inventario" }}
          />
        </div>
      </>
    );
  }

  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const unitLabel = UNITS.find((u) => u.value === product.unit)?.label ?? product.unit;
  const categoryName = categories.find((c) => c.id === product.category_id)?.name ?? "Sin categoría";
  const margin = canViewCosts && avgCost && avgCost > 0 ? product.price_cash - avgCost : null;

  const facts: { label: string; value: string }[] = [
    { label: "Código", value: product.barcode ?? "Sin código" },
    { label: "Categoría", value: categoryName },
    { label: "Unidad", value: unitLabel },
    { label: "Precio contado", value: money(product.price_cash) },
    { label: "Precio crédito", value: money(product.price_credit) },
    { label: "Stock mínimo", value: formatQty(product.min_stock) },
    ...(canViewCosts
      ? [
          { label: "Costo promedio", value: money(avgCost ?? 0) },
          ...(margin !== null ? [{ label: "Margen (contado)", value: money(margin) }] : []),
          { label: "Valor en stock", value: money(product.stock * (avgCost ?? 0)) },
        ]
      : []),
  ];

  return (
    <>
      <AppHeader />
      <PageContainer>
        <PageHeader
          className="lg:mx-0 lg:mt-0"
          title={product.name}
          subtitle={product.active ? undefined : "Producto inactivo"}
          backHref="/inventario"
          backLabel="Inventario"
        />

        <section className="mx-4 mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:mx-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--color-text-faint)]">Stock actual</p>
              <p className="tabular text-2xl font-bold">
                {formatQty(product.stock)} <span className="text-base font-medium text-[var(--color-text-muted)]">{product.unit}</span>
              </p>
            </div>
            {product.active ? <StockBadge stock={product.stock} minStock={product.min_stock} /> : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs text-[var(--color-text-faint)]">{f.label}</dt>
                <dd className="truncate text-sm font-medium" title={f.value}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mx-4 mt-3 flex flex-wrap gap-2 lg:mx-0">
          {permissions.canManageProducts ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden />
              Editar
            </Button>
          ) : null}
          {permissions.canReceiveStock && product.active ? (
            <Link href={`/inventario/entradas/nueva?producto=${product.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              Entrada
            </Link>
          ) : null}
          {permissions.canAdjustStock ? (
            <Button variant="secondary" size="sm" onClick={() => setAdjusting(true)}>
              Ajustar
            </Button>
          ) : null}
          <Link href={`/inventario/etiquetas?ids=${product.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
            Etiqueta
          </Link>
          {permissions.canManageProducts ? (
            <Button variant={product.active ? "danger" : "secondary"} size="sm" onClick={() => toggleActive(product)}>
              {product.active ? "Desactivar" : "Reactivar"}
            </Button>
          ) : null}
        </div>

        {canViewCosts ? (
          <section className="mx-4 mt-6 mb-4 lg:mx-0">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Kardex</h2>
            <KardexTable movements={movements} showCosts={canViewCosts} currency={currency} currentUserId={user?.id} />
          </section>
        ) : null}
      </PageContainer>

      {editing && workspaceId ? (
        <ProductSheet
          workspaceId={workspaceId}
          product={product}
          categories={categories}
          canViewCosts={canViewCosts}
          avgCost={avgCost}
          onClose={() => setEditing(false)}
          onSaved={() => void load()}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
        />
      ) : null}
      {permissions.canAdjustStock ? (
        <AdjustSheet
          product={product}
          open={adjusting}
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false);
            void load();
          }}
        />
      ) : null}
    </>
  );
}
