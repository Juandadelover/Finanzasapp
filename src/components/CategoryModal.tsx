"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ICONS } from "@/lib/icons";
import { cn } from "@/lib/cn";
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
  onSave: (data: { name: string; icon: CategoryIcon; color: string; type: TransactionType }) => void;
  onDelete?: (id: string) => void;
}

export function CategoryModal({ onClose, editing, defaultType, onSave, onDelete }: CategoryModalProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<CategoryIcon>(editing?.icon ?? "more-horizontal");
  const [color, setColor] = useState(editing?.color ?? COLOR_PALETTE[0]);
  const [type, setType] = useState<TransactionType>(editing?.type ?? defaultType);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color, type });
    onClose();
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar categoría" : "Nueva categoría"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!editing ? (
          <div className="flex rounded-full bg-[var(--color-surface-2)] p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-medium transition",
                type === "expense" ? "bg-[var(--color-expense)] text-white" : "text-[var(--color-text-muted)]"
              )}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-medium transition",
                type === "income" ? "bg-[var(--color-income)] text-white" : "text-[var(--color-text-muted)]"
              )}
            >
              Ingreso
            </button>
          </div>
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
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mascotas"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]"
          />
        </div>

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
                  "h-8 w-8 rounded-full border-2 transition",
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
                    "flex h-10 w-10 items-center justify-center rounded-xl border-2 text-[var(--color-text-muted)] transition",
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
              onClick={() => {
                onDelete(editing.id);
                onClose();
              }}
              aria-label="Eliminar categoría"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <button
            type="submit"
            className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
          >
            {editing ? "Guardar cambios" : "Crear categoría"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
