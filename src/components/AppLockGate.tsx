"use client";

import { useEffect, useRef, useState } from "react";
import { Fingerprint, TrendingUp } from "lucide-react";
import { getAppLockConfig, verifyAppLock } from "@/lib/webauthn";
import { cn } from "@/lib/cn";

type Status = "checking" | "locked" | "verifying" | "unlocked";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const autoAttempted = useRef(false);

  useEffect(() => {
    // The lock config only exists in localStorage, which isn't available
    // during SSR, so whether to lock can only be known after mount.
    const config = getAppLockConfig();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(config?.enabled ? "locked" : "unlocked");
  }, []);

  useEffect(() => {
    if (status !== "locked" || autoAttempted.current) return;
    autoAttempted.current = true;
    attemptUnlock(false);
  }, [status]);

  async function attemptUnlock(isManual: boolean) {
    setError(null);
    setStatus("verifying");
    const ok = await verifyAppLock();
    if (ok) {
      setStatus("unlocked");
      return;
    }
    setStatus("locked");
    // The automatic attempt fires the instant the screen appears — if the
    // browser blocks it or there's no prior gesture, fail silently and let
    // the user tap. Only surface an error after a real, manual try.
    if (isManual) {
      setError("No se pudo verificar. Toca de nuevo para intentarlo.");
    }
  }

  if (status === "checking") {
    return null;
  }

  if (status === "locked" || status === "verifying") {
    const verifying = status === "verifying";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 anim-fade-in">
        <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
          <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight">Finanzas está bloqueada</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-[var(--color-text-muted)]">
          {verifying ? "Confirmando tu identidad…" : "Toca el ícono y usa tu huella o Face ID."}
        </p>

        <button
          type="button"
          onClick={() => attemptUnlock(true)}
          disabled={verifying}
          aria-label="Desbloquear con huella o Face ID"
          className="relative mt-9 flex h-20 w-20 items-center justify-center"
        >
          {!verifying ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-brand)]/30" />
            </>
          ) : null}
          <span
            className={cn(
              "gradient-brand relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(138,5,190,0.45)] transition-transform",
              verifying ? "animate-pulse" : "active:scale-[0.95]"
            )}
          >
            <Fingerprint size={28} />
          </span>
        </button>

        {error ? (
          <p className="mt-4 max-w-xs text-center text-sm text-[var(--color-expense)] anim-slide-down">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return <div className="anim-fade-in">{children}</div>;
}
