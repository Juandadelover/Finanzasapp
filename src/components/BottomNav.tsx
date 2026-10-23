"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, HandCoins, BarChart3, Settings, ShoppingCart } from "lucide-react";
import { ADMIN_CONSOLE_NAV, isActivePath } from "@/components/nav";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { SPRINGS, createSpring, useReducedMotion, type Spring } from "@/components/ui/motion";

const TENANT_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: Wallet },
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/cartera", label: "Cartera", icon: HandCoins },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isPlatformAdmin, permissions } = useFinance();
  const NAV_ITEMS = isPlatformAdmin
    ? ADMIN_CONSOLE_NAV
    : TENANT_ITEMS.filter(({ href }) => href !== "/vender" || permissions.canSell);
  const reduced = useReducedMotion();
  const pill = useRef<HTMLSpanElement>(null);
  const spring = useRef<Spring | null>(null);
  const activeIndex = NAV_ITEMS.findIndex(({ href }) => isActivePath(pathname, href));

  // El indicador activo se desliza con un resorte (item 56px + gap 2px = 58px).
  useLayoutEffect(() => {
    const el = pill.current;
    if (!el) return;
    el.style.opacity = activeIndex < 0 ? "0" : "1";
    if (activeIndex < 0) return;
    if (!spring.current) {
      spring.current = createSpring(activeIndex, (v) => {
        el.style.transform = `translateX(${v * 58}px)`;
      });
      spring.current.set(activeIndex);
    } else if (reduced) {
      spring.current.set(activeIndex);
    } else {
      spring.current.to(activeIndex, SPRINGS.ui);
    }
  }, [activeIndex, reduced]);

  return (
    <nav aria-label="Principal" className="fixed bottom-0 left-0 right-0 z-(--z-nav) flex justify-center lg:hidden px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
      <div className="material relative flex items-center gap-0.5 rounded-full px-1.5 py-2">
        <span
          ref={pill}
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-2 h-12 w-14 rounded-full bg-[var(--color-surface-3)] transition-opacity duration-(--duration-fast)"
        />
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              title={label}
              className={cn(
                "relative flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition duration-(--duration-fast) active:scale-[0.95] active:duration-(--duration-instant)",
                isActive
                  ? "text-[var(--color-brand-light)]"
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
