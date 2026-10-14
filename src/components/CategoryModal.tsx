"use client";

import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { haptic } from "@/components/ui/motion";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ICONS } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import type { Category, CategoryIcon, TransactionType } from "@/types/finance";

const COLOR_PALETTE = [
  "#f97316", "#ef4444", "#f472b6", "#a855f7", "#6366f1",
  "#3b82f6", "#06b6d4", "#14b8a6", "#10b981", "#84cc16",
  "#eab308", "#f59e0b", "#64748b", "#22c55e", "#ec4899",
];

interface CategoryModalProps {
  onClose: () => void;
  editing: Category | null;
  defaultType: TransactionType;
  onSave: (data: {
    name: string;
    icon: CategoryIcon;
    color: string;
    type: TransactionType;
    monthlyBudget: number | null;
  }) => void;
  onDelete?: (id: string) => void;
  lockType?: boolean;
}

export function CategoryModal({
  onClose,
  editing,
  defaultType,
  onSave,
  onDelete,
  lockType = false,
}: CategoryModalProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<CategoryIcon>(editing?.icon ?? "more-horizontal");
  const [color, setColor] = useState(editing?.color ?? COLOR_PALETTE[0]);
  const [type, setType] = useState<TransactionType>(editing?.type ?? defaultType);
  const [monthlyBudget, setMonthlyBudget] = useState(editing?.monthlyBudget ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      icon,
      color,
      type,
      monthlyBudget: type === "expense" && monthlyBudget > 0 ? monthlyBudget : null,
    });
    haptic();
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar categoría" : "Nueva categoría"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!editing && !lockType ? (
          <SegmentedControl
            aria-label="Tipo de categoría"
            value={type}
            onChange={(next) => {
              setType(next);
              if (next === "income") setMonthlyBudget(0);
            }}
            options={[
              { value: "expense", label: "Gasto", indicatorClass: "bg-[var(--color-expense)]", activeClass: "text-white" },
              { value: "income", label: "Ingreso", indicatorClass: "bg-[var(--color-income)]", activeClass: "text-white" },
            ]}
          />
        ) : null}

        <div className="flex items-center justify-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {(() => {
              const Icon = ICONS[icon];
              return <Icon size={26} />;
            })()}
          </span>
        </div>

        <div>
          <label htmlFor="cat-f1" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Nombre
          </label>
          <input id="cat-f1"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mascotas"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
          />
        </div>

        {type === "expense" ? (
          <div>
            <label htmlFor="cat-f2" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
              Presupuesto mensual (opcional)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 focus-within:border-[var(--color-brand)]">
              <span className="text-sm text-[var(--color-text-muted)]">$</span>
              <input id="cat-f2"
                type="text"
                inputMode="numeric"
                value={formatAmountInput(monthlyBudget)}
                onChange={(e) => setMonthlyBudget(parseAmountInput(e.target.value))}
                placeholder="Sin límite"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-faint)]"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={cn(
                  "h-11 w-11 rounded-full border-2 transition active:scale-[0.95]",
                  color === c ? "border-white" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Ícono
          </label>
          <div className="grid grid-cols-6 gap-2">
            {(Object.keys(ICONS) as CategoryIcon[]).map((key) => {
              const Icon = ICONS[key];
              const isSelected = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[var(--color-text-muted)] transition active:scale-[0.95]",
                    isSelected ? "border-[var(--color-brand)] text-[var(--color-brand-light)]" : "border-transparent bg-[var(--color-surface-2)]"
                  )}
                >
                  <Icon size={17} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          {editing && onDelete ? (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: `¿Eliminar "${editing.name}"?`,
                  description: "Los movimientos de esta categoría se conservan, pero quedarán sin categoría.",
                  confirmLabel: "Eliminar",
                  destructive: true,
                });
                if (!ok) return;
                onDelete(editing.id);
                onClose();
              }}
              aria-label="Eliminar categoría"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition active:scale-[0.97] hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <Button type="submit" className="flex-1">
            {editing ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
