"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatAmount } from "@/lib/format";
import type { MonthPoint } from "@/lib/selectors";
import type { CurrencyCode } from "@/types/finance";

interface IncomeExpenseBarChartProps {
  data: MonthPoint[];
  currency: CurrencyCode;
}

export function IncomeExpenseBarChart({ data, currency }: IncomeExpenseBarChartProps) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} margin={{ left: -12, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-text-faint)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, key) => [
              formatAmount(Number(value), currency),
              key === "income" ? "Ingresos" : "Gastos",
            ]}
            labelFormatter={(label) => label}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-text)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
