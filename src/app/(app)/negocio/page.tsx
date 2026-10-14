"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useFinance } from "@/context/FinanceContext";
import type { TaxRegime, Workspace } from "@/types/finance";

const REGIMES: { value: TaxRegime; label: string }[] = [
  { value: "simple", label: "Régimen Simple de Tributación (RST)" },
  { value: "ordinario", label: "Régimen ordinario (renta general)" },
  { value: "no_responsable_iva", label: "No responsable de IVA" },
];

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] disabled:opacity-70";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

function BusinessForm({ ws, canEdit }: { ws: Workspace; canEdit: boolean }) {
  const { updateWorkspace } = useFinance();
  const [name, setName] = useState(ws.name);
  const [doc, setDoc] = useState(ws.document ?? "");
  const [regime, setRegime] = useState<TaxRegime>(ws.taxRegime ?? "no_responsable_iva");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El negocio necesita un nombre.");
      return;
    }
    setBusy(true);
    const ok = await updateWorkspace(ws.id, { name, document: doc.trim() || null, taxRegime: regime });
    setBusy(false);
    if (ok) toast.success("Datos del negocio guardados.");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div>
        <label className={labelClass}>Nombre del negocio</label>
        <input className={inputClass} value={name} maxLength={60} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>NIT o cédula</label>
        <input
          className={inputClass}
          value={doc}
          maxLength={20}
          disabled={!canEdit}
          inputMode="numeric"
          placeholder="Ej. 900123456-7"
          onChange={(e) => setDoc(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Régimen tributario</label>
        <select className={inputClass} value={regime} disabled={!canEdit} onChange={(e) => setRegime(e.target.value as TaxRegime)}>
          {REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
          Si no estás seguro, pregúntale a tu contador. Puedes cambiarlo cuando quieras.
        </p>
      </div>
      {canEdit ? (
        <button
          type="submit"
          disabled={busy}
          className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Guardando..." : "Guardar cambios"}
        </button>
      ) : (
        <p className="text-xs text-[var(--color-text-faint)]">Solo el dueño o un admin pueden editar estos datos.</p>
      )}
    </form>
  );
}

export default function NegocioPage() {
  const { currentWorkspace } = useFinance();
  const canEdit = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  return (
    <div className="pb-8">
      <AppHeader />
      <div className="px-4 pt-5">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">Datos del negocio</h1>
        {currentWorkspace ? (
          <BusinessForm key={currentWorkspace.id} ws={currentWorkspace} canEdit={canEdit} />
        ) : null}
      </div>
    </div>
  );
}
