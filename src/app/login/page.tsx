"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Desactivado hasta habilitar el proveedor de Google en Supabase Auth.
const GOOGLE_LOGIN_ENABLED = false;

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
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();

  const inputClass =
    "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] disabled:opacity-60";
  const labelClass = "mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]";

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const redirectTo = searchParams.get("redirectTo") ?? "/";

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const invalid =
          error.code === "invalid_credentials" ||
          /invalid login credentials/i.test(error.message);
        setError(
          invalid
            ? "Email o contraseña incorrectos."
            : "No se pudo iniciar sesión. Intenta de nuevo.",
        );
        setLoading(false);
        return;
      }
      window.location.href = redirectTo;
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError("No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.");
      setLoading(false);
      return;
    }
    if (data.session) {
      window.location.href = redirectTo;
      return;
    }
    setInfo("Te enviamos un correo para confirmar tu cuenta.");
    setLoading(false);
  }

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

  async function handleGuestLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: "Invitado" } },
    });
    if (error) {
      setError("No se pudo entrar en modo invitado. Intenta de nuevo.");
      setLoading(false);
      return;
    }
    const redirectTo = searchParams.get("redirectTo") ?? "/";
    window.location.href = redirectTo;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Finanzas</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-[var(--color-text-muted)]">
        Controla el dinero de tu negocio: ingresos, gastos y lo que te deben, en un solo lugar.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
          {(
            [
              ["signin", "Iniciar sesión"],
              ["signup", "Crear cuenta"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              disabled={loading}
              aria-pressed={mode === key}
              className={`rounded-full py-2 text-xs font-semibold transition disabled:opacity-60 ${
                mode === key
                  ? "gradient-brand text-white"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
          {mode === "signup" ? (
            <div>
              <label htmlFor="full_name" className={labelClass}>
                Nombre
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className={inputClass}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="email" className={labelClass}>
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
          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="gradient-brand mt-1 flex items-center justify-center rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition disabled:opacity-60"
          >
            {loading
              ? "Procesando..."
              : mode === "signin"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>

        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        {info ? <p className="text-sm text-[var(--color-text-muted)]">{info}</p> : null}

        <div className="my-1 flex items-center gap-3 text-xs text-[var(--color-text-faint)]">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          o
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        {GOOGLE_LOGIN_ENABLED ? (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)] disabled:opacity-60"
          >
            <GoogleIcon />
            {loading ? "Conectando..." : "Continuar con Google"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-transparent py-3.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)] disabled:opacity-60"
        >
          <User size={17} />
          {loading ? "Entrando..." : "Probar como invitado"}
        </button>
      </div>

      <p className="mt-10 max-w-xs text-center text-[11px] leading-relaxed text-[var(--color-text-faint)]">
        Tus datos financieros se guardan de forma privada en tu cuenta y solo tú puedes acceder a ellos.
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
