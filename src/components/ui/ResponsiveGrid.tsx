import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * ResponsiveGrid: mobile layouts stay exactly as they are; columns only appear from lg (1024px).
 * Variants (children are plain elements; add your own `mx-4` gutter on mobile):
 *   "stats"  2 cols on mobile -> 4 from lg           (StatTile rows)
 *   "cards"  1 col on mobile  -> 2 from lg, 3 from xl (independent cards / lists)
 *   "split"  1 col on mobile  -> main (2fr) + aside (1fr) from lg. Put the main block first.
 *   "pair"   1 col on mobile  -> 2 equal cols from lg  (e.g. two charts)
 * Plain class equivalents (use when a component is overkill):
 *   stats: "grid grid-cols-2 gap-3 lg:grid-cols-4"
 *   split: "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
 * Use `lg:col-span-full` for a child that must span every column. Always `minmax(0, ...)` so tables/charts can shrink.
 */
const VARIANTS = {
  stats: "grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4",
  cards: "grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4 xl:grid-cols-3",
  split: "grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6",
  pair: "grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4",
} as const;

interface ResponsiveGridProps {
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: ReactNode;
}

export function ResponsiveGrid({ variant = "cards", className, children }: ResponsiveGridProps) {
  return <div className={cn("grid", VARIANTS[variant], className)}>{children}</div>;
}
