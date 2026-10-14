"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { ExpenseIcon, IncomeIcon } from "@/components/icons/money";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { haptic } from "@/components/ui/motion";

/**
 * Desktop "Nuevo movimiento" primary action (rendered by AppHeader, lg+ only).
 * Same permission rules as FloatingActionButton: nothing if the role can create neither;
 * one allowed type opens the TransactionModal directly; both show an Ingreso / Gasto menu
 * (Esc and outside click close it).
 */
const ITEM =
  "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]";

export function NewTransactionButton() {
  const { openNewTransaction } = useUI();
  const { permissions } = useFinance();
  const { canCreateIncome, canCreateExpense } = permissions;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!canCreateIncome && !canCreateExpense) return null;
  const both = canCreateIncome && canCreateExpense;

  function pick(type: "expense" | "income") {
    haptic(8);
    setOpen(false);
    openNewTransaction(type);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup={both ? "menu" : undefined}
        aria-expanded={both ? open : undefined}
        onClick={() => (both ? setOpen((v) => !v) : pick(canCreateIncome ? "income" : "expense"))}
        className="gradient-brand flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-brand-md)] transition-transform active:scale-[0.97]"
      >
        <Plus size={18} aria-hidden />
        Nuevo movimiento
        {both ? <ChevronDown size={16} aria-hidden className="-mr-1 opacity-80" /> : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="anim-pop-in absolute right-0 top-full z-(--z-header) mt-2 w-48 origin-top-right rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-lg"
        >
          <button type="button" role="menuitem" autoFocus onClick={() => pick("income")} className={ITEM}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-income)]/15 text-[var(--color-income)]">
              <IncomeIcon size={15} />
            </span>
            Ingreso
          </button>
          <button type="button" role="menuitem" onClick={() => pick("expense")} className={ITEM}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-expense)]/15 text-[var(--color-expense)]">
              <ExpenseIcon size={15} />
            </span>
            Gasto
          </button>
        </div>
      ) : null}
    </div>
  );
}
