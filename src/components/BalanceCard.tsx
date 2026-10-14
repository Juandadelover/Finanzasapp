"use client";

import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import type { CurrencyCode } from "@/types/finance";

interface BalanceCardProps {
  balance: number;
  income: number;
  expense: number;
  currency: CurrencyCode;
}

export function BalanceCard({ balance, income, expense, currency }: BalanceCardProps) {
  const { hidden } = usePrivacy();
  const balanceText = hidden ? MASKED_AMOUNT : formatAmount(balance, currency);
  const availablePct = income > 0 ? Math.max(0, Math.min(100, Math.round((balance / income) * 100))) : 0;

  return (
    <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[var(--shadow-brand-lg)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/85">Balance Disponible</span>
        <Link
          href="/cuentas"
          className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-xs font-medium text-white/85 hover:text-white"
        >
          Cuentas
          <ChevronRight size={16} />
        </Link>
      </div>
      <p
        className={`tabular mt-2 break-words font-bold tracking-tight ${balanceText.length > 14 ? "text-2xl" : balanceText.length > 11 ? "text-3xl" : "text-4xl"}`}
      >
        {balanceText}
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-medium text-white/85">
          <span className="uppercase tracking-wide">Disponible</span>
          <span>{availablePct}%</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-white/20" role="progressbar" aria-label="Disponible" aria-valuemin={0} aria-valuemax={100} aria-valuenow={availablePct}>
          <div
            className="h-2 rounded-full bg-white transition-all"
            style={{ width: `${availablePct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/85">
            <TrendingUp size={14} />
            Ingresos
          </div>
          <p className="tabular mt-1 truncate text-lg font-semibold">
            {hidden ? MASKED_AMOUNT : formatAmount(income, currency, { signed: true })}
          </p>
        </div>
        <div className="min-w-0 rounded-2xl bg-black/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/85">
            <TrendingDown size={14} />
            Gastos
          </div>
          <p className="tabular mt-1 truncate text-lg font-semibold">
            {hidden ? MASKED_AMOUNT : `-${formatAmount(expense, currency)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
