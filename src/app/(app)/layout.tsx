import { FinanceProvider } from "@/context/FinanceContext";
import { UIProvider } from "@/context/UIContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { AppShell } from "@/components/AppShell";
import { AppLockGate } from "@/components/AppLockGate";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <UIProvider>
        <PrivacyProvider>
          <AppLockGate>
            <AppShell>{children}</AppShell>
          </AppLockGate>
        </PrivacyProvider>
      </UIProvider>
    </FinanceProvider>
  );
}
