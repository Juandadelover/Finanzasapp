"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { CameraScanButton } from "@/components/inventory/CameraScanButton";
import { CartLineRow, DiscountField } from "@/components/pos/CartLineRow";
import { CustomerPicker } from "@/components/pos/CustomerPicker";
import { PaymentSheet, type PaymentSubmit } from "@/components/pos/PaymentSheet";
import { ReceiptImage } from "@/components/pos/ReceiptImage";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount } from "@/lib/format";
import { inventoryErrorMessage, listProductCosts, listProducts } from "@/lib/inventory/api";
import { useBarcodeScanner } from "@/lib/inventory/useBarcodeScanner";
import { isValidQuantity } from "@/lib/inventory/units";
import { confirmSale } from "@/lib/pos/api";
import { cartTotals, recalcLines, type CartLine } from "@/lib/pos/totals";
import type { Product } from "@/types/inventory";
import type { Discount, SaleKind } from "@/types/pos";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <PageHeader title="Vender" />
        {children}
      </PageContainer>
    </>
  );
}

export default function VenderPage() {
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const canSell = permissions.canSell;
  const money = useCallback((v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency)), [hidden, currency]);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [kind, setKind] = useState<SaleKind>("cash");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [totalDiscount, setTotalDiscount] = useState<Discount | null>(null);
  const [showTotalDiscount, setShowTotalDiscount] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const canViewCosts = permissions.canViewCosts;

  useEffect(() => {
    if (!workspaceId || !canSell) return;
    let cancelled = false;
    Promise.all([listProducts(workspaceId), canViewCosts ? listProductCosts(workspaceId) : Promise.resolve([])])
      .then(([list, cs]) => {
        if (cancelled) return;
        setProducts(list.filter((p) => p.active));
        setCosts(new Map(cs.map((c) => [c.product_id, Number(c.avg_cost)])));
        setLoadError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(inventoryErrorMessage(err));
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, canSell, canViewCosts, reloadKey]);

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const addProduct = useCallback(
    (p: Product) => {
      setError(null);
      setLines((prev) => {
        if (prev.some((l) => l.productId === p.id)) {
          return prev.map((l) => (l.productId === p.id ? { ...l, quantity: Math.round((l.quantity + 1) * 1000) / 1000 } : l));
        }
        const unitPrice = kind === "credit" ? p.price_credit : p.price_cash;
        return [...prev, { productId: p.id, name: p.name, unit: p.unit, quantity: 1, unitPrice, discount: null }];
      });
      if ((kind === "credit" ? p.price_credit : p.price_cash) <= 0) toast.warning(`${p.name} no tiene precio de ${kind === "credit" ? "crédito" : "contado"}.`);
    },
    [kind],
  );

  const handleScan = useCallback(
    (code: string) => {
      const p = products?.find((x) => x.barcode === code);
      if (!p) {
        toast.error(`No hay un producto con el código ${code}.`);
        return;
      }
      addProduct(p);
      toast.success(`${p.name} +1`);
    },
    [products, addProduct],
  );
  useBarcodeScanner(handleScan, canSell && !payOpen && !saving && receiptId === null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !products) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q)).slice(0, 6);
  }, [query, products]);

  const totals = useMemo(() => cartTotals(lines, totalDiscount), [lines, totalDiscount]);
  const accounts = state.accounts.filter((a) => !a.archived);

  function changeKind(next: SaleKind) {
    setKind(next);
    setLines((prev) => recalcLines(prev, products ?? [], next));
  }

  const openPayment = useCallback(() => {
    if (saving) return;
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    for (const l of lines) {
      if (!(l.quantity > 0) || !isValidQuantity(l.unit, l.quantity)) {
        setError(`Revisa la cantidad de ${l.name}.`);
        return;
      }
    }
    if (kind === "credit" && !contactId) {
      setError("Elige o crea el cliente para vender a crédito.");
      return;
    }
    if (totals.total <= 0) {
      setError("El total de la venta es $ 0.");
      return;
    }
    setError(null);
    setPayOpen(true);
  }, [saving, lines, kind, contactId, totals.total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2" && !payOpen) {
        e.preventDefault();
        openPayment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPayment, payOpen]);

  async function confirm(submit: PaymentSubmit) {
    if (saving || !workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await confirmSale({
        workspaceId,
        kind,
        contactId,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, discount: l.discount })),
        totalDiscount,
        payments: submit.payments,
        initialPayment: submit.initialPayment,
        notes,
      });
      toast.success(`Venta #${res.number} registrada.`);
      setLines([]);
      setTotalDiscount(null);
      setShowTotalDiscount(false);
      setContactId(null);
      setNotes("");
      setPayOpen(false);
      setReceiptId(res.sale_id);
      setReloadKey((k) => k + 1); // stock actualizado
    } catch (err) {
      setError(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated || (canSell && products === null && !loadError)) {
    return (
      <Shell>
        <SkeletonList count={3} className="mx-4 mt-5" />
      </Shell>
    );
  }

  if (!canSell) {
    return (
      <Shell>
        <div className="mx-4 mt-5">
          <EmptyState
            icon={ShoppingCart}
            title="Tu rol no puede vender"
            description="Pídele a un administrador del negocio que te dé acceso para registrar ventas."
          />
        </div>
      </Shell>
    );
  }

  if (loadError || products === null) {
    return (
      <Shell>
        <div className="mx-4 mt-5">
          <EmptyState
            icon={Package}
            tone="error"
            title="No pudimos cargar los productos"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={{ label: "Reintentar", onClick: () => setReloadKey((k) => k + 1) }}
          />
        </div>
      </Shell>
    );
  }

  const totalDiscounts = totals.lineDiscounts + totals.totalDiscount;

  return (
    <Shell>
      <div className="mx-4 mt-4 grid gap-5 pb-40 lg:grid-cols-[1fr_380px] lg:pb-10">
        <div className="flex min-w-0 flex-col gap-4">
          <SegmentedControl<SaleKind>
            aria-label="Tipo de venta"
            shape="rounded"
            value={kind}
            onChange={changeKind}
            options={[
              { value: "cash", label: "Contado" },
              { value: "credit", label: "Crédito" },
            ]}
          />

          <section className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className={labelClass}>Buscar producto</span>
                <span className="relative block">
                  <Search
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && results.length === 1) {
                        e.preventDefault();
                        addProduct(results[0]);
                        setQuery("");
                      }
                    }}
                    placeholder="Nombre o código"
                    className={`${inputClass} pl-10`}
                  />
                </span>
              </label>
              <CameraScanButton onScan={handleScan} />
            </div>
            {results.length > 0 ? (
              <ul className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        addProduct(p);
                        setQuery("");
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {money(kind === "credit" ? p.price_credit : p.price_cash)} · Stock {String(p.stock).replace(".", ",")}
                        </span>
                      </span>
                      <Plus size={16} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <p className="text-sm text-[var(--color-text-muted)]">No hay productos con esa búsqueda.</p>
            ) : null}
          </section>

          <section aria-label="Productos de la venta">
            {lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                Escanea un código o busca el producto por nombre.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lines.map((l) => (
                  <CartLineRow
                    key={l.productId}
                    line={l}
                    money={money}
                    stock={productById.get(l.productId)?.stock ?? null}
                    avgCost={canViewCosts ? (costs.get(l.productId) ?? null) : null}
                    onQuantity={(q) => setLines((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, quantity: q } : x)))}
                    onDiscount={(d) => setLines((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, discount: d } : x)))}
                    onRemove={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <span className={labelClass}>Cliente{kind === "credit" ? " (obligatorio)" : ""}</span>
            <CustomerPicker value={contactId} onChange={setContactId} required={kind === "credit"} />
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
            <p className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotal)}</span>
            </p>
            {totals.lineDiscounts > 0 ? (
              <p className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Descuentos por producto</span>
                <span className="tabular-nums">-{money(totals.lineDiscounts)}</span>
              </p>
            ) : null}
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="font-medium">Descuento sobre el total</span>
              <input
                type="checkbox"
                role="switch"
                checked={showTotalDiscount}
                onChange={(e) => {
                  setShowTotalDiscount(e.target.checked);
                  if (!e.target.checked) setTotalDiscount(null);
                }}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
            </label>
            {showTotalDiscount ? (
              <DiscountField value={totalDiscount} onChange={setTotalDiscount} label="total de la venta" />
            ) : null}
            {totals.totalDiscount > 0 ? (
              <p className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Descuento total</span>
                <span className="tabular-nums">-{money(totals.totalDiscount)}</span>
              </p>
            ) : null}
            {totalDiscounts > 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">Descuento de la venta: {String(totals.discountPct).replace(".", ",")} %</p>
            ) : null}
            <label className="mt-1 block">
              <span className={labelClass}>Nota (opcional)</span>
              <input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </label>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] z-(--z-bar) mx-4 -mt-32 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 shadow-[var(--shadow-sheet)] lg:static lg:mt-0 lg:ml-auto lg:max-w-[380px] lg:-translate-y-6">
        {error && !payOpen ? (
          <p role="alert" className="mb-2 text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Total</p>
            <p className="truncate text-2xl font-bold tabular-nums">{money(totals.total)}</p>
          </div>
          <Button size="lg" onClick={openPayment} disabled={lines.length === 0} className="shrink-0">
            Cobrar<span className="hidden lg:inline"> (F2)</span>
          </Button>
        </div>
      </div>

      <PaymentSheet
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        kind={kind}
        total={totals.total}
        accounts={accounts}
        money={money}
        saving={saving}
        error={payOpen ? error : null}
        onConfirm={(s) => void confirm(s)}
      />
      {receiptId ? <ReceiptImage saleId={receiptId} open onClose={() => setReceiptId(null)} /> : null}
    </Shell>
  );
}
