"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  ChevronRight,
  Download,
  FileText,
  Fingerprint,
  Landmark,
  LineChart,
  LogOut,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CategoryModal } from "@/components/CategoryModal";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ICONS } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFinance } from "@/context/FinanceContext";
import {
  disableAppLock,
  getAppLockConfig,
  isPlatformAuthenticatorAvailable,
  registerAppLock,
} from "@/lib/webauthn";
import { formatAmount } from "@/lib/format";
import type { Category, CurrencyCode, TransactionType } from "@/types/finance";

const groupTitleClass = "mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const groupCardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5";
const rowClass =
  "flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition active:scale-[0.97] hover:bg-[var(--color-surface-2)] disabled:opacity-60";
const wellClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]";

function Group({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-4 mt-5 scroll-mt-4" aria-label={title}>
      <h2 className={groupTitleClass}>{title}</h2>
      <div className={groupCardClass}>{children}</div>
    </section>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <Link href={href} className={rowClass}>
      <span className={wellClass}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block truncate text-xs text-[var(--color-text-muted)]">{hint}</span> : null}
      </span>
      <ChevronRight size={16} className="shrink-0 text-[var(--color-text-faint)]" aria-hidden />
    </Link>
  );
}

function CategoryRow({
  category,
  currency,
  onClick,
}: {
  category: Category;
  currency: CurrencyCode;
  onClick?: () => void;
}) {
  const Icon = ICONS[category.icon];
  const content = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category.color}22`, color: category.color }}
      >
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{category.name}</span>
        {category.monthlyBudget ? (
          <span className="block text-xs text-[var(--color-text-muted)]">
            Presupuesto: {formatAmount(category.monthlyBudget, currency)}
          </span>
        ) : null}
      </span>
      {onClick ? <ChevronRight size={16} className="shrink-0 text-[var(--color-text-faint)]" aria-hidden /> : null}
    </>
  );

  if (!onClick) {
    return <div className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar categoría ${category.name}`}
      className={rowClass}
    >
      {content}
    </button>
  );
}

