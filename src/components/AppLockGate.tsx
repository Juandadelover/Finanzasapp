"use client";

import { useEffect, useState } from "react";
import { Fingerprint, TrendingUp } from "lucide-react";
import { getAppLockConfig, verifyAppLock } from "@/lib/webauthn";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The lock config only exists in localStorage, which isn't available
    // during SSR, so whether to lock can only be known after mount.
    const config = getAppLockConfig();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(config?.enabled ? "locked" : "unlocked");
  }, []);

  async function handleUnlock() {
    setError(null);
    const ok = await verifyAppLock();
    if (ok) {
      setStatus("unlocked");
    } else {
      setError("No se pudo verificar tu huella o Face ID. Intenta de nuevo.");
    }
  }

  if (status === "checking") {
    return null;
  }

  if (status === "locked") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="gradient-brand flex h-16 w-16 items-center justify-center rounded-3xl shadow-[0_8px_24px_rgba(138,5,190,0.4)]">
          <TrendingUp size={30} className="text-white" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight">Finanzas está bloqueada</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-[var(--color-text-muted)]">
          Desbloquea con tu huella o Face ID para continuar.
        </p>

        <button
          type="button"
          onClick={handleUnlock}
          className="gradient-brand mt-8 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(138,5,190,0.4)] transition active:scale-95"
          aria-label="Desbloquear"
        >
          <Fingerprint size={28} />
        </button>

        {error ? <p className="mt-4 text-sm text-[var(--color-expense)]">{error}</p> : null}
      </div>
    );
  }

  return <>{children}</>;
}
