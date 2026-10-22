"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { CameraScanButton } from "@/components/inventory/CameraScanButton";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount, formatAmountInput, parseAmountInput, toISODate } from "@/lib/format";
import { inventoryErrorMessage, listProducts, receiveStock } from "@/lib/inventory/api";
import { useBarcodeScanner } from "@/lib/inventory/useBarcodeScanner";
import { UNITS, isValidQuantity } from "@/lib/inventory/units";
import type { Product } from "@/types/inventory";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const NEW_SUPPLIER = "__new__";

interface Line {
  productId: string;
  qty: string;
  cost: number; // 0 = sin costo
}

function parseQty(value: string): number {
  const t = value.trim();
  return t === "" ? NaN : Number(t.replace(",", "."));
}

function NuevaEntrada() {
  const router = useRouter();
  const search = useSearchParams();
  const preselected = search.get("producto");
  const { state, hydrated, permissions, currentWorkspace, addContact } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const withCost = permissions.canReceiveWithCost;

  const [products, setProducts] = useState<Product[] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [recordExpense, setRecordExpense] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [payStatus, setPayStatus] = useState<"paid" | "pending">("paid");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    listProducts(workspaceId)
      .then((list) => {
        if (!cancelled) setProducts(list.filter((p) => p.active));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(inventoryErrorMessage(err));
        setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const addProduct = useCallback((p: Product) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        return prev.map((l, idx) => {
          if (idx !== i) return l;
          const n = parseQty(l.qty);
          return { ...l, qty: String((Number.isFinite(n) ? n : 0) + 1) };
        });
      }
      return [...prev, { productId: p.id, qty: "1", cost: 0 }];
    });
  }, []);

  // Precarga ?producto=<id> una sola vez cuando llegan los productos.
  useEffect(() => {
    if (preloaded || !products || !preselected) return;
    const p = products.find((x) => x.id === preselected);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreloaded(true);
    if (p) addProduct(p);
  }, [products, preselected, preloaded, addProduct]);

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
  useBarcodeScanner(handleScan, !saving);

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const suppliers = state.contacts.filter((c) => !c.archived && (c.kind === "supplier" || c.kind === "both"));
  const accounts = state.accounts.filter((a) => !a.archived);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !products) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q)).slice(0, 6);
  }, [query, products]);

  const allCosted = lines.length > 0 && lines.every((l) => l.cost > 0);
  const total = lines.reduce((s, l) => {
    const n = parseQty(l.qty);
    return s + (Number.isFinite(n) ? n * l.cost : 0);
  }, 0);
  const expenseOn = withCost && recordExpense && allCosted;
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  const submit = useCallback(async () => {
    if (saving || !workspaceId) return;
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    for (const l of lines) {
      const p = productById.get(l.productId);
      const n = parseQty(l.qty);
      if (!p || !Number.isFinite(n) || n <= 0 || !isValidQuantity(p.unit, n)) {
        setError(`Revisa la cantidad de ${p?.name ?? "un producto"}.`);
        return;
      }
    }
    if (expenseOn && payStatus === "paid" && !accountId) {
      setError("Elige la cuenta desde la que pagaste.");
      return;
    }
    if (expenseOn && payStatus === "pending" && !dueDate) {
      setError("Indica la fecha de vencimiento.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let supplier: string | null = supplierId && supplierId !== NEW_SUPPLIER ? supplierId : null;
      if (supplierId === NEW_SUPPLIER) {
        if (!newSupplier.trim()) {
          setError("Escribe el nombre del proveedor.");
          setSaving(false);
          return;
        }
        const created = await addContact({ kind: "supplier", name: newSupplier.trim() });
        if (!created) {
          setError("No se pudo crear el proveedor.");
          setSaving(false);
          return;
        }
        supplier = created.id;
      }
      const id = await receiveStock({
        workspaceId,
        supplierId: supplier,
        date,
        lines: lines.map((l) => ({
          product_id: l.productId,
          quantity: parseQty(l.qty),
          unit_cost: withCost && l.cost > 0 ? l.cost : null,
        })),
        expense: {
          create: expenseOn,
          accountId: expenseOn ? accountId || null : null,
          status: payStatus,
          dueDate: expenseOn && payStatus === "pending" ? dueDate : null,
        },
      });
      toast.success("Entrada registrada.");
      router.push(typeof id === "string" ? `/inventario/entradas/${id}` : "/inventario/entradas");
    } catch (err) {
      setError(inventoryErrorMessage(err));
      setSaving(false);
    }
  }, [
    saving, workspaceId, lines, productById, expenseOn, payStatus, accountId, dueDate, supplierId,
    newSupplier, addContact, date, withCost, router,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        void submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  if (!hydrated || (permissions.canReceiveStock && products === null)) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Nueva entrada" backHref="/inventario/entradas" />
        <SkeletonList count={3} className="mx-4 mt-5" />
      </>
    );
  }

  if (!permissions.canReceiveStock) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Nueva entrada" backHref="/inventario/entradas" />
        <p className="mx-4 mt-5 text-sm text-[var(--color-text-muted)]">No tienes permiso para registrar entradas.</p>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <PageHeader title="Nueva entrada" subtitle="Escanea o busca los productos que llegaron." backHref="/inventario/entradas" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mx-4 mt-5 flex max-w-2xl flex-col gap-5 pb-24"
      >
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
                    <span className="truncate font-medium">{p.name}</span>
                    <Plus size={16} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="text-sm text-[var(--color-text-muted)]">No hay productos con esa búsqueda.</p>
          ) : null}
        </section>

        <section aria-label="Productos de la entrada" className="flex flex-col gap-2">
          {lines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              Aún no hay productos. Escanea un código o búscalo por nombre.
            </p>
          ) : (
            lines.map((l) => {
              const p = productById.get(l.productId);
              const unit = UNITS.find((u) => u.value === p?.unit)?.label.toLowerCase();
              return (
                <div
                  key={l.productId}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{p?.name ?? "Producto"}</p>
                    <button
                      type="button"
                      aria-label={`Quitar ${p?.name ?? "producto"}`}
                      onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>Cantidad{unit ? ` (${unit})` : ""}</span>
                      <input
                        inputMode="decimal"
                        value={l.qty}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, qty: e.target.value } : x)))
                        }
                        className={inputClass}
                      />
                    </label>
                    {withCost ? (
                      <label className="block">
                        <span className={labelClass}>Costo unitario</span>
                        <input
                          inputMode="numeric"
                          placeholder="0"
                          value={formatAmountInput(l.cost)}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) => (x.productId === l.productId ? { ...x, cost: parseAmountInput(e.target.value) } : x)),
                            )
                          }
                          className={inputClass}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
          {withCost && lines.length > 0 ? (
            <p className="text-right text-sm">
              Total: <span className="font-semibold">{money(total)}</span>
            </p>
          ) : null}
          {!withCost ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              Registras la entrada sin costo. Quien administra el negocio lo completa después.
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Proveedor</span>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">Sin proveedor</option>
              {suppliers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_SUPPLIER}>+ Nuevo proveedor</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          {supplierId === NEW_SUPPLIER ? (
            <label className="block sm:col-span-2">
              <span className={labelClass}>Nombre del proveedor</span>
              <input
                type="text"
                value={newSupplier}
                maxLength={120}
                onChange={(e) => setNewSupplier(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}
        </section>

        {withCost ? (
          <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">Registrar el gasto</span>
              <input
                type="checkbox"
                role="switch"
                checked={recordExpense}
                onChange={(e) => setRecordExpense(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
            </label>
            {recordExpense && !allCosted && lines.length > 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                Pon el costo en todas las líneas para registrar el gasto. Si no, la entrada queda con costo pendiente.
              </p>
            ) : null}
            {expenseOn ? (
              <>
                <SegmentedControl<"paid" | "pending">
                  aria-label="Estado del pago"
                  value={payStatus}
                  onChange={setPayStatus}
                  options={[
                    { value: "paid", label: "Pagado" },
                    { value: "pending", label: "Pendiente" },
                  ]}
                />
                <label className="block">
                  <span className={labelClass}>Cuenta</span>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
                    <option value="">{payStatus === "paid" ? "Elige una cuenta" : "Sin cuenta"}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                {payStatus === "pending" ? (
                  <label className="block">
                    <span className={labelClass}>Vence</span>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                  </label>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={saving}>
          {saving ? "Guardando..." : "Registrar entrada (F2)"}
        </Button>
      </form>
    </>
  );
}

export default function NuevaEntradaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaEntrada />
    </Suspense>
  );
}
