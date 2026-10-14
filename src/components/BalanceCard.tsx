"use client";

import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import type { CurrencyCode } from "@/types/finance";

interface BalanceCardProps {
  /** Saldo real sumando las cuentas (null si el negocio aún no tiene cuentas). */
  accountsTotal: number | null;
  /** Ingresos − gastos pagados del mes seleccionado. */
  monthResult: number;
  income: number;
  expense: number;
  currency: CurrencyCode;
}

export function BalanceCard({ accountsTotal, monthResult, income, expense, currency }: BalanceCardProps) {
  const { hidden } = usePrivacy();
  // La cifra grande es la plata que hay de verdad; sin cuentas, el resultado del mes.
  const headline = accountsTotal ?? monthResult;
  const balanceText = hidden ? MASKED_AMOUNT : formatAmount(headline, currency);

  return (
    <div className="gradient-brand mx-4 mt-4 rounded-3xl p-5 text-white shadow-[var(--shadow-brand-lg)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/85">
          {accountsTotal !== null ? "Saldo en cuentas" : "Resultado del mes"}
        </span>
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

      {accountsTotal !== null ? (
        <p className="mt-1 text-sm text-white/85">
          {monthResult >= 0 ? "Ganancia" : "Pérdida"} del mes:{" "}
          <span className="tabular font-semibold text-white">
            {hidden ? MASKED_AMOUNT : formatAmount(monthResult, currency, { signed: true })}
          </span>
        </p>
      ) : null}

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
            {hidden ? MASKED_AMOUNT : formatAmount(-expense, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
