"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Database,
  Download,
  Fingerprint,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CategoryModal } from "@/components/CategoryModal";
import { ICONS } from "@/lib/icons";
import { CURRENCY_LABELS } from "@/lib/defaults";
import { useFinance } from "@/context/FinanceContext";
import {
  disableAppLock,
  getAppLockConfig,
  isPlatformAuthenticatorAvailable,
  registerAppLock,
} from "@/lib/webauthn";
import type { Category, CurrencyCode, TransactionType } from "@/types/finance";

function CategoryRow({ category, onClick }: { category: Category; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category.color}22`, color: category.color }}
      >
        {(() => {
          const Icon = ICONS[category.icon];
          return <Icon size={17} />;
        })()}
      </span>
      <span className="flex-1 text-sm font-medium">{category.name}</span>
      <ChevronRight size={16} className="text-[var(--color-text-faint)]" />
    </button>
  );
}

export default function AjustesPage() {
  const {
    user,
    state,
    updateSettings,
    addCategory,
    updateCategory,
    deleteCategory,
    resetAllData,
    exportData,
    importData,
    signOut,
  } = useFinance();
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    editing: Category | null;
    defaultType: TransactionType;
  }>({ open: false, editing: null, defaultType: "expense" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [lockSupported, setLockSupported] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage and WebAuthn are only available client-side, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockEnabled(Boolean(getAppLockConfig()?.enabled));
    isPlatformAuthenticatorAvailable().then(setLockSupported);
  }, []);

  const expenseCategories = state.categories.filter((c) => c.type === "expense");
  const incomeCategories = state.categories.filter((c) => c.type === "income");

  function handleSaveCategory(data: { name: string; icon: Category["icon"]; color: string; type: TransactionType }) {
    if (categoryModal.editing) {
      updateCategory(categoryModal.editing.id, data);
    } else {
      addCategory(data);
    }
  }

  function handleExport() {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await importData(String(reader.result));
      setImportMessage(ok ? "Datos importados correctamente." : "El archivo no tiene un formato válido.");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleReset() {
    const confirmed = window.confirm(
      "¿Seguro que quieres borrar todos tus movimientos y categorías? Esta acción no se puede deshacer."
    );
    if (confirmed) resetAllData();
  }

  async function handleToggleLock() {
    setLockError(null);
    if (lockEnabled) {
      disableAppLock();
      setLockEnabled(false);
      return;
    }
    setLockBusy(true);
    const ok = await registerAppLock(user?.email ?? "finanzas");
    setLockBusy(false);
    if (ok) {
      setLockEnabled(true);
    } else {
      setLockError("No se pudo activar el desbloqueo biométrico en este dispositivo.");
    }
  }

  async function handleSignOut() {
    const confirmed = window.confirm("¿Cerrar sesión?");
    if (confirmed) await signOut();
  }

  return (
    <>
      <AppHeader />

      <section className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="gradient-brand flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold text-white">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.name ?? "Tu cuenta"}</p>
          <p className="truncate text-xs text-[var(--color-text-faint)]">
            {user?.email || "Modo invitado — datos de prueba"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-expense)]"
        >
          <LogOut size={17} />
        </button>
      </section>

      <section className="mx-4 mt-5">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          Preferencias
        </h2>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-faint)]">Moneda</label>
          <select
            value={state.settings.currency}
            onChange={(e) => updateSettings({ currency: e.target.value as CurrencyCode })}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
          >
            {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {lockSupported ? (
        <section className="mx-4 mt-5">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
            Seguridad
          </h2>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
            <button
              type="button"
              onClick={handleToggleLock}
              disabled={lockBusy}
              className="flex w-full items-center gap-3 text-left disabled:opacity-60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]">
                <Fingerprint size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">Desbloquear con huella / Face ID</span>
                <span className="block text-xs text-[var(--color-text-faint)]">
                  {lockEnabled ? "Activado en este dispositivo" : "Pide biometría al abrir la app"}
                </span>
              </span>
              <span
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                  lockEnabled ? "bg-[var(--color-brand)] justify-end" : "bg-[var(--color-surface-3)] justify-start"
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white" />
              </span>
            </button>
            {lockError ? <p className="mt-2 text-xs text-[var(--color-expense)]">{lockError}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="mx-4 mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
            Categorías de gastos
          </h2>
          <button
            type="button"
            onClick={() => setCategoryModal({ open: true, editing: null, defaultType: "expense" })}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-brand-light)]"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
          {expenseCategories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onClick={() => setCategoryModal({ open: true, editing: c, defaultType: "expense" })}
            />
          ))}
        </div>
      </section>

      <section className="mx-4 mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
            Categorías de ingresos
          </h2>
          <button
            type="button"
            onClick={() => setCategoryModal({ open: true, editing: null, defaultType: "income" })}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-brand-light)]"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
          {incomeCategories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onClick={() => setCategoryModal({ open: true, editing: c, defaultType: "income" })}
            />
          ))}
        </div>
      </section>

      <section className="mx-4 mt-5 rounded-2xl border border-dashed border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/20 text-[var(--color-brand-light)]">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">Asistente con IA</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Próximamente: dicta, escribe o toma una foto de tus movimientos y deja que la IA los
              registre y categorice por ti. Esta función llegará en una fase 2.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-4 mt-5 mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          Datos
        </h2>
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition hover:bg-[var(--color-surface-2)]"
          >
            <Download size={17} className="text-[var(--color-text-muted)]" />
            Exportar copia de seguridad (JSON)
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition hover:bg-[var(--color-surface-2)]"
          >
            <Upload size={17} className="text-[var(--color-text-muted)]" />
            Importar copia de seguridad
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm text-[var(--color-expense)] transition hover:bg-[var(--color-surface-2)]"
          >
            <Trash2 size={17} />
            Borrar todos los datos
          </button>
        </div>
        {importMessage ? (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-[var(--color-text-muted)]">
            <Database size={13} /> {importMessage}
          </p>
        ) : null}
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-[var(--color-text-faint)]">
          Tus datos se guardan en tu cuenta y están disponibles desde cualquier dispositivo en el
          que inicies sesión con Google.
        </p>
      </section>

      {categoryModal.open ? (
        <CategoryModal
          key={categoryModal.editing?.id ?? `new-${categoryModal.defaultType}`}
          onClose={() => setCategoryModal((s) => ({ ...s, open: false }))}
          editing={categoryModal.editing}
          defaultType={categoryModal.defaultType}
          onSave={handleSaveCategory}
          onDelete={deleteCategory}
        />
      ) : null}
    </>
  );
}
