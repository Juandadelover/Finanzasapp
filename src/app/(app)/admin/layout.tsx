"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { cn } from "@/lib/cn";
import { checkIsAdmin } from "@/lib/admin";

const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/configuracion", label: "Configuración" },
];

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
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </div>
    );
  }

  if (state === "no") {
    return (
      <div className="pb-8">
        <AppHeader />
        <div className="mx-4 mt-10 flex flex-col items-center gap-2 text-center">
          <ShieldAlert size={32} className="text-[var(--color-text-faint)]" />
          <p className="text-base font-semibold">No tienes acceso</p>
          <p className="text-sm text-[var(--color-text-muted)]">Esta sección es solo para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <AppHeader />
      <nav className="mt-4 flex gap-2 overflow-x-auto px-4" aria-label="Administración">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                active
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 px-4">{children}</div>
    </div>
  );
}
