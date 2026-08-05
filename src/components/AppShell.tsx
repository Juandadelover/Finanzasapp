"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { TransactionModal } from "@/components/TransactionModal";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col pb-28">
      {children}
      <FloatingActionButton />
      <BottomNav />
      <TransactionModal />
    </div>
  );
}
