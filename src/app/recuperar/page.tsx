"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] disabled:opacity-60";

function Content() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Siempre mostramos la misma confirmación, exista o no el correo.
    try {
      await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=/restablecer`,
      });
    } catch {
      // ignorado a propósito
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        {sent ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
            Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja
            de entrada y la carpeta de spam.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
            </p>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="gradient-brand flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-2 text-center text-xs font-medium text-[var(--color-brand-light)] hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default function RecuperarPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
