"use client";

import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NewTransactionButton } from "@/components/NewTransactionButton";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { usePrivacy } from "@/context/PrivacyContext";

/**
 * Mobile: logo + workspace switcher + privacy toggle (+ `actions`). Desktop (lg+): those live in the Sidebar,
 * so this becomes a slim sticky bar (--app-header-h) with `actions` and the "Nuevo movimiento" button on the right.
 * The page title is NOT here: keep using <PageHeader> (it is the page's h1).
 */
interface AppHeaderProps {
  actions?: ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { hidden, toggleHidden } = usePrivacy();
  // Material solo cuando el contenido pasa por debajo (borde de scroll).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header data-scrolled={scrolled} className="app-header -mb-2 flex items-center justify-between px-4 pb-2 pt-4 lg:mb-0 lg:h-(--app-header-h) lg:justify-end lg:py-0">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <div className="gradient-brand flex h-10 w-10 items-center justify-center shrink-0 rounded-2xl shadow-[var(--shadow-brand-sm)]">
          <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.95] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] lg:hidden"
        >
          {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        <div className="hidden lg:block">
          <NewTransactionButton />
        </div>
      </div>
    </header>
  );
}
