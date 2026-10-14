"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatAmountInput, formatDayLabel, parseAmountInput } from "@/lib/format";
import {
  FREQUENCY_LABEL,
  mapRecurrence,
  type Recurrence,
  type RecurrenceRow,
} from "@/lib/recurrences";
import { toastDbError } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

function EditSheet({
  rec,
  onClose,
  onSaved,
}: {
  rec: Recurrence;
  onClose: () => void;
  onSaved: () => void;
}) {
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
        <div>
          <label className={labelClass}>Monto</label>
          <input
            inputMode="numeric"
            placeholder="0"
            value={formatAmountInput(amount)}
            onChange={(e) => setAmount(parseAmountInput(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <input
            type="text"
            value={description}
            maxLength={120}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Hasta (opcional)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <p className="text-xs text-[var(--color-text-faint)]">
          Los cambios aplican a los próximos movimientos. Los ya generados no se modifican.
        </p>
        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
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

  const [items, setItems] = useState<Recurrence[] | null>(null);
  const [editing, setEditing] = useState<Recurrence | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const { data, error } = await createClient()
      .from("recurrences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("next_date", { ascending: true });
    if (error) {
      toast.error("No se pudieron cargar los recurrentes.");
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
    if (
      !window.confirm(
        "¿Eliminar este recurrente? Los movimientos ya generados se conservan; solo se detienen los próximos."
      )
    )
      return;
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
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  const active = items.filter((r) => r.active);
  const inactive = items.filter((r) => !r.active);

  const renderRow = (r: Recurrence) => (
    <div key={r.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          r.active
            ? "bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
        )}
      >
        <Repeat size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{r.description || categoryName(r.categoryId)}</span>
        <span className="block truncate text-xs text-[var(--color-text-faint)]">
          {categoryName(r.categoryId)} · {FREQUENCY_LABEL[r.frequency]} ·{" "}
          {r.active ? `Próximo ${formatDayLabel(r.nextDate)}` : "Pausado o finalizado"}
        </span>
        <span className="block truncate text-xs text-[var(--color-text-faint)]">
          Se genera como {r.generatedStatus === "paid" ? "pagado" : "pendiente"}
          {r.endDate ? ` · hasta ${formatDayLabel(r.endDate)}` : ""}
        </span>
      </span>
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: r.type === "income" ? "var(--color-income)" : "var(--color-expense)" }}
      >
        {r.type === "income" ? "+" : "-"}
        {money(r.amount)}
      </span>
      {canManage ? (
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={r.active ? "Pausar" : "Reanudar"}
            onClick={() => toggleActive(r)}
            className="rounded-full p-1.5 text-[var(--color-text-faint)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            {r.active ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            aria-label="Editar"
            onClick={() => setEditing(r)}
            className="rounded-full p-1.5 text-[var(--color-text-faint)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label="Eliminar"
            onClick={() => remove(r)}
            className="rounded-full p-1.5 text-[var(--color-text-faint)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
          >
            <Trash2 size={15} />
          </button>
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <AppHeader />
      <div className="mx-4 mt-4">
        <h1 className="text-xl font-bold">Recurrentes</h1>
        <p className="mt-1 text-xs text-[var(--color-text-faint)]">
          Movimientos que se repiten solos.
          {canManage ? " Crea uno desde “Nuevo movimiento” con la opción Repetir." : ""}
        </p>
      </div>

      {items.length === 0 ? (
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
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
              Activos
            </h2>
            {active.length === 0 ? (
              <p className="px-1 text-sm text-[var(--color-text-faint)]">No hay recurrentes activos.</p>
            ) : (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
                {active.map(renderRow)}
              </div>
            )}
          </section>
          {inactive.length > 0 ? (
            <section className="mx-4 mt-5 mb-4">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                Pausados o finalizados
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
