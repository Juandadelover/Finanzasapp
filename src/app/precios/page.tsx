"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { LEGAL_DOCS } from "@/lib/legal";

interface PlanRow {
  code: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  sort_order: number;
}

type Limits = Record<string, Record<string, number | null>>;

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function limitLines(l: Record<string, number | null> | undefined): string[] {
  if (!l) return [];
  const out: string[] = [];
  const v = (k: string) => l[k];
  const w = v("max_workspaces_owned");
  if (w !== undefined) out.push(w === null ? "Negocios ilimitados" : `${w} ${w === 1 ? "negocio" : "negocios"}`);
  const m = v("max_members");
  if (m !== undefined) out.push(m === null ? "Usuarios ilimitados por negocio" : `${m} ${m === 1 ? "usuario" : "usuarios"} por negocio`);
  const t = v("max_tx_per_month");
  if (t !== undefined) out.push(t === null ? "Movimientos ilimitados" : `${t} movimientos al mes`);
  const c = v("max_collection_docs_per_month");
  if (c !== undefined) out.push(c === null ? "Cuentas de cobro ilimitadas" : `${c} cuentas de cobro al mes`);
  return out;
}

const FAQ = [
  ["¿Cómo se paga?", "Por Nequi, transferencia Bancolombia o llave Bre-B. Pagas, subes el comprobante en la app y activamos tu plan tras verificarlo. Mientras tanto tienes acceso provisional."],
  ["¿Necesito tarjeta para probar?", "No. Los planes de pago incluyen 14 días de prueba gratis, sin tarjeta. El plan Gratis es para siempre."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Conservas el acceso hasta el final del periodo pagado y no hay cobros automáticos."],
  ["¿Emiten factura electrónica?", "No. Finanzas no es un software de facturación electrónica. Consulta los Términos y condiciones para más detalle."],
];

export default function PreciosPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [limits, setLimits] = useState<Limits>({});
  const [annual, setAnnual] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("plans").select("code,name,monthly_price,annual_price,sort_order").eq("active", true).order("sort_order"),
      supabase.from("plan_limits").select("plan_code,key,value"),
    ]).then(([p, l]) => {
      if (p.error || !p.data) return setState("error");
      setPlans(p.data as PlanRow[]);
      const map: Limits = {};
      for (const r of (l.data ?? []) as { plan_code: string; key: string; value: unknown }[]) {
        const n = r.value === null || r.value === "null" ? null : Number(r.value);
        (map[r.plan_code] ??= {})[r.key] = n;
      }
      setLimits(map);
      setState("ok");
    });
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-2 text-sm font-semibold">
          <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-xl">
            <TrendingUp size={16} className="text-white" strokeWidth={2.5} />
          </span>
          Finanzas
        </Link>
        <Link href="/login" className="text-xs font-medium text-[var(--color-brand-light)]">
          Iniciar sesión
        </Link>
      </header>

      <section className="mt-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">El dinero de tu negocio, claro y bajo control</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-text-muted)]">
          Empieza gratis. Prueba 14 días cualquier plan de pago, sin tarjeta.
        </p>
        <div className="mx-auto mt-6 grid w-64 grid-cols-2 gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
          {([[false, "Mensual"], [true, "Anual"]] as const).map(([val, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={annual === val}
              onClick={() => setAnnual(val)}
              className={cn(
                "rounded-full py-2 text-xs font-semibold transition",
                annual === val ? "gradient-brand text-white" : "text-[var(--color-text-muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-income)]">Anual: pagas 10 meses y usas 12</p>
      </section>

      {state === "loading" ? (
        <p className="mt-10 text-center text-sm text-[var(--color-text-muted)]">Cargando planes...</p>
      ) : state === "error" ? (
        <p className="mt-10 text-center text-sm text-[var(--color-expense)]">No se pudieron cargar los planes. Intenta de nuevo.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {plans.map((p) => {
            const price = annual ? p.annual_price : p.monthly_price;
            const highlight = p.code === "emprendedor";
            return (
              <div
                key={p.code}
                className={cn(
                  "flex flex-col rounded-3xl border bg-[var(--color-surface)] p-5",
                  highlight ? "border-[var(--color-brand)] shadow-[0_8px_24px_rgba(138,5,190,0.2)]" : "border-[var(--color-border)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  {highlight ? (
                    <span className="gradient-brand rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">Popular</span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {price === 0 ? "$0" : cop(price)}
                  {price > 0 ? (
                    <span className="text-sm font-normal text-[var(--color-text-muted)]">{annual ? " /año" : " /mes"}</span>
                  ) : null}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-text-muted)]">
                  {limitLines(limits[p.code]).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-income)]" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?modo=registro"
                  className={cn(
                    "mt-5 flex items-center justify-center rounded-full py-3 text-sm font-semibold transition",
                    highlight
                      ? "gradient-brand text-white"
                      : "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
                  )}
                >
                  Empieza gratis
                </Link>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-center text-[11px] text-[var(--color-text-faint)]">Precios en pesos colombianos (COP), sin IVA.</p>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-4 space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{q}</summary>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {a}
                {q.startsWith("¿Emiten") ? (
                  <>
                    {" "}
                    <Link href="/legal/terminos#facturacion" className="text-[var(--color-brand-light)] underline">
                      Ver términos
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-text-muted)]">
        {LEGAL_DOCS.map((d) => (
          <Link key={d.slug} href={`/legal/${d.slug}`} className="hover:text-[var(--color-text)]">
            {d.title}
          </Link>
        ))}
      </footer>
    </div>
  );
}
