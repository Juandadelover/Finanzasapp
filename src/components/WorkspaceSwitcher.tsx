"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronDown, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/permissions";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace, createWorkspace } = useFinance();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) {
      toast.error("Escribe el nombre del negocio.");
      return;
    }
    setBusy(true);
    const ws = await createWorkspace(n);
    setBusy(false);
    if (ws) {
      toast.success(`Negocio "${ws.name}" creado.`);
      setNewName("");
      setCreating(false);
      setOpen(false);
    }
  }

  const name = currentWorkspace?.name ?? "Finanzas";
  const canSwitch = true;

  const content = (
    <>
      <span className="truncate text-lg font-semibold tracking-tight">{name}</span>
      {currentWorkspace ? (
        <span className="shrink-0 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-brand-light)]">
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
          aria-haspopup="dialog"
          className="flex min-h-11 min-w-0 items-center gap-2 text-left"
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2">{content}</div>
      )}

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Mis negocios">
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
                  "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[var(--color-surface-2)]",
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
        <div className="mt-3 flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
          {creating ? (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newName}
                maxLength={60}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del nuevo negocio"
                className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-light)]/40"
              />
              <button
                type="submit"
                disabled={busy}
                className="gradient-brand rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Creando..." : "Crear"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-[var(--color-brand-light)] transition hover:bg-[var(--color-surface-2)]"
            >
              <Plus size={16} /> Crear negocio
            </button>
          )}
          {currentWorkspace ? (
            <Link
              href="/equipo"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition hover:bg-[var(--color-surface-2)]"
            >
              <Users size={16} className="text-[var(--color-text-faint)]" /> Equipo
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/negocio"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition hover:bg-[var(--color-surface-2)]"
            >
              <Building2 size={16} className="text-[var(--color-text-faint)]" /> Datos del negocio
            </Link>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
