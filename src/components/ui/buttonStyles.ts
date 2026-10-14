// Clases de botón sin "use client": las usan también componentes de servidor
// (p. ej. not-found.tsx a través de EmptyState) para estilizar enlaces.
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "gradient-brand text-white shadow-[var(--shadow-brand-md)]",
  secondary:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
  ghost:
    "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
  danger:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-expense)] hover:bg-[var(--color-surface-2)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-xs",
  md: "min-h-11 px-4 py-3 text-sm",
  lg: "min-h-12 px-5 py-3.5 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 ease-out",
    // Feedback on press-down, not on release.
    "active:scale-[0.97] active:duration-75",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-light)]",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className
  );
}

