import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { LEGAL_DOCS } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[65ch] items-center justify-between px-5 pt-5">
        <Link href="/login" className="flex items-center gap-2 text-sm font-semibold">
          <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-xl">
            <TrendingUp size={16} className="text-white" strokeWidth={2.5} />
          </span>
          Finanzas
        </Link>
        <Link href="/precios" className="text-xs font-medium text-[var(--color-brand-light)]">
          Precios
        </Link>
      </header>
      <main className="mx-auto max-w-[65ch] px-5 pb-16 pt-6">{children}</main>
      <footer className="mx-auto max-w-[65ch] border-t border-[var(--color-border)] px-5 py-6">
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} href={`/legal/${d.slug}`} className="hover:text-[var(--color-text)]">
              {d.title}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
