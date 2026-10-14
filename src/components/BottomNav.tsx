"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, HandCoins, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: Wallet },
  { href: "/cartera", label: "Cartera", icon: HandCoins },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
      <div className="flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/95 px-1.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors",
                isActive
                  ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]"
                  : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
