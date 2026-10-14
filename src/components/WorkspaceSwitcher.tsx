"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/permissions";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useFinance();
  const [open, setOpen] = useState(false);

  const name = currentWorkspace?.name ?? "Finanzas";
  const canSwitch = workspaces.length > 1;

  const content = (
    <>
      <span className="truncate text-lg font-semibold tracking-tight">{name}</span>
      {currentWorkspace ? (
        <span className="shrink-0 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand-light)]">
          {ROLE_LABELS[currentWorkspace.role]}
        </span>
      ) : null}
      {canSwitch ? <ChevronDown size={16} className="shrink-0 text-[var(--color-text-faint)]" /> : null}
    </>
  );

  return (
    <>
      {canSwitch ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Cambiar de negocio"
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2">{content}</div>
      )}

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Cambiar de negocio">
        <div className="flex flex-col gap-1">
          {workspaces.map((w) => {
            const active = w.id === currentWorkspace?.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  switchWorkspace(w.id);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--color-surface-2)]",
                  active && "bg-[var(--color-surface-2)]"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{w.name}</span>
                  <span className="block text-xs text-[var(--color-text-faint)]">{ROLE_LABELS[w.role]}</span>
                </span>
                {active ? <Check size={16} className="text-[var(--color-brand-light)]" /> : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
