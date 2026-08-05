import { FinanceProvider } from "@/context/FinanceContext";
import { UIProvider } from "@/context/UIContext";
import { AppShell } from "@/components/AppShell";
import { AppLockGate } from "@/components/AppLockGate";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <UIProvider>
        <AppLockGate>
          <AppShell>{children}</AppShell>
        </AppLockGate>
      </UIProvider>
    </FinanceProvider>
  );
}
