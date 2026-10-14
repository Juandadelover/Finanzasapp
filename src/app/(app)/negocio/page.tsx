"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import type { TaxRegime, Workspace } from "@/types/finance";

const REGIMES: { value: TaxRegime; label: string }[] = [
  { value: "simple", label: "Régimen Simple de Tributación (RST)" },
  { value: "ordinario", label: "Régimen ordinario (renta general)" },
  { value: "no_responsable_iva", label: "No responsable de IVA" },
];

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:opacity-70";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

function BusinessForm({ ws, canEdit }: { ws: Workspace; canEdit: boolean }) {
  const { updateWorkspace } = useFinance();
  const [name, setName] = useState(ws.name);
  const [doc, setDoc] = useState(ws.document ?? "");
  const [regime, setRegime] = useState<TaxRegime>(ws.taxRegime ?? "no_responsable_iva");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe el nombre del negocio.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ok = await updateWorkspace(ws.id, { name, document: doc.trim() || null, taxRegime: regime });
      if (ok) toast.success("Datos del negocio guardados.");
    } catch {
      toast.error("No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-4 mt-4 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <label className="block">
        <span className={labelClass}>Nombre del negocio</span>
        <input
          className={inputClass}
          value={name}
          maxLength={60}
          disabled={!canEdit}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "negocio-error" : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <span id="negocio-error" role="alert" className="mt-1.5 block text-sm text-[var(--color-expense)]">
            {error}
          </span>
        ) : null}
      </label>
      <label className="block">
        <span className={labelClass}>NIT o cédula (opcional)</span>
        <input
          className={inputClass}
          value={doc}
          maxLength={20}
          disabled={!canEdit}
          inputMode="numeric"
          placeholder="Ej. 900123456-7"
          onChange={(e) => setDoc(e.target.value)}
        />
        <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">Aparece en tus cuentas de cobro.</span>
      </label>
      <label className="block">
        <span className={labelClass}>Régimen tributario</span>
        <select
          className={inputClass}
          value={regime}
          disabled={!canEdit}
          onChange={(e) => setRegime(e.target.value as TaxRegime)}
        >
          {REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">
          Si no estás seguro, pregúntale a tu contador. Puedes cambiarlo cuando quieras.
        </span>
      </label>
      {canEdit ? (
        <Button type="submit" loading={busy} fullWidth>
          {busy ? "Guardando..." : "Guardar cambios"}
        </Button>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          Solo el dueño o un administrador del negocio puede editar estos datos.
        </p>
      )}
    </form>
  );
}

export default function NegocioPage() {
  const { currentWorkspace, hydrated } = useFinance();
  const canEdit = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  return (
    <PageContainer size="narrow" className="pb-8">
      <AppHeader />
      <PageHeader title="Datos del negocio" backHref="/ajustes" backLabel="Ajustes" />
      {currentWorkspace ? (
        <BusinessForm key={currentWorkspace.id} ws={currentWorkspace} canEdit={canEdit} />
      ) : hydrated ? (
        <div className="mx-4 mt-4">
          <EmptyState icon={Briefcase} title="No hay un negocio seleccionado" description="Elige uno en el encabezado." />
        </div>
      ) : (
        <div className="mx-4 mt-4 flex flex-col gap-3" role="status">
          <span className="sr-only">Cargando...</span>
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      )}
    </PageContainer>
  );
}
