"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 pr-11 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] disabled:opacity-60";

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
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Nueva contraseña</h1>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        {hasSession === null ? null : done ? (
          <>
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
              Tu contraseña fue actualizada.
            </p>
            <Link
              href="/"
              className="gradient-brand flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white"
            >
              Ir a la app
            </Link>
          </>
        ) : !hasSession ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
            El enlace venció o no es válido.{" "}
            <Link href="/recuperar" className="font-medium text-[var(--color-brand-light)] underline">
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
                <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={id}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    disabled={loading}
                    className={inputClass}
                  />
                  {id === "password" ? (
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="gradient-brand flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
