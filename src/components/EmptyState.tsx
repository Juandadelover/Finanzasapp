import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/buttonStyles";

/**
 * Empty / error state with an optional next action.
 * - icon, title (required), description?
 * - action?: { label, href } renders a link button, or { label, onClick }
 * - tone: "empty" (default) | "error" (red icon, role="alert")
 */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  tone?: "empty" | "error";
}

export function EmptyState({ icon: Icon, title, description, action, tone = "empty" }: EmptyStateProps) {
  const cls = buttonClass({ variant: "secondary", size: "sm", className: "mt-2" });
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] ${
          tone === "error" ? "text-[var(--color-expense)]" : "text-[var(--color-text-faint)]"
        }`}
      >
        <Icon size={22} aria-hidden />
      </span>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
      {description ? <p className="max-w-xs text-xs text-[var(--color-text-faint)]">{description}</p> : null}
      {action ? (
        action.href ? (
          <Link href={action.href} className={cls}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={cls}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
