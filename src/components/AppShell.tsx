"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { Sidebar } from "@/components/Sidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TransactionModal } from "@/components/TransactionModal";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";

/**
 * App shell. Breakpoint strategy (content-driven, no user-agent sniffing):
 * - < lg (1024px): phone column (max-w-lg), BottomNav + FAB. Unchanged.
 * - >= lg: fixed 248px Sidebar, fluid content frame (max-w-6xl, 24px padding), no BottomNav/FAB.
 *   /admin uses the full width. See DESIGN.md > "Desktop layout".
 */
export function AppShell({ children }: { children: ReactNode }) {
  // El panel de administración se usa sobre todo en escritorio: usa todo el ancho.
  const wide = usePathname().startsWith("/admin");
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
          <SubscriptionBanner />
          {children}
          <FloatingActionButton />
          <BottomNav />
          <TransactionModal />
        </div>
      </div>
    </ConfirmProvider>
  );
}
