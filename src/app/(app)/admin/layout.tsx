"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { checkIsAdmin } from "@/lib/admin";

const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/configuracion", label: "Configuración" },
];

// The app shell is a 512px column; admin screens (tables) break out of it on wide viewports.
// AppShell ya ensancha /admin; se conserva la constante para no tocar el marcado.
const WIDE = "w-full";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "yes" | "no">("loading");

  useEffect(() => {
    let alive = true;
    checkIsAdmin().then((ok) => {
      if (alive) setState(ok ? "yes" : "no");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="pb-8">
        <AppHeader />
        <PageHeader title="Administración" backHref="/ajustes" backLabel="Ajustes" />
        <div role="status" className="mx-4 mt-4 flex flex-col gap-3">
          <span className="sr-only">Verificando acceso...</span>
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state === "no") {
    return (
      <div className="pb-8">
        <AppHeader />
        <div className="mx-4 mt-10 flex flex-col items-center gap-2 text-center">
          <ShieldAlert size={32} className="text-[var(--color-text-muted)]" aria-hidden />
          <h1 className="text-base font-semibold">No tienes acceso</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Esta sección es solo para administradores de la plataforma.
          </p>
          <Link href="/ajustes" className={buttonClass({ variant: "secondary", className: "mt-3" })}>
            Volver a Ajustes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <AppHeader />
      <div className={WIDE}>
        <PageHeader
          title="Administración"
          subtitle="Pagos, clientes y configuración de la plataforma"
          backHref="/ajustes"
          backLabel="Ajustes"
          className="mx-0"
        />
        <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Secciones de administración">
          {TABS.map((t) => {
            const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition active:scale-[0.97]",
                  active
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
