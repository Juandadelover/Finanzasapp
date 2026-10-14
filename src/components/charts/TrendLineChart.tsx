"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatAmount } from "@/lib/format";
import type { CurrencyCode } from "@/types/finance";

interface TrendPoint {
  label: string;
  expense: number;
}

interface TrendLineChartProps {
  data: TrendPoint[];
  currency: CurrencyCode;
}

export function TrendLineChart({ data, currency }: TrendLineChartProps) {
  return (
    <div className="h-52 w-full" role="img" aria-label="Tendencia de gastos de los últimos meses">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 8, top: 12 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tick={{ fill: "var(--color-text-faint)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [formatAmount(Number(value), currency), "Gastos"]}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-text)",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="var(--color-expense)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--color-expense)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
