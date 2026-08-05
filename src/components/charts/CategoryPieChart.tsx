"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getIcon } from "@/lib/icons";
import { formatAmount } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import type { CategoryBreakdownItem } from "@/lib/selectors";
import type { CurrencyCode } from "@/types/finance";

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[];
  currency: CurrencyCode;
  emptyLabel: string;
}

export function CategoryPieChart({ data, currency, emptyLabel }: CategoryPieChartProps) {
  if (data.length === 0) {
    return <EmptyState icon={PieChartIcon} title={emptyLabel} />;
  }

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category.name"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((item) => (
                <Cell key={item.category.id} fill={item.category.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, payload) => [
                formatAmount(Number(value), currency),
                payload?.payload?.category?.name,
              ]}
              contentStyle={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        {data.map((item) => {
          const Icon = getIcon(item.category.icon);
          return (
            <div key={item.category.id} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${item.category.color}22`, color: item.category.color }}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{item.category.name}</span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {formatAmount(item.total, currency)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.category.color }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-[var(--color-text-faint)]">
                {Math.round(item.percentage)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
