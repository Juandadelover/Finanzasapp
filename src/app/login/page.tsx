"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = searchParams.get("redirectTo") ?? "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError("No se pudo iniciar sesión con Google. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Finanzas</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-[var(--color-text-muted)]">
        Controla tus ingresos y gastos, organizados por categorías, con estadísticas claras.
      </p>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="mt-10 flex w-full max-w-xs items-center justify-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Conectando..." : "Continuar con Google"}
      </button>

      {error ? <p className="mt-4 text-sm text-[var(--color-expense)]">{error}</p> : null}

      <p className="mt-10 max-w-xs text-center text-[11px] leading-relaxed text-[var(--color-text-faint)]">
        Tus datos financieros se guardan de forma privada en tu cuenta y solo tú puedes acceder a
        ellos.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
