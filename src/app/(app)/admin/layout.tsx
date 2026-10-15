"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { checkIsAdmin } from "@/lib/admin";

const SECTIONS: Record<string, { title: string; subtitle: string }> = {
  "/admin": { title: "Resumen", subtitle: "Cómo va la plataforma hoy" },
  "/admin/pagos": { title: "Pagos", subtitle: "Revisa y aprueba los comprobantes" },
  "/admin/clientes": { title: "Clientes", subtitle: "Planes, suscripciones y negocios" },
  "/admin/ingresos": { title: "Ingresos", subtitle: "Pagos aprobados, altas y conversión" },
  "/admin/configuracion": { title: "Configuración", subtitle: "Planes, medios de pago y auditoría" },
};

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
        <PageHeader title="Administración" />
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

  const section = SECTIONS[pathname.replace(/\/$/, "")];

  return (
    <div className="pb-8">
      <AppHeader />
      <div className="w-full">
        {section ? <PageHeader title={section.title} subtitle={section.subtitle} className="mx-4 lg:mx-0 lg:mt-8" /> : null}
        <div className="mx-4 mt-4 lg:mx-0 lg:mt-6">{children}</div>
      </div>
    </div>
  );
}
