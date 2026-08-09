import { FinanceProvider } from "@/context/FinanceContext";
import { UIProvider } from "@/context/UIContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { AppShell } from "@/components/AppShell";
import { AppLockGate } from "@/components/AppLockGate";
import { Toaster } from "@/components/Toaster";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <UIProvider>
        <PrivacyProvider>
          <AppLockGate>
            <AppShell>{children}</AppShell>
          </AppLockGate>
          <Toaster />
        </PrivacyProvider>
      </UIProvider>
    </FinanceProvider>
  );
}
