"use client";

import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { formatAmount, formatAmountInput, formatDayLabel, parseAmountInput } from "@/lib/format";
import { completeReceipt, getReceipt, inventoryErrorMessage, listProducts } from "@/lib/inventory/api";
import { UNITS } from "@/lib/inventory/units";
import type { Product, StockMovement, StockReceipt } from "@/types/inventory";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

interface Detail {
  receipt: StockReceipt;
  lines: StockMovement[];
}

function qty(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
}

export default function EntradaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const workspaceId = currentWorkspace?.id ?? null;
  const canView = permissions.canViewCosts;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [recordExpense, setRecordExpense] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [payStatus, setPayStatus] = useState<"paid" | "pending">("paid");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [d, list] = await Promise.all([getReceipt(id), listProducts(workspaceId)]);
      setDetail(d as Detail | null);
      setProducts(new Map(list.map((p) => [p.id, p])));
      setLoadError(false);
    } catch (err) {
      toast.error(inventoryErrorMessage(err));
      // Si ya había una entrada en pantalla (recarga tras guardar), se conserva y solo sale el aviso.
      setLoadError(true);
    }
    setLoaded(true);
  }, [id, workspaceId]);

  useEffect(() => {
    if (!canView) return;
    // load() actualiza el estado después de la consulta asíncrona, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, canView]);

  const money = (v: number | null) => (v === null ? "—" : hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const backHref = "/inventario/entradas";

  if (!hydrated || (canView && !loaded)) {
    return (
      <>
        <AppHeader />
        <PageContainer size="narrow">
          <PageHeader title="Entrada" backHref={backHref} />
          <SkeletonList count={3} className="mx-4 mt-5" />
        </PageContainer>
      </>
    );
  }

  if (!canView || !detail) {
    const failed = canView && loadError;
    return (
      <>
        <AppHeader />
        <PageContainer size="narrow">
          <PageHeader title="Entrada" backHref={backHref} />
          <div className="mx-4 mt-5">
            <EmptyState
              icon={PackageX}
              tone={failed ? "error" : "empty"}
              title={
                !canView
                  ? "No tienes permiso para ver esta entrada"
                  : failed
                    ? "No pudimos cargar esta entrada"
                    : "No encontramos esta entrada"
              }
              description={failed ? "Revisa tu conexión e inténtalo de nuevo." : undefined}
              action={
                failed
                  ? {
                      label: "Reintentar",
                      onClick: () => {
                        setLoadError(false);
                        setLoaded(false);
                        void load();
                      },
                    }
                  : { label: "Volver a entradas", href: backHref }
              }
            />
          </div>
        </PageContainer>
      </>
    );
  }

  const { receipt, lines } = detail;
  const supplier = receipt.supplier_id ? state.contacts.find((c) => c.id === receipt.supplier_id)?.name : null;
  const pending = receipt.status === "pending_cost";
  const canComplete = pending && permissions.canReceiveWithCost;
  const missing = lines.filter((l) => l.unit_cost === null);
  const accounts = state.accounts.filter((a) => !a.archived);

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (missing.some((l) => !(costs[l.product_id] > 0))) {
      setError("Pon el costo de todos los productos.");
      return;
    }
    if (recordExpense && payStatus === "paid" && !accountId) {
      setError("Elige la cuenta desde la que pagaste.");
      return;
    }
    if (recordExpense && payStatus === "pending" && !dueDate) {
      setError("Indica la fecha de vencimiento.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await completeReceipt({
        receiptId: receipt.id,
        costs: missing.map((l) => ({ product_id: l.product_id, unit_cost: costs[l.product_id] })),
        expense: {
          create: recordExpense,
          accountId: recordExpense ? accountId || null : null,
          status: payStatus,
          dueDate: recordExpense && payStatus === "pending" ? dueDate : null,
        },
      });
      toast.success("Costos guardados.");
      await load();
    } catch (err) {
      setError(inventoryErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppHeader />
      <PageContainer size="narrow">
      <PageHeader
        title={`Entrada #${receipt.number}`}
        subtitle={`${formatDayLabel(receipt.date)} · ${supplier ?? "Sin proveedor"}`}
        backHref={backHref}
      />
      <div className="mx-4 mt-5 flex flex-col gap-5 pb-24">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <span className="text-sm text-[var(--color-text-muted)]">{pending ? "Falta costo" : "Total"}</span>
          <span className="text-lg font-bold">{money(receipt.total_cost)}</span>
        </div>
        {receipt.notes ? <p className="text-sm text-[var(--color-text-muted)]">{receipt.notes}</p> : null}

        <ul className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {lines.map((l) => {
            const p = products.get(l.product_id);
            const unit = UNITS.find((u) => u.value === p?.unit)?.label.toLowerCase() ?? "";
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p?.name ?? "Producto"}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {qty(l.quantity)} {unit} · Costo unitario {money(l.unit_cost)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {l.unit_cost === null ? "—" : money(l.unit_cost * l.quantity)}
                </span>
              </li>
            );
          })}
        </ul>

        {canComplete ? (
          <form onSubmit={handleComplete} className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="text-sm font-semibold">Completar costos</h2>
            {missing.map((l) => (
              <label key={l.id} className="block">
                <span className={labelClass}>{products.get(l.product_id)?.name ?? "Producto"} · costo unitario</span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={formatAmountInput(costs[l.product_id] ?? 0)}
                  onChange={(e) => setCosts((prev) => ({ ...prev, [l.product_id]: parseAmountInput(e.target.value) }))}
                  className={inputClass}
                />
              </label>
            ))}
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
            {recordExpense ? (
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
            {error ? (
              <p role="alert" className="text-sm text-[var(--color-expense)]">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={saving}>
              {saving ? "Guardando..." : "Guardar costos"}
            </Button>
          </form>
        ) : pending ? (
          <p className="text-sm text-[var(--color-text-muted)]">Quien administra el negocio debe completar el costo de esta entrada.</p>
        ) : null}
      </div>
      </PageContainer>
    </>
  );
}
