import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ChartCardProps {
  icon: LucideIcon;
  accent: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ icon: Icon, accent, title, subtitle, action, footer, children }: ChartCardProps) {
  return (
    <section className="mx-4 mt-4 rounded-3xl lg:mx-0 lg:mt-0 lg:min-w-0 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 15%, transparent)`, color: accent }}
          >
            <Icon size={15} />
          </span>
          <div>
            <h2 className="text-sm font-semibold leading-tight">{title}</h2>
            {subtitle ? <p className="text-xs text-[var(--color-text-faint)]">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
      {footer}
    </section>
  );
}
