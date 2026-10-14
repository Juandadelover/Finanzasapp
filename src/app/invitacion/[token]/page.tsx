"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { acceptInvitation, errorMessage, getInvitation, type InvitationInfo } from "@/lib/team";

const STATUS_COPY: Record<string, string> = {
  accepted: "Esta invitación ya fue aceptada.",
  revoked: "Esta invitación fue cancelada. Pide a quien te invitó que te envíe una nueva.",
  expired: "Esta invitación venció. Pide que te la envíen de nuevo.",
};

export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [inv, { data }] = await Promise.all([getInvitation(token), supabase.auth.getUser()]);
      if (cancelled) return;
      setInfo(inv);
      setSessionEmail(data.user?.email ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, supabase]);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const workspaceId = await acceptInvitation(token);
      try {
        localStorage.setItem("finanzasapp:workspace", workspaceId);
      } catch {
        // localStorage no disponible: se ignora.
      }
      window.location.href = "/"; // eslint-disable-line @next/next/no-location-assign-relative-destination
    } catch (err) {
      setError(errorMessage(err, "No se pudo aceptar la invitación. Inténtalo de nuevo."));
      setBusy(false);
    }
  }

  const loginQs = info
    ? `redirectTo=${encodeURIComponent(`/invitacion/${token}`)}&email=${encodeURIComponent(info.email)}&invitado=1`
    : "";
  const mismatch =
    !!info && !!sessionEmail && sessionEmail.toLowerCase() !== info.email.toLowerCase();

  async function switchAccount() {
    await supabase.auth.signOut();
    window.location.href = `/login?${loginQs}`; // eslint-disable-line @next/next/no-location-assign-relative-destination
  }

  const btn =
    "gradient-brand block w-full rounded-xl py-3 text-center text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99] disabled:opacity-60";
  const btnAlt =
    "block w-full rounded-xl border border-[var(--color-border)] py-3 text-center text-sm font-medium";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="gradient-brand flex h-10 w-10 items-center justify-center rounded-2xl">
          <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-semibold tracking-tight">Finanzasapp</span>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {loading ? (
          <p className="text-center text-sm text-[var(--color-text-faint)]">Cargando invitación...</p>
        ) : !info ? (
          <>
            <h1 className="text-lg font-semibold">Invitación no encontrada</h1>
            <p className="text-sm text-[var(--color-text-faint)]">
              El enlace no es válido. Revisa que lo hayas copiado completo o pide que te envíen una invitación nueva.
            </p>
            <Link href="/login" className={btnAlt}>
              Ir a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Te invitaron a {info.workspace}</h1>
            <p className="text-sm text-[var(--color-text-faint)]">
              Participarás como{" "}
              <span className="font-medium text-[var(--color-brand-light)]">{ROLE_LABELS[info.role]}</span>. La
              invitación es para <span className="font-medium">{info.email}</span>.
            </p>

            {info.status !== "pending" ? (
              <>
                <p className="rounded-xl bg-[var(--color-surface-2)] p-3 text-sm">{STATUS_COPY[info.status]}</p>
                <Link href={sessionEmail ? "/" : "/login"} className={btnAlt}>
                  {sessionEmail ? "Ir a mi cuenta" : "Iniciar sesión"}
                </Link>
              </>
            ) : sessionEmail ? (
              mismatch ? (
                <>
                  <p className="rounded-xl bg-[var(--color-surface-2)] p-3 text-sm">
                    Iniciaste sesión como {sessionEmail}, pero esta invitación es para {info.email}. Cambia de cuenta
                    para aceptarla.
                  </p>
                  <button type="button" onClick={switchAccount} className={btn}>
                    Cambiar de cuenta
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleAccept} disabled={busy} className={btn}>
                    {busy ? "Aceptando..." : "Aceptar invitación"}
                  </button>
                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                </>
              )
            ) : (
              <>
                <Link href={`/login?${loginQs}`} className={btn}>
                  Crear cuenta
                </Link>
                <Link href={`/login?${loginQs}`} className={btnAlt}>
                  Ya tengo cuenta
                </Link>
                <p className="text-xs text-[var(--color-text-faint)]">
                  Usa el email {info.email} para que la invitación funcione.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
