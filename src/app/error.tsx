"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui/buttonStyles";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Sentry hook point: if NEXT_PUBLIC_SENTRY_DSN is set, report `error` here.
    console.error("[root error]", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto mt-16 flex max-w-md flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-expense)]">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">Algo salió mal</p>
      <p className="max-w-xs text-xs text-[var(--color-text-faint)]">
        No pudimos cargar esta pantalla. Tus datos no se han modificado.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass({ size: "sm" })}>
          Reintentar
        </button>
        <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>
          Ir a Inicio
        </Link>
      </div>
    </div>
  );
}
