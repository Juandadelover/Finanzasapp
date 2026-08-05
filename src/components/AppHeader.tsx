import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface AppHeaderProps {
  actions?: ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 pt-4">
      <div className="flex items-center gap-3">
        <div className="gradient-brand flex h-10 w-10 items-center justify-center rounded-2xl shadow-[0_4px_16px_rgba(18,184,134,0.35)]">
          <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-semibold tracking-tight">Finanzas</span>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
