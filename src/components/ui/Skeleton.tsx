import { cn } from "@/lib/cn";

/**
 * Pulsing placeholder block. Size it with className (e.g. "h-16 rounded-2xl", "h-4 w-1/2").
 * Decorative: hidden from assistive tech; wrap a group in role="status" + a sr-only "Cargando" if needed.
 * <SkeletonList count={4} /> renders list-row placeholders.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-[var(--color-surface-2)] motion-reduce:animate-none", className)}
    />
  );
}

export function SkeletonList({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col gap-1", className)}>
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[68px] rounded-2xl" />
      ))}
    </div>
  );
}
