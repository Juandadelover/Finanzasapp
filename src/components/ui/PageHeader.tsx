import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Consistent page title row (the single h1 of a screen). Place under <AppHeader />.
 * - title: h1, text-xl font-bold, truncates
 * - subtitle: optional one-line muted text
 * - backHref / backLabel: optional back link above the title (44px target)
 * - actions: optional right-aligned slot
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, backHref, backLabel = "Volver", actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mx-4 mt-4", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
        >
          <ChevronLeft size={18} aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold leading-snug">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
