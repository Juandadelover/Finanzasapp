"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, TrendingUp, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/lib/legal";

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
  const searchParams = useSearchParams();
  const invited = searchParams.get("invitado") === "1";
  const [mode, setMode] = useState<"signin" | "signup">(
    invited || searchParams.get("modo") === "registro" ? "signup" : "signin",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputClass =
    "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-base text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:opacity-60";
  const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-muted)]";

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

    if (mode === "signup" && !accepted) {
      setError("Para crear tu cuenta, acepta los Términos y la Política de tratamiento de datos.");
      setLoading(false);
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const invalid =
          error.code === "invalid_credentials" ||
          /invalid login credentials/i.test(error.message);
        setError(
          invalid
            ? "El email o la contraseña no coinciden. Revisa e intenta de nuevo, o recupera tu contraseña."
            : "No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.",
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
        data: {
          full_name: fullName.trim(),
          terms_version: TERMS_VERSION,
          ...(invited ? { invited: true } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError(
        "No se pudo crear la cuenta. Si ya tienes una, inicia sesión; si no, revisa los datos e intenta de nuevo.",
      );
      setLoading(false);
      return;
    }
    if (data.session) {
      window.location.href = redirectTo;
      return;
    }
    setInfo(`Te enviamos un correo a ${email.trim()} para confirmar tu cuenta. Ábrelo y toca el enlace para entrar. Si no lo ves, revisa spam.`);
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
        <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Finanzas</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-[var(--color-text-muted)]">
        Controla el dinero de tu negocio: ingresos, gastos y lo que te deben, en un solo lugar.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        {invited ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-center text-xs text-[var(--color-text-muted)]">
            Te invitaron a un negocio. Crea tu cuenta con el mismo correo de la invitación.
          </p>
        ) : null}
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
              className={`min-h-11 rounded-full py-2 text-sm font-semibold transition disabled:opacity-60 ${
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
                aria-required="true"
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-describedby={mode === "signup" ? "password-hint" : undefined}
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-xl text-[var(--color-text-muted)]"
              >
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            {mode === "signup" ? (
              <p id="password-hint" className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                Mínimo 8 caracteres.
              </p>
            ) : null}
          </div>
          {mode === "signin" ? (
            <Link
              href={`/recuperar${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="-mt-1 inline-flex min-h-11 items-center self-end text-sm font-medium text-[var(--color-brand-light)] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          ) : (
            <label className="flex items-start gap-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                required
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                disabled={loading}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                Acepto los{" "}
                <Link href="/legal/terminos" target="_blank" className="font-medium text-[var(--color-brand-light)] underline">
                  Términos
                </Link>{" "}
                y la{" "}
                <Link href="/legal/privacidad" target="_blank" className="font-medium text-[var(--color-brand-light)] underline">
                  Política de tratamiento de datos
                </Link>
              </span>
            </label>
          )}
          <Button type="submit" size="lg" loading={loading} fullWidth className="mt-1 rounded-full">
            {loading
              ? mode === "signin"
                ? "Iniciando sesión..."
                : "Creando tu cuenta..."
              : mode === "signin"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </Button>
        </form>

        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-expense)]">
              {error}
            </p>
          ) : null}
          {info ? (
            <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)]">
              {info}
            </p>
          ) : null}
        </div>

        <div aria-hidden className="my-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          o
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        {GOOGLE_LOGIN_ENABLED ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="rounded-full"
          >
            <GoogleIcon />
            {loading ? "Conectando..." : "Continuar con Google"}
          </Button>
        ) : null}

        <Button
          variant="secondary"
          size="lg"
          onClick={handleGuestLogin}
          disabled={loading}
          className="rounded-full"
        >
          <User size={17} aria-hidden />
          {loading ? "Entrando..." : "Probar como invitado"}
        </Button>
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          El modo invitado no necesita correo. Es para conocer la app con datos de prueba.
        </p>
      </div>

      <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
        Tus datos financieros se guardan de forma privada en tu cuenta y solo tú puedes acceder a ellos.
      </p>
      <nav aria-label="Información" className="mt-2 flex max-w-xs flex-wrap justify-center gap-x-1 text-xs text-[var(--color-text-muted)]">
        {[
          ["/precios", "Precios"],
          ["/legal/terminos", "Términos"],
          ["/legal/privacidad", "Privacidad"],
          ["/legal/reembolsos", "Reembolsos"],
          ["/legal/aviso", "Aviso"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center px-2 hover:underline">
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
