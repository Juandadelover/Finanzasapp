"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, TrendingUp } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { ADMIN_CONSOLE_NAV, PRIMARY_NAV, SECONDARY_NAV, isActivePath, type NavItem } from "@/components/nav";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";

/**
 * Desktop sidebar (>= lg, 1024px). Hidden below lg, where BottomNav takes over.
 * Fixed 248px (`--sidebar-w`); AppShell offsets the content by the same amount.
 */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, isPlatformAdmin, adminResolved, signOut } = useFinance();
  const confirm = useConfirm();
  const secondary = SECONDARY_NAV;
  const pending = !adminResolved;

  async function handleSignOut() {
    const ok = await confirm({
      title: "¿Cerrar sesión?",
      description: isPlatformAdmin
        ? "Saldrás de la consola de administración."
        : "Volverás a la pantalla de inicio de sesión en este dispositivo.",
      confirmLabel: "Cerrar sesión",
    });
    if (ok) await signOut();
  }
  const displayName = user?.name || user?.email || "Mi cuenta";
  const accountActive = isActivePath(pathname, "/cuenta");

  return (
    <aside
      aria-label="Barra lateral"
      className="fixed inset-y-0 left-0 z-(--z-nav) hidden w-(--sidebar-w) flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex"
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <div className="gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-brand-sm)]">
          <TrendingUp size={20} className="text-white" strokeWidth={2.5} aria-hidden />
        </div>
        <span className="text-lg font-bold tracking-tight">Finanzas</span>
      </div>

      {pending ? (
        <div role="status" className="flex flex-1 flex-col gap-2 px-3 py-4">
          <span className="sr-only">Cargando menú...</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : isPlatformAdmin ? (
        <>
          <div className="px-5 pb-2">
            <span className="inline-flex items-center rounded-full bg-[var(--color-brand)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-light)]">
              Administración
            </span>
          </div>
          <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
            <ul className="flex flex-col gap-0.5">
              {ADMIN_CONSOLE_NAV.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : (
        <>
          <div className="px-3 pb-2">
            <WorkspaceSwitcher variant="sidebar" />
          </div>

          <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-3">
            <ul className="flex flex-col gap-0.5">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-0.5 border-t border-[var(--color-border)] pt-4" aria-label="Más secciones">
              {secondary.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}

      <div className="flex items-center gap-1 border-t border-[var(--color-border)] p-3">
        <Link
          href="/cuenta"
          aria-current={accountActive ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-[var(--color-surface-2)]",
            accountActive && "bg-[var(--color-surface-3)]"
          )}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/15 text-sm font-semibold uppercase text-[var(--color-brand-light)]"
          >
            {displayName.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{displayName}</span>
            <span className="block text-xs text-[var(--color-text-faint)]">Mi cuenta</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-expense)]/10 hover:text-[var(--color-expense)] active:scale-[0.95]"
        >
          <LogOut size={19} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
