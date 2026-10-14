"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Text that settles in when it changes (balance, totals). The new value is in the DOM from the first
 * frame, so reading is never delayed; only a 200ms fade/rise is layered on top. No animation on mount.
 * Reduced motion drops the animation (see .number-swap in globals.css).
 */
export function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const [state, setState] = useState({ prev: value, tick: 0 });
  if (state.prev !== value) setState({ prev: value, tick: state.tick + 1 });
  return (
    <span key={state.tick} className={cn(state.tick > 0 && "number-swap", className)}>
      {value}
    </span>
  );
}