export default function AjustesPage() {
  const {
    user,
    isPlatformAdmin,
    state,
    permissions,
    addCategory,
    updateCategory,
    deleteCategory,
    resetAllData,
    exportData,
    importData,
    signOut,
  } = useFinance();
  const confirm = useConfirm();
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    editing: Category | null;
    defaultType: TransactionType;
  }>({ open: false, editing: null, defaultType: "expense" });
  const [catType, setCatType] = useState<TransactionType>("expense");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lockSupported, setLockSupported] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage and WebAuthn are only available client-side, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockEnabled(Boolean(getAppLockConfig()?.enabled));
    isPlatformAuthenticatorAvailable()
      .then(setLockSupported)
      .catch(() => setLockSupported(false));
  }, []);

  const visibleCategories = state.categories.filter((c) => c.type === catType);

  function handleSaveCategory(data: {
    name: string;
    icon: Category["icon"];
    color: string;
    type: TransactionType;
    monthlyBudget: number | null;
  }) {
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const ok = await importData(String(reader.result));
        setImportMessage(
          ok
            ? { ok: true, text: "Listo: los datos de la copia se agregaron a tu negocio." }
            : { ok: false, text: "No se pudo importar: el archivo no es una copia de seguridad válida de Finanzas." },
        );
      } catch {
        setImportMessage({ ok: false, text: "No se pudo importar el archivo. Revisa tu conexión e intenta de nuevo." });
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImporting(false);
      setImportMessage({ ok: false, text: "No se pudo leer el archivo. Intenta con otro." });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleReset() {
    const confirmed = await confirm({
      title: "¿Borrar todos los datos del negocio?",
      description:
        "Se borrarán todos los movimientos, las categorías que creaste y los presupuestos. No se puede deshacer. Si dudas, exporta una copia de seguridad primero.",
      confirmLabel: "Borrar todo",
      destructive: true,
    });
    if (!confirmed) return;
    setResetting(true);
    try {
      await resetAllData();
    } finally {
      setResetting(false);
    }
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
    const confirmed = await confirm({
      title: "¿Cerrar sesión?",
      description: "Tus datos quedan guardados en tu cuenta.",
      confirmLabel: "Cerrar sesión",
    });
    if (confirmed) await signOut();
  }

  const canManage = permissions.canManageCategories;

  return (
    <>
      <AppHeader />
      <PageHeader title="Ajustes" />

      <section
        aria-label="Tu perfil"
        className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
      >
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
          <span
            aria-hidden
            className="gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
          >
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.name ?? "Tu cuenta"}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {user?.email || "Modo invitado: datos de prueba"}
          </p>
        </div>
        <Button variant="ghost" onClick={handleSignOut} aria-label="Cerrar sesión" className="w-11 shrink-0 !px-0">
          <LogOut size={18} aria-hidden />
        </Button>
      </section>

      <Group title="Negocio">
        <NavRow href="/negocio" icon={Briefcase} label="Datos del negocio" hint="Nombre, NIT y régimen" />
        <NavRow href="/equipo" icon={Users} label="Equipo" hint="Invitaciones y roles" />
        <NavRow href="/cuentas" icon={Landmark} label="Cuentas" hint="Nequi, bancos y efectivo" />
        <NavRow href="#categorias" icon={Tags} label="Categorías" hint="De gastos e ingresos" />
      </Group>

      <Group title="Finanzas">
        <NavRow href="/recurrentes" icon={CalendarClock} label="Recurrentes" hint="Gastos e ingresos que se repiten" />
        <NavRow href="/reportes" icon={LineChart} label="Reportes" hint="Estado de resultados y flujo de caja" />
        <NavRow href="/cobros" icon={FileText} label="Cobros" hint="Cuentas de cobro en PDF" />
      </Group>

      <Group title="Cuenta">
        <NavRow href="/cuenta" icon={UserRound} label="Mi cuenta" hint="Nombre, contraseña y privacidad" />
        <NavRow href="/suscripcion" icon={Star} label="Mi suscripción" hint="Plan, pagos y límites" />
        {lockSupported ? (
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={lockEnabled}
              onClick={handleToggleLock}
              disabled={lockBusy}
              className={rowClass}
            >
              <span className={wellClass}>
                <Fingerprint size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Seguridad: huella o Face ID</span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {lockBusy
                    ? "Esperando confirmación del dispositivo..."
                    : lockEnabled
                      ? "Activado en este dispositivo"
                      : "Pide biometría al abrir la app"}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition active:scale-[0.97]",
                  lockEnabled
                    ? "justify-end bg-[var(--color-brand)]"
                    : "justify-start border border-[var(--color-text-faint)] bg-[var(--color-surface-3)]",
                )}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
              </span>
            </button>
            {lockError ? (
              <p role="alert" className="px-2.5 pb-2 text-xs text-[var(--color-expense)]">
                {lockError}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-h-14 items-center gap-3 px-2.5 py-2">
          <span className={wellClass}>
            <Palette size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-sm font-medium">Apariencia</p>
            <ThemeToggle />
          </div>
        </div>
      </Group>

      <Group title="Datos">
        <button type="button" onClick={handleExport} className={rowClass}>
          <Download size={18} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Exportar copia de seguridad</span>
            <span className="block text-xs text-[var(--color-text-muted)]">Archivo JSON con tus movimientos y categorías</span>
          </span>
        </button>
        {permissions.canImport ? (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={rowClass}
            >
              <Upload size={18} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{importing ? "Importando..." : "Importar copia de seguridad"}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  Se agrega a lo que ya tienes, no lo reemplaza
                </span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              aria-label="Archivo de copia de seguridad"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        ) : null}
        {permissions.canResetData ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className={cn(rowClass, "text-[var(--color-expense)]")}
          >
            <Trash2 size={18} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{resetting ? "Borrando..." : "Borrar todos los datos"}</span>
              <span className="block text-xs text-[var(--color-text-muted)]">Movimientos, categorías propias y presupuestos</span>
            </span>
          </button>
        ) : null}
      </Group>
      {importMessage ? (
        <p
          role="status"
          className={cn(
            "mx-4 mt-2 px-1 text-xs",
            importMessage.ok ? "text-[var(--color-income)]" : "text-[var(--color-expense)]",
          )}
        >
          {importMessage.text}
        </p>
      ) : null}
      <p className="mx-4 mt-3 px-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
        Tus datos se guardan en la cuenta del negocio y los ves desde cualquier dispositivo donde inicies sesión.
      </p>

      {isPlatformAdmin ? (
        <Group title="Administración">
          <NavRow href="/admin" icon={ShieldCheck} label="Panel de administración" hint="Pagos, clientes y configuración" />
        </Group>
      ) : null}

      <section id="categorias" className="mx-4 mt-6 scroll-mt-4" aria-labelledby="categorias-title">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3 px-1">
          <h2 id="categorias-title" className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Categorías
          </h2>
          {canManage ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCategoryModal({ open: true, editing: null, defaultType: catType })}
              className="text-[var(--color-brand-light)]"
            >
              <Plus size={15} aria-hidden /> Agregar
            </Button>
          ) : null}
        </div>
        <div
          role="group"
          aria-label="Tipo de categoría"
          className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface-2)] p-1"
        >
          {(
            [
              ["expense", "Gastos"],
              ["income", "Ingresos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={catType === value}
              onClick={() => setCatType(value)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-medium transition active:scale-[0.97]",
                catType === value
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {visibleCategories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={catType === "expense" ? "Aún no tienes categorías de gastos" : "Aún no tienes categorías de ingresos"}
            description={canManage ? "Toca Agregar para crear la primera." : "Quien administra el negocio puede crearlas."}
          />
        ) : (
          <div className={groupCardClass}>
            {visibleCategories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                currency={state.settings.currency}
                onClick={
                  canManage ? () => setCategoryModal({ open: true, editing: c, defaultType: c.type }) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-4 mb-6 mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 p-4">
        <span className={wellClass}>
          <Sparkles size={18} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Asistente con IA: próximamente</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Dictar, escribir o fotografiar tus movimientos para que se registren y categoricen solos. Aún no está
            disponible.
          </p>
        </div>
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
