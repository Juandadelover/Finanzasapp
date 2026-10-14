"use client";

import { Eye, EyeOff, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { usePrivacy } from "@/context/PrivacyContext";

interface AppHeaderProps {
  actions?: ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { hidden, toggleHidden } = usePrivacy();

  return (
    <header className="flex items-center justify-between px-4 pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="gradient-brand flex h-10 w-10 items-center justify-center shrink-0 rounded-2xl shadow-[0_4px_16px_rgba(138,5,190,0.35)]">
          <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
          className="rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
