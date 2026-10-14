"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TransactionModal } from "@/components/TransactionModal";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ConfirmProvider>
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col pb-28">
      <SubscriptionBanner />
      {children}
      <FloatingActionButton />
      <BottomNav />
      <TransactionModal />
    </div>
    </ConfirmProvider>
  );
}
