"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { isTenantPath } from "@/components/nav";
import { Sidebar } from "@/components/Sidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TransactionModal } from "@/components/TransactionModal";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";

/**
 * App shell. Breakpoint strategy (content-driven, no user-agent sniffing):
 * - < lg (1024px): phone column (max-w-lg), BottomNav + FAB. Unchanged.
 * - >= lg: fixed 248px Sidebar, fluid content frame (max-w-6xl, 24px padding), no BottomNav/FAB.
 *   /admin uses the full width. See DESIGN.md > "Desktop layout".
 */
export function AppShell({ children }: { children: ReactNode }) {
  // El panel de administración se usa sobre todo en escritorio: usa todo el ancho.
  const pathname = usePathname();
  const router = useRouter();
  const { isPlatformAdmin, adminResolved } = useFinance();
  const wide = pathname.startsWith("/admin");
  // El admin de la plataforma no usa la app de clientes: sus rutas lo llevan a la consola.
  const tenantRoute = isTenantPath(pathname);
  const redirecting = tenantRoute && isPlatformAdmin;
  const holding = tenantRoute && (!adminResolved || isPlatformAdmin);
  useEffect(() => {
    if (redirecting) router.replace("/admin");
  }, [redirecting, router]);
  const showTenantChrome = adminResolved && !isPlatformAdmin;
  return (
    <ConfirmProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-toast) focus:rounded-xl focus:bg-[var(--color-surface-elevated)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="lg:pl-(--sidebar-w)">
        <div
          id="contenido"
          className={cn(
            "mx-auto flex min-h-screen w-full max-w-lg flex-col pb-28 lg:px-6 lg:pb-12",
            wide ? "lg:max-w-none" : "lg:max-w-6xl"
          )}
        >
          {showTenantChrome ? <SubscriptionBanner /> : null}
          {holding ? (
            <div role="status" className="mx-4 mt-6 flex flex-col gap-3 lg:mx-0">
              <span className="sr-only">Cargando...</span>
              <Skeleton className="h-8 w-48 rounded-xl" />
              <Skeleton className="h-32 rounded-3xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : (
            children
          )}
          {showTenantChrome ? <FloatingActionButton /> : null}
          {adminResolved ? <BottomNav /> : null}
          {showTenantChrome ? <TransactionModal /> : null}
        </div>
      </div>
    </ConfirmProvider>
  );
}
