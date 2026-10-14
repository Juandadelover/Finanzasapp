"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TransactionModal } from "@/components/TransactionModal";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export function AppShell({ children }: { children: ReactNode }) {
  // El panel de administración se usa sobre todo en escritorio: usa todo el ancho.
  const wide = usePathname().startsWith("/admin");
  return (
    <ConfirmProvider>
    <div className={`mx-auto flex min-h-screen w-full flex-col pb-28 ${wide ? "max-w-6xl" : "max-w-lg"}`}>
      <SubscriptionBanner />
      {children}
      <FloatingActionButton />
      <BottomNav />
      <TransactionModal />
    </div>
    </ConfirmProvider>
  );
}
