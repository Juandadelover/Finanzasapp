"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

/**
 * Shared button.
 * - variant: "primary" (brand gradient, default) | "secondary" (bordered) | "ghost" | "danger" (red text, bordered)
 * - size: "md" (min 44px, default) | "lg" (min 48px) | "sm" (min 44px tall touch target, compact text)
 * - loading: shows spinner, disables the button, sets aria-busy
 * - fullWidth: w-full
 * Defaults to type="button". For a link look use <Link className={buttonClass({...})}>.
 */
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/buttonStyles";

export { buttonClass, type ButtonSize, type ButtonVariant };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, fullWidth, className, disabled, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {children}
    </button>
  );
});
