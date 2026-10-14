"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { fetchMySubscription, type MySubscription } from "@/lib/subscription";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

function bannerMessage(sub: MySubscription): string | null {
  switch (sub.status) {
    case "trial": {
      const d = daysUntil(sub.trial_end);
      if (d !== null && d <= 3) return d <= 0 ? "Tu prueba gratis termina hoy." : `Tu prueba gratis termina en ${d} ${d === 1 ? "día" : "días"}.`;
      return null;
    }
    case "active": {
      const d = daysUntil(sub.current_period_end);
      if (d !== null && d <= 7) return d <= 0 ? "Tu plan vence hoy." : `Tu plan vence en ${d} ${d === 1 ? "día" : "días"}.`;
      return null;
    }
    case "grace":
      return "Tu plan venció. Renueva pronto para no perder funciones.";
    case "expired":
      return "Tu plan venció y pasaste al plan Gratis.";
    case "provisional":
      return "Estamos revisando tu pago. Tienes acceso provisional.";
    default:
      return null;
  }
}

export function SubscriptionBanner() {
  const { currentWorkspace } = useFinance();
  const workspaceId = currentWorkspace?.id ?? null;
  const isOwner = currentWorkspace?.role === "owner";
  const [sub, setSub] = useState<MySubscription | null>(null);

  useEffect(() => {
    if (!workspaceId || !isOwner) return;
    let cancelled = false;
    fetchMySubscription()
      .then((s) => !cancelled && setSub(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId, isOwner]);

  if (!isOwner || !sub) return null;
  const message = bannerMessage(sub);
  if (!message) return null;

  return (
    <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm">
      <AlertTriangle size={16} className="shrink-0 text-[var(--color-brand-light)]" />
      <span className="flex-1 text-[var(--color-text-muted)]">{message}</span>
      <Link href="/suscripcion" className="shrink-0 font-semibold text-[var(--color-brand-light)]">
        Ver planes
      </Link>
    </div>
  );
}
