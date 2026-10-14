"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useUI } from "@/context/UIContext";
import { cn } from "@/lib/cn";

/** Checklist "Primeros pasos" para negocios nuevos. Se oculta al completarse o al descartarla (por negocio, localStorage). */

const key = (ws: string, name: string) => `finanzasapp:onboarding:${ws}:${name}`;

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: la tarjeta sigue funcionando sin recordar */
  }
}

export function GettingStarted() {
  const { state, currentWorkspace, hydrated } = useFinance();
  const { openNewTransaction } = useUI();
  const wsId = currentWorkspace?.id ?? null;
  const [dismissed, setDismissed] = useState(true);
  const [visitedTeam, setVisitedTeam] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    // Lectura de localStorage tras montar (evita desajuste de hidratación).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(read(key(wsId, "dismissed")) === "1");
    setVisitedTeam(read(key(wsId, "team")) === "1");
  }, [wsId]);

  const dismiss = useCallback(() => {
    if (!wsId) return;
    write(key(wsId, "dismissed"), "1");
    setDismissed(true);
  }, [wsId]);

  const markTeam = useCallback(() => {
    if (!wsId) return;
    write(key(wsId, "team"), "1");
    setVisitedTeam(true);
  }, [wsId]);

  const txCount = state.transactions.length;
  const steps = [
    { id: "cuentas", label: "Configura tus cuentas", done: state.accounts.length > 0, href: "/cuentas" },
    {
      id: "movs",
      label: `Registra 3 movimientos (${Math.min(txCount, 3)}/3)`,
      done: txCount >= 3,
      onClick: () => openNewTransaction("expense"),
    },
    { id: "cliente", label: "Agrega un cliente", done: state.contacts.length > 0, href: "/contactos" },
    { id: "contador", label: "Invita a tu contador", done: visitedTeam, href: "/equipo", onVisit: markTeam },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (!hydrated || !currentWorkspace || currentWorkspace.role !== "owner" || dismissed || allDone) return null;

  const rowClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm transition active:scale-[0.98] hover:bg-[var(--color-surface-2)]";

  return (
    <section
      aria-labelledby="primeros-pasos"
      className="mx-4 mt-4 rounded-2xl lg:mx-0 lg:mt-0 border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="min-w-0">
          <h2 id="primeros-pasos" className="text-sm font-semibold">
            Primeros pasos
          </h2>
          <p className="text-xs text-[var(--color-text-faint)]">
            {doneCount} de {steps.length} listos
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar primeros pasos"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition active:scale-[0.95] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="mt-1">
        {steps.map((s) => {
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  s.done
                    ? "border-[var(--color-income)] bg-[var(--color-income)]/15 text-[var(--color-income)]"
                    : "border-[var(--color-border)] text-transparent"
                )}
              >
                <Check size={14} aria-hidden />
              </span>
              <span className={cn("min-w-0 flex-1", s.done && "text-[var(--color-text-muted)] line-through")}>
                {s.label}
                {s.done ? <span className="sr-only"> (hecho)</span> : null}
              </span>
            </>
          );
          return (
            <li key={s.id}>
              {"href" in s && s.href ? (
                <Link href={s.href} onClick={"onVisit" in s ? s.onVisit : undefined} className={rowClass}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={s.onClick} className={rowClass}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
