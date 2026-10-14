"use client";

import { Plus } from "lucide-react";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/finance";

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
}

export function CategoryPicker({ categories, selectedId, onSelect, onCreateNew }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map((category) => {
        const Icon = getIcon(category.icon);
        const isSelected = category.id === selectedId;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={isSelected}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition",
                isSelected ? "border-[var(--color-brand)]" : "border-transparent"
              )}
              style={{ backgroundColor: `${category.color}22`, color: category.color }}
            >
              <Icon size={22} />
            </span>
            <span
              className={cn(
                "line-clamp-1 max-w-[72px] text-center text-xs",
                isSelected ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
              )}
            >
              {category.name}
            </span>
          </button>
        );
      })}
      {onCreateNew ? (
        <button
          type="button"
          onClick={onCreateNew}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-faint)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand-light)]">
            <Plus size={22} />
          </span>
          <span className="text-center text-xs text-[var(--color-text-muted)]">Nueva</span>
        </button>
      ) : null}
    </div>
  );
}
