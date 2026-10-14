"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatAmountInput, formatDayLabel, parseAmountInput } from "@/lib/format";
import { FREQUENCY_LABEL, mapRecurrence, type Recurrence, type RecurrenceRow } from "@/lib/recurrences";
import { toastDbError } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

function EditSheet({ rec, onClose, onSaved }: { rec: Recurrence; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(rec.amount);
  const [description, setDescription] = useState(rec.description);
  const [endDate, setEndDate] = useState(rec.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    if (endDate && endDate < rec.startDate) {
      setError("La fecha final no puede ser anterior al inicio.");
      return;
    }
    setSaving(true);
    // Si se extiende la fecha final de una recurrencia ya terminada, se reactiva.
    const reactivate = !rec.active && (!endDate || rec.nextDate <= endDate);
    const { error: dbError } = await createClient()
      .from("recurrences")
      .update({
        amount,
        description: description.trim(),
        end_date: endDate || null,
        ...(reactivate ? { active: true } : {}),
      })
      .eq("id", rec.id);
    setSaving(false);
    if (dbError) {
      toastDbError(dbError, "No se pudo guardar el cambio.");
      return;
    }
    toast.success("Recurrente actualizado.");
    onSaved();
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title="Editar recurrente">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className={labelClass}>Monto</span>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(amount)}
            onChange={(e) => setAmount(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Descripción</span>
          <input
            type="text"
            value={description}
            maxLength={120}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Hasta (opcional)</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </label>
        <p className="text-xs text-[var(--color-text-muted)]">
          Los cambios aplican a los próximos movimientos. Los ya generados no se modifican.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </BottomSheet>
  );
}

export default function RecurrentesPage() {
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const canManage = permissions.canEditTransactions;
  const workspaceId = currentWorkspace?.id ?? null;

  const confirm = useConfirm();
  const [items, setItems] = useState<Recurrence[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Recurrence | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoadError(false);
    const { data, error } = await createClient()
      .from("recurrences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("next_date", { ascending: true });
    if (error) {
      toast.error("No se pudieron cargar los recurrentes.");
      setLoadError(true);
      setItems([]);
      return;
    }
    setItems((data as RecurrenceRow[]).map(mapRecurrence));
  }, [workspaceId]);

  useEffect(() => {
    // load() actualiza el estado después de la consulta asíncrona, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));
  const categoryName = (id: string | null) =>
    (id && state.categories.find((c) => c.id === id)?.name) || "Sin categoría";

  async function toggleActive(r: Recurrence) {
    const { error } = await createClient().from("recurrences").update({ active: !r.active }).eq("id", r.id);
    if (error) {
      toastDbError(error, "No se pudo cambiar el estado.");
      return;
    }
    toast.success(r.active ? "Recurrente pausado." : "Recurrente reanudado.");
    void load();
  }

  async function remove(r: Recurrence) {
    const ok = await confirm({
      title: "¿Eliminar este recurrente?",
      description: "Los movimientos ya generados se conservan; solo se detienen los próximos.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await createClient().from("recurrences").delete().eq("id", r.id);
    if (error) {
      toastDbError(error, "No se pudo eliminar.");
      return;
    }
    toast.success("Recurrente eliminado.");
    void load();
  }

  if (!hydrated || items === null) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Recurrentes" />
        <SkeletonList count={3} className="mx-4 mt-5" />
      </>
    );
  }

  const active = items.filter((r) => r.active);
  const inactive = items.filter((r) => !r.active);

  const renderRow = (r: Recurrence) => (
    <div key={r.id} className="rounded-2xl px-2 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            r.active
              ? "bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
          )}
        >
          <Repeat size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.description || categoryName(r.categoryId)}</span>
          <span className="block text-xs text-[var(--color-text-muted)]">
            {categoryName(r.categoryId)} · {FREQUENCY_LABEL[r.frequency]} ·{" "}
            {r.active ? `Próximo ${formatDayLabel(r.nextDate)}` : "Pausado o terminado"}
          </span>
          <span className="block text-xs text-[var(--color-text-muted)]">
            Se registra como {r.generatedStatus === "paid" ? "pagado" : "pendiente"}
            {r.endDate ? ` · hasta ${formatDayLabel(r.endDate)}` : ""}
          </span>
        </span>
        <span
          className="max-w-[35%] shrink-0 truncate text-sm font-semibold tabular-nums"
          style={{ color: r.type === "income" ? "var(--color-income)" : "var(--color-expense)" }}
        >
          {r.type === "income" ? "+" : "-"}
          {money(r.amount)}
        </span>
      </div>
      {canManage ? (
        <span className="mt-1 flex items-center justify-end">
          <button
            type="button"
            aria-label={`${r.active ? "Pausar" : "Reanudar"} ${r.description || categoryName(r.categoryId)}`}
            onClick={() => toggleActive(r)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            {r.active ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </button>
          <button
            type="button"
            aria-label={`Editar ${r.description || categoryName(r.categoryId)}`}
            onClick={() => setEditing(r)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <Pencil size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Eliminar ${r.description || categoryName(r.categoryId)}`}
            onClick={() => remove(r)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <AppHeader />
      <PageHeader
        title="Recurrentes"
        subtitle={
          canManage
            ? "Movimientos que se repiten solos. Crea uno desde “Nuevo movimiento” con la opción Repetir."
            : "Movimientos que se repiten solos."
        }
      />

      {loadError ? (
        <div className="mx-4 mt-5">
          <EmptyState
            icon={Repeat}
            title="No pudimos cargar tus recurrentes"
            description="Revisa tu conexión e inténtalo de nuevo."
          />
          <Button variant="secondary" className="mt-3 w-full" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 mt-5">
          <EmptyState
            icon={Repeat}
            title="Aún no tienes movimientos recurrentes"
            description="Úsalos para lo que se repite: el arriendo, la nómina, el software o las suscripciones. Al crear un movimiento, elige “Repetir” y se registrará solo cada semana, mes o año."
          />
        </div>
      ) : (
        <>
          <section className="mx-4 mt-5">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Activos
            </h2>
            {active.length === 0 ? (
              <p className="px-1 text-sm text-[var(--color-text-muted)]">No hay recurrentes activos.</p>
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
                {active.map(renderRow)}
              </div>
            )}
          </section>
          {inactive.length > 0 ? (
            <section className="mx-4 mt-5 mb-4">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Pausados o terminados
              </h2>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 opacity-80">
                {inactive.map(renderRow)}
              </div>
            </section>
          ) : null}
        </>
      )}

      {editing ? (
        <EditSheet key={editing.id} rec={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />
      ) : null}
    </>
  );
}
