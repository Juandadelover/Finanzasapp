"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SPRINGS, createSpring, useReducedMotion, type Spring } from "@/components/ui/motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Classes for the sliding indicator behind this option (default: surface). */
  indicatorClass?: string;
  /** Text classes when this option is selected. */
  activeClass?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  shape?: "pill" | "rounded";
  className?: string;
  buttonClassName?: string;
  "aria-label"?: string;
}

/**
 * Segmented control with a spring-driven sliding indicator (equal-width segments).
 * Interruptible: selecting again mid-slide re-targets from the live position.
 * Reduced motion: the indicator jumps (the colour/label change still carries the state).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  shape = "pill",
  className,
  buttonClassName,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const indicator = useRef<HTMLSpanElement>(null);
  const spring = useRef<Spring | null>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];
  const radius = shape === "pill" ? "rounded-full" : "rounded-xl";

  useLayoutEffect(() => {
    const el = indicator.current;
    if (!el) return;
    const paint = (v: number) => {
      el.style.transform = `translateX(${v * 100}%)`;
    };
    if (!spring.current) {
      spring.current = createSpring(index, paint, { restDelta: 0.002, restSpeed: 0.02 });
      spring.current.set(index);
    } else if (reduced) {
      spring.current.set(index);
    } else {
      spring.current.to(index, SPRINGS.ui);
    }
  }, [index, reduced]);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("relative flex bg-[var(--color-surface-2)] p-1", radius, shape === "pill" ? "" : "gap-0", className)}
    >
      <span
        ref={indicator}
        aria-hidden
        style={{ width: `calc((100% - 0.5rem) / ${options.length})` }}
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1",
          radius,
          current?.indicatorClass ?? "bg-[var(--color-surface)] shadow-sm"
        )}
      />
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex min-h-11 flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-[color,transform] duration-150 active:scale-[0.97]",
              radius,
              selected ? (o.activeClass ?? "text-[var(--color-text)]") : "text-[var(--color-text-muted)]",
              buttonClassName
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
