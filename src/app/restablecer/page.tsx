"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, TrendingUp } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 pr-12 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:opacity-60";

export default function RestablecerPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setHasSession(!!data.session));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError("No se pudo actualizar la contraseña. Pide un nuevo enlace e intenta de nuevo.");
    setDone(true);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Nueva contraseña</h1>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        {hasSession === null ? (
          <p role="status" className="text-center text-sm text-[var(--color-text-muted)]">
            Verificando el enlace...
          </p>
        ) : done ? (
          <>
            <div
              role="status"
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-sm text-[var(--color-text-muted)]"
            >
              <CheckCircle2 size={24} className="text-[var(--color-income)]" aria-hidden />
              Tu contraseña quedó actualizada. Ya puedes entrar con la nueva.
            </div>
            <Link href="/" className={buttonClass({ size: "lg", fullWidth: true, className: "rounded-full" })}>
              Ir a la app
            </Link>
          </>
        ) : !hasSession ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
            El enlace venció o ya se usó.{" "}
            <Link href="/recuperar" className="inline-flex min-h-11 items-center font-medium text-[var(--color-brand-light)] underline">
              Pide uno nuevo
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {(
              [
                ["password", "Nueva contraseña", password, setPassword],
                ["confirm", "Confirmar contraseña", confirm, setConfirm],
              ] as const
            ).map(([id, label, value, set]) => (
              <div key={id}>
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--color-text-muted)]">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={id}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-describedby={id === "password" ? "reset-hint" : undefined}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    disabled={loading}
                    className={inputClass}
                  />
                  {id === "password" ? (
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                      aria-pressed={show}
                      className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-xl text-[var(--color-text-muted)]"
                    >
                      {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                    </button>
                  ) : null}
                </div>
                {id === "password" ? (
                  <p id="reset-hint" className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                    Mínimo 8 caracteres.
                  </p>
                ) : null}
              </div>
            ))}
            {error ? (
              <p role="alert" className="text-sm text-[var(--color-expense)]">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" loading={loading} fullWidth className="rounded-full">
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
