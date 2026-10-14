"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:opacity-60";

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
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3 lg:max-w-md lg:rounded-3xl lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-surface)] lg:p-8">
        {sent ? (
          <div
            role="status"
            className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-sm text-[var(--color-text-muted)]"
          >
            <MailCheck size={24} className="text-[var(--color-brand-light)]" aria-hidden />
            <p>
              Si <strong className="text-[var(--color-text)]">{email.trim()}</strong> está registrado, te enviamos un
              enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y la carpeta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
            </p>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--color-text-muted)]">
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
            <Button type="submit" size="lg" loading={loading} fullWidth className="rounded-full">
              {loading ? "Enviando..." : "Enviar enlace"}
            </Button>
          </form>
        )}
        <Link href="/login" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[var(--color-brand-light)] hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </main>
  );
}

export default function RecuperarPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
