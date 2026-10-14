"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
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
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const primaryBtn =
  "gradient-brand rounded-full px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60";

export default function CuentaPage() {
  const { user } = useFinance();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id).then((p) => {
      setProfile(p);
      setName(p?.full_name ?? user.name ?? "");
    });
  }, [user]);

  if (!user) return null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSavingName(true);
    const ok = await updateFullName(user.id, name.trim());
    setSavingName(false);
    if (ok) toast.success("Nombre actualizado");
    else toast.error("No se pudo actualizar el nombre");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setSavingPw(true);
    const err = await updatePassword(password);
    setSavingPw(false);
    if (err) return toast.error("No se pudo cambiar la contraseña");
    setPassword("");
    setConfirm("");
    toast.success("Contraseña actualizada");
  }

  async function signOutAll() {
    setBusy(true);
    await signOutEverywhere();
    window.location.href = "/login";
  }

  async function toggleDeletion(cancel: boolean) {
    if (
      !cancel &&
      !window.confirm(
        "Tu cuenta y tus datos se eliminarán en 30 días. Puedes cancelar antes de esa fecha. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    const res = await requestAccountDeletion(cancel);
    setBusy(false);
    if (!res.ok) return toast.error("No se pudo procesar la solicitud");
    setProfile((p) => (p ? { ...p, deletion_requested_at: res.date } : p));
    toast.success(cancel ? "Eliminación cancelada" : "Eliminación programada");
  }

  const pending = profile?.deletion_requested_at ?? null;

  return (
    <div className="pb-28">
      <AppHeader />
      <div className="mt-5 flex flex-col gap-4 px-4">
        <h1 className="text-xl font-bold">Mi cuenta</h1>

        <form onSubmit={saveName} className={cardClass}>
          <label htmlFor="name" className={labelClass}>Nombre</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <label className={`${labelClass} mt-3`}>Email</label>
          <input value={user.email} readOnly disabled className={inputClass} />
          <button type="submit" disabled={savingName || !name.trim()} className={`${primaryBtn} mt-4`}>
            {savingName ? "Guardando..." : "Guardar"}
          </button>
        </form>

        <form onSubmit={savePassword} className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold">Cambiar contraseña</h2>
          <label htmlFor="pw" className={labelClass}>Nueva contraseña</label>
          <input id="pw" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <label htmlFor="pw2" className={`${labelClass} mt-3`}>Confirmar</label>
          <input id="pw2" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          <button type="submit" disabled={savingPw || !password} className={`${primaryBtn} mt-4`}>
            {savingPw ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>

        <div className={cardClass}>
          <h2 className="text-sm font-semibold">Legal</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {profile?.terms_accepted_at
              ? `Términos aceptados el ${formatLongDate(profile.terms_accepted_at)}${profile.terms_version ? ` (versión ${profile.terms_version})` : ""}.`
              : "Aún no hay registro de aceptación de términos."}
          </p>
          <div className="mt-2 flex gap-4 text-xs">
            <Link href="/legal/terminos" target="_blank" className="text-[var(--color-brand-light)] underline">Términos</Link>
            <Link href="/legal/privacidad" target="_blank" className="text-[var(--color-brand-light)] underline">Privacidad</Link>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-sm font-semibold">Sesiones</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Cierra tu sesión en todos los dispositivos donde la tengas abierta.</p>
          <button type="button" onClick={signOutAll} disabled={busy} className="mt-3 rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-surface-2)] disabled:opacity-60">
            Cerrar sesión en todos los dispositivos
          </button>
        </div>

        <div className={`${cardClass} border-[var(--color-expense)]`}>
          <h2 className="text-sm font-semibold text-[var(--color-expense)]">Eliminar mi cuenta</h2>
          {pending ? (
            <>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Tu cuenta se eliminará el {formatLongDate(deletionDate(pending))}. Hasta entonces puedes cancelar la eliminación.
              </p>
              <button type="button" onClick={() => toggleDeletion(true)} disabled={busy} className={`${primaryBtn} mt-3`}>
                Cancelar eliminación
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Al solicitarlo, tu cuenta y tus datos se eliminarán de forma definitiva después de 30 días. En ese lapso puedes cancelar la solicitud.
              </p>
              <button type="button" onClick={() => toggleDeletion(false)} disabled={busy} className="mt-3 rounded-full bg-[var(--color-expense)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                Eliminar mi cuenta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
