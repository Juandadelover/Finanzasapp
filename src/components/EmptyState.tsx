import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-faint)]">
        <Icon size={22} />
      </span>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
      {description ? <p className="text-xs text-[var(--color-text-faint)]">{description}</p> : null}
    </div>
  );
}
