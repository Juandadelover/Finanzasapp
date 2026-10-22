import Link from "next/link";
import { ChevronRight, PackageX } from "lucide-react";
import type { Product } from "@/types/inventory";

/** Aviso en Inicio: productos activos con stock en o bajo el mínimo. No se muestra si no hay. */
export function LowStockCard({ products }: { products: Product[] }) {
  const low = products.filter((p) => p.active && p.stock <= p.min_stock);
  if (low.length === 0) return null;
  const out = low.filter((p) => p.stock <= 0).length;
  const preview = low.slice(0, 3);
  return (
    <Link
      href="/inventario"
      className="mx-4 mt-3 block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition active:scale-[0.99] hover:bg-[var(--color-surface-2)] lg:mx-0"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
          <PackageX size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {low.length === 1 ? "1 producto con stock bajo" : `${low.length} productos con stock bajo`}
          </span>
          <span className="block truncate text-xs text-[var(--color-text-muted)]">
            {preview.map((p) => p.name).join(", ")}
            {low.length > preview.length ? "…" : ""}
            {out > 0 ? ` · ${out} agotado${out === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-[var(--color-text-faint)]" aria-hidden />
      </div>
    </Link>
  );
}
