"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import {
  deletionDate,
  fetchProfile,
  formatLongDate,
  requestAccountDeletion,
  signOutEverywhere,
  updateFullName,
  updatePassword,
  type AccountProfile,
} from "@/lib/account";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:opacity-70";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";

export default function CuentaPage() {
  const { user } = useFinance();
  const confirm = useConfirm();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileState, setProfileState] = useState<"loading" | "ok" | "error">("loading");
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id)
      .then((p) => {
        setProfile(p);
        setName(p?.full_name ?? user.name ?? "");
        setProfileState(p ? "ok" : "error");
      })
      .catch(() => {
        setName(user.name ?? "");
        setProfileState("error");
      });
  }, [user]);

  if (!user) return null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSavingName(true);
    const ok = await updateFullName(user.id, name.trim());
    setSavingName(false);
    if (ok) toast.success("Nombre actualizado.");
    else toast.error("No se pudo actualizar el nombre. Intenta de nuevo.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (password.length < 8) return setPwError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmPw) return setPwError("Las contraseñas no coinciden.");
    setSavingPw(true);
    const err = await updatePassword(password);
    setSavingPw(false);
    if (err) return setPwError("No se pudo cambiar la contraseña. Intenta de nuevo; si sigue fallando, cierra sesión y vuelve a entrar.");
    setPassword("");
    setConfirmPw("");
    toast.success("Contraseña actualizada.");
  }

  async function signOutAll() {
    const ok = await confirm({
      title: "¿Cerrar sesión en todos los dispositivos?",
      description: "Tendrás que volver a iniciar sesión en cada uno, también en este.",
      confirmLabel: "Cerrar todas las sesiones",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await signOutEverywhere();
      window.location.href = "/login"; // eslint-disable-line @next/next/no-location-assign-relative-destination
    } catch {
      setBusy(false);
      toast.error("No se pudo cerrar las sesiones. Intenta de nuevo.");
    }
  }

  async function toggleDeletion(cancel: boolean) {
    if (!cancel) {
      const ok = await confirm({
        title: "¿Eliminar tu cuenta?",
        description:
          "Tu cuenta y tus datos se eliminarán de forma definitiva en 30 días. Puedes cancelar la solicitud antes de esa fecha.",
        confirmLabel: "Solicitar eliminación",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    const res = await requestAccountDeletion(cancel);
    setBusy(false);
    if (!res.ok) return toast.error("No se pudo procesar la solicitud. Intenta de nuevo.");
    setProfile((p) => (p ? { ...p, deletion_requested_at: res.date } : p));
    toast.success(cancel ? "Eliminación cancelada. Tu cuenta sigue activa." : "Eliminación programada.");
  }

  const pending = profile?.deletion_requested_at ?? null;

  return (
    <div className="pb-28">
      <AppHeader />
      <PageHeader title="Mi cuenta" backHref="/ajustes" backLabel="Ajustes" />
      <div className="mx-4 mt-4 flex flex-col gap-4">
        {profileState === "error" ? (
          <p role="alert" className="rounded-xl border border-[var(--color-warning)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            No pudimos cargar todos los datos de tu perfil. Puedes seguir usando esta pantalla; recarga si algo no aparece.
          </p>
        ) : null}

        <form onSubmit={saveName} className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold">Tus datos</h2>
          <label className="block">
            <span className={labelClass}>Nombre</span>
            <input
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-3 block">
            <span className={labelClass}>Email</span>
            <input value={user.email} readOnly disabled className={inputClass} />
            <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">El email no se puede cambiar desde aquí.</span>
          </label>
          <Button type="submit" loading={savingName} disabled={!name.trim()} className="mt-4">
            {savingName ? "Guardando..." : "Guardar nombre"}
          </Button>
        </form>

        <form onSubmit={savePassword} noValidate className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold">Cambiar contraseña</h2>
          <label className="block">
            <span className={labelClass}>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="pw-hint"
              aria-invalid={pwError ? true : undefined}
              className={inputClass}
            />
            <span id="pw-hint" className="mt-1.5 block text-xs text-[var(--color-text-muted)]">Mínimo 8 caracteres.</span>
          </label>
          <label className="mt-3 block">
            <span className={labelClass}>Confirmar contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              aria-invalid={pwError ? true : undefined}
              className={inputClass}
            />
          </label>
          {pwError ? (
            <p role="alert" className="mt-3 text-sm text-[var(--color-expense)]">
              {pwError}
            </p>
          ) : null}
          <Button type="submit" loading={savingPw} disabled={!password} className="mt-4">
            {savingPw ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </form>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold">Términos y privacidad</h2>
          {profileState === "loading" ? (
            <Skeleton className="mt-2 h-5 w-3/4" />
          ) : (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {profile?.terms_accepted_at
                ? `Aceptaste los términos el ${formatLongDate(profile.terms_accepted_at)}${profile.terms_version ? ` (versión ${profile.terms_version})` : ""}.`
                : "Aún no hay registro de que hayas aceptado los términos."}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/legal/terminos" target="_blank" className={buttonClass({ variant: "secondary", size: "sm" })}>
              Términos
            </Link>
            <Link href="/legal/privacidad" target="_blank" className={buttonClass({ variant: "secondary", size: "sm" })}>
              Privacidad
            </Link>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold">Sesiones</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Cierra tu sesión en todos los dispositivos donde la tengas abierta.
          </p>
          <Button variant="secondary" onClick={signOutAll} loading={busy} className="mt-3">
            Cerrar sesión en todos los dispositivos
          </Button>
        </section>

        <section className={`${cardClass} border-[var(--color-expense)]`}>
          <h2 className="text-sm font-semibold text-[var(--color-expense)]">Eliminar mi cuenta</h2>
          {pending ? (
            <>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Tu cuenta se eliminará el {formatLongDate(deletionDate(pending))}. Hasta entonces puedes cancelar la
                eliminación.
              </p>
              <Button onClick={() => toggleDeletion(true)} loading={busy} className="mt-3">
                Cancelar eliminación
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Al solicitarlo, tu cuenta y tus datos se eliminan de forma definitiva después de 30 días. En ese lapso
                puedes cancelar. Antes, exporta tu copia desde Ajustes.
              </p>
              <Button
                variant="danger"
                onClick={() => toggleDeletion(false)}
                loading={busy}
                className="mt-3 border-[var(--color-expense)]"
              >
                Eliminar mi cuenta
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
