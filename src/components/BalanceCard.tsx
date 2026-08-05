import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { CurrencyCode } from "@/types/finance";

interface BalanceCardProps {
  balance: number;
  income: number;
  expense: number;
  currency: CurrencyCode;
}

export function BalanceCard({ balance, income, expense, currency }: BalanceCardProps) {
  const availablePct = income > 0 ? Math.max(0, Math.min(100, Math.round((balance / income) * 100))) : 0;

  return (
    <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">Balance Disponible</span>
        <HelpCircle size={18} className="text-white/60" />
      </div>
      <p className="mt-2 text-4xl font-bold tracking-tight">{formatAmount(balance, currency)}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-medium text-white/70">
          <span className="uppercase tracking-wide">Disponible</span>
          <span>{availablePct}%</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-white/20">
          <div
            className="h-2 rounded-full bg-white transition-all"
            style={{ width: `${availablePct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/70">
            <TrendingUp size={14} />
            Ingresos
          </div>
          <p className="mt-1 text-lg font-semibold">{formatAmount(income, currency, { signed: true })}</p>
        </div>
        <div className="rounded-2xl bg-black/10 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/70">
            <TrendingDown size={14} />
            Gastos
          </div>
          <p className="mt-1 text-lg font-semibold">-{formatAmount(expense, currency)}</p>
        </div>
      </div>
    </div>
  );
}
