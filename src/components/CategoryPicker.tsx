"use client";

import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/finance";

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryPicker({ categories, selectedId, onSelect }: CategoryPickerProps) {
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
                "line-clamp-1 max-w-[64px] text-center text-[11px]",
                isSelected ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
              )}
            >
              {category.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
