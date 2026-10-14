import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  deltaPct: number | null;
  goodDirection?: "up" | "down";
}

export function StatTile({ label, value, icon: Icon, accent, deltaPct, goodDirection = "up" }: StatTileProps) {
  const isPositive = (deltaPct ?? 0) >= 0;
  const isGood = goodDirection === "up" ? isPositive : !isPositive;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 15%, transparent)`, color: accent }}
      >
        <Icon size={15} />
      </span>
      <div>
        <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
        <p title={value} className="tabular mt-0.5 truncate text-lg font-semibold text-[var(--color-text)]">{value}</p>
      </div>
      {deltaPct === null ? (
        <span className="text-xs font-medium text-[var(--color-text-faint)]">Sin datos el mes pasado</span>
      ) : (
        <span
          className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            isGood ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
          )}
        >
          {deltaPct === 0 ? <Minus size={11} /> : deltaPct > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {Math.abs(deltaPct).toFixed(0)}% vs. mes anterior
        </span>
      )}
    </div>
  );
}
