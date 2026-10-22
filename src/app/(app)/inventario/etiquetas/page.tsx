"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import JsBarcode from "jsbarcode";
import { Printer, Tags } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFinance } from "@/context/FinanceContext";
import { formatAmount } from "@/lib/format";
import { inventoryErrorMessage, listProducts } from "@/lib/inventory/api";
import { isValidGtin } from "@/lib/inventory/gtin";
import type { Product } from "@/types/inventory";

function BarcodeSvg({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opts = { width: 1.6, height: 40, fontSize: 12, margin: 0, displayValue: true };
    try {
      const ean = /^\d{13}$/.test(code) && isValidGtin(code);
      JsBarcode(el, code, { ...opts, format: ean ? "EAN13" : "CODE128" });
    } catch {
      el.replaceChildren();
    }
  }, [code]);
  return <svg ref={ref} className="max-w-full" role="img" aria-label={`Código de barras ${code}`} />;
}

function Label({ product, currency }: { product: Product; currency: string }) {
  return (
    <div className="label flex break-inside-avoid flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white p-2 text-center text-black">
      <p className="line-clamp-2 text-xs font-semibold leading-tight">{product.name}</p>
      <p className="text-base font-bold">{formatAmount(product.price_cash, currency as never)}</p>
      {product.barcode ? <BarcodeSvg code={product.barcode} /> : <p className="text-[10px]">Sin código</p>}
    </div>
  );
}

function Etiquetas() {
  const params = useSearchParams();
  const { currentWorkspace } = useFinance();
  const workspaceId = currentWorkspace?.id ?? null;
  const currency = currentWorkspace?.currency ?? "COP";
  const idsKey = params.get("ids") ?? "";
  const [products, setProducts] = useState<Product[] | null>(null);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    listProducts(workspaceId)
      .then((list) => {
        if (cancelled) return;
        const active = list.filter((p) => p.active);
        setProducts(active);
        const wanted = idsKey ? idsKey.split(",").filter(Boolean) : [];
        setSelected(new Set(active.filter((p) => wanted.includes(p.id)).map((p) => p.id)));
      })
      .catch((err) => {
        if (!cancelled) {
          setProducts([]);
          toast.error(inventoryErrorMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, idsKey]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(
      (p) => selected.has(p.id) || !q || p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q)
    );
  }, [products, search, selected]);

  const labels = useMemo(
    () =>
      (products ?? [])
        .filter((p) => selected.has(p.id))
        .flatMap((p) => Array.from({ length: copies[p.id] ?? 1 }, (_, i) => ({ key: `${p.id}-${i}`, product: p }))),
    [products, selected, copies]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #labels-print, #labels-print * { visibility: visible !important; }
          #labels-print { position: absolute; left: 0; top: 0; width: 100%; }
          #labels-print .label { border-color: #999; }
        }
      `}</style>
      <AppHeader />
      <PageContainer size="medium">
        <PageHeader
          title="Etiquetas"
          subtitle="Elige productos y cuántas copias imprimir."
          backHref="/inventario"
          backLabel="Inventario"
          actions={
            <Button size="sm" onClick={() => window.print()} disabled={labels.length === 0}>
              <Printer size={16} aria-hidden />
              Imprimir
            </Button>
          }
        />
        <div className="mx-4 mt-4 flex flex-col gap-4">
          {products && products.length === 0 ? (
            <EmptyState icon={Tags} title="Aún no tienes productos activos." />
          ) : (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código"
                aria-label="Buscar producto"
                className="w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40"
              />
              <ul className="flex max-h-72 flex-col overflow-y-auto rounded-2xl border border-[var(--color-border)]">
                {visible.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-h-11 items-center gap-3 border-b border-[var(--color-border)] px-3 py-1 last:border-b-0"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-5 w-5 accent-[var(--color-brand)]"
                      />
                      <span className="truncate text-sm">{p.name}</span>
                    </label>
                    {selected.has(p.id) ? (
                      <input
                        type="number"
                        min={1}
                        max={200}
                        inputMode="numeric"
                        value={copies[p.id] ?? 1}
                        onChange={(e) =>
                          setCopies((c) => ({
                            ...c,
                            [p.id]: Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))),
                          }))
                        }
                        aria-label={`Copias de ${p.name}`}
                        className="min-h-11 w-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 text-center text-base"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div id="labels-print" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {labels.map((l) => (
              <Label key={l.key} product={l.product} currency={currency} />
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

export default function EtiquetasPage() {
  return (
    <Suspense fallback={null}>
      <Etiquetas />
    </Suspense>
  );
}
