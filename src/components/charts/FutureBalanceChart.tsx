"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount } from "@/lib/format";
import type { CurrencyCode } from "@/types/finance";

interface FutureBalanceChartProps {
  data: { day: number; balance: number }[];
  currency: CurrencyCode;
}

export function FutureBalanceChart({ data, currency }: FutureBalanceChartProps) {
  const points = data.map((p) => ({ ...p, label: p.day === 0 ? "Hoy" : `${p.day}d` }));

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ left: -12, right: 8, top: 12 }}>
          <defs>
            <linearGradient id="futureBalanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-light)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-brand-light)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-text-faint)", fontSize: 12 }}
          />
          <YAxis hide domain={["dataMin - 10000", "dataMax + 10000"]} />
          <Tooltip
            formatter={(value) => [formatAmount(Number(value), currency), "Proyección"]}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-text)",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--color-brand-light)"
            strokeWidth={2}
            fill="url(#futureBalanceFill)"
            dot={{ r: 4, fill: "var(--color-brand-light)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
