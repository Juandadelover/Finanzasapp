"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Download,
  FileText,
  HandCoins,
  LineChart,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
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
  ["¿Puedo llevarme mis datos si me voy?", "Sí. Puedes exportar tus movimientos y categorías en cualquier plan, incluido el Gratis. Tus datos son tuyos."],
  ["¿Emiten factura electrónica?", "No. Finanzas no es un software de facturación electrónica. Consulta los Términos y condiciones para más detalle."],
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Wallet, title: "Saldo por cuenta", text: "Nequi, Bancolombia y efectivo, cada uno con su saldo real." },
  { icon: HandCoins, title: "Me deben y Debo", text: "Quién te debe y a quién le debes, sin mezclarlo con lo ya pagado." },
  { icon: FileText, title: "Cuentas de cobro en PDF", text: "Las compartes por WhatsApp con el mensaje ya escrito." },
  { icon: CalendarClock, title: "Recurrentes y presupuestos", text: "Programa lo que se repite cada mes y fija un tope por categoría." },
  { icon: LineChart, title: "Reportes claros", text: "Estado de resultados y flujo de caja, sin saber contabilidad." },
  { icon: Users, title: "Tu equipo, con permisos", text: "Admin, editor, contador o solo registro: cada quien ve lo suyo." },
];

export default function PreciosPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [limits, setLimits] = useState<Limits>({});
  const [annual, setAnnual] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(() => {
    setState("loading");
    const supabase = createClient();
    Promise.all([
      supabase.from("plans").select("code,name,monthly_price,annual_price,sort_order").eq("active", true).order("sort_order"),
      supabase.from("plan_limits").select("plan_code,key,value"),
    ])
      .then(([p, l]) => {
        if (p.error || !p.data) return setState("error");
        setPlans(p.data as PlanRow[]);
        const map: Limits = {};
        for (const r of (l.data ?? []) as { plan_code: string; key: string; value: unknown }[]) {
          const n = r.value === null || r.value === "null" ? null : Number(r.value);
          (map[r.plan_code] ??= {})[r.key] = n;
        }
        setLimits(map);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const anySavings = plans.some((p) => p.monthly_price > 0 && p.annual_price < p.monthly_price * 12);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/login" className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-xl">
            <TrendingUp size={16} className="text-white" strokeWidth={2.5} aria-hidden />
          </span>
          Finanzas
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-brand-light)]">
          Iniciar sesión
        </Link>
      </header>

      <main>
        <section className="mt-8 text-center">
          <h1 className="mx-auto max-w-xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Sabe cuánta plata tiene tu negocio, hoy
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-[var(--color-text-muted)]">
            Registra una venta o un gasto en segundos desde el celular y mira tu saldo, lo que te deben y lo que debes.
            Hecho para el dueño, no para el contador.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?modo=registro" className={buttonClass({ size: "lg", className: "w-full rounded-full sm:w-auto sm:px-8" })}>
              Empieza gratis
            </Link>
            <a href="#planes" className={buttonClass({ variant: "secondary", size: "lg", className: "w-full rounded-full sm:w-auto sm:px-8" })}>
              Ver planes y precios
            </a>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">Sin tarjeta. Los planes de pago incluyen 14 días de prueba.</p>
        </section>

        <section aria-labelledby="ejemplo" className="mx-auto mt-10 max-w-sm">
          <h2 id="ejemplo" className="sr-only">Así se ve tu saldo</h2>
          <div className="gradient-brand rounded-3xl p-5 text-white shadow-[0_16px_40px_rgba(138,5,190,0.35)]">
            <p className="text-sm text-white/85">Saldo total · Tienda Demo</p>
            <p className="tabular mt-1 text-4xl font-bold tracking-tight">$ 4.820.000</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-white/85">Me deben</p>
                <p className="tabular font-semibold">$ 1.350.000</p>
              </div>
              <div className="rounded-2xl bg-black/10 p-3">
                <p className="text-white/85">Debo</p>
                <p className="tabular font-semibold">$ 410.000</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">Ejemplo con datos de demostración.</p>
        </section>

        <section aria-labelledby="incluye" className="mt-14">
          <h2 id="incluye" className="text-xl font-bold">Lo que hace por tu negocio</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]">
                  <Icon size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{text}</p>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 sm:col-span-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]">
                <Download size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">Tus datos son tuyos</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Los exportas cuando quieras, en cualquier plan.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section id="planes" aria-labelledby="planes-title" className="mt-14 scroll-mt-6">
          <div className="text-center">
            <h2 id="planes-title" className="text-xl font-bold">Elige tu plan</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Empieza gratis y sube de plan cuando lo necesites.</p>
            <div
              role="group"
              aria-label="Ciclo de pago"
              className="mx-auto mt-5 grid w-64 grid-cols-2 gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1"
            >
              {([[false, "Mensual"], [true, "Anual"]] as const).map(([val, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={annual === val}
                  onClick={() => setAnnual(val)}
                  className={cn(
                    "min-h-11 rounded-full text-sm font-semibold transition",
                    annual === val ? "gradient-brand text-white" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {anySavings ? (
              <p className="mt-2 text-xs text-[var(--color-income)]">Pagando por año ahorras frente al pago mensual.</p>
            ) : null}
          </div>

          {state === "loading" ? (
            <div role="status" className="mt-6 grid gap-4 sm:grid-cols-2">
              <span className="sr-only">Cargando planes...</span>
              <Skeleton className="h-64 rounded-3xl" />
              <Skeleton className="h-64 rounded-3xl" />
            </div>
          ) : state === "error" ? (
            <div role="alert" className="mt-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No pudimos cargar los planes. Revisa tu conexión e intenta de nuevo.</p>
              <Button variant="secondary" onClick={load}>
                <RefreshCw size={14} aria-hidden /> Reintentar
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              Los planes no están disponibles en este momento. Crea tu cuenta gratis y vuelve a verlos pronto.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {plans.map((p) => {
                const price = annual ? p.annual_price : p.monthly_price;
                const highlight = p.code === "emprendedor";
                const free = p.monthly_price === 0 && p.annual_price === 0;
                const saving = annual && p.monthly_price > 0 ? p.monthly_price * 12 - p.annual_price : 0;
                return (
                  <div
                    key={p.code}
                    className={cn(
                      "flex flex-col rounded-3xl border bg-[var(--color-surface)] p-5",
                      highlight ? "border-[var(--color-brand)]" : "border-[var(--color-border)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">{p.name}</h3>
                      {highlight ? (
                        <span className="gradient-brand rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">Recomendado</span>
                      ) : null}
                    </div>
                    <p className="tabular mt-3 text-3xl font-bold tracking-tight">
                      {price === 0 ? "$0" : cop(price)}
                      {price > 0 ? (
                        <span className="text-sm font-normal text-[var(--color-text-muted)]">{annual ? " /año" : " /mes"}</span>
                      ) : null}
                    </p>
                    {saving > 0 ? (
                      <p className="mt-1 text-xs text-[var(--color-income)]">Ahorras {cop(saving)} al año</p>
                    ) : null}
                    <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-text-muted)]">
                      {limitLines(limits[p.code]).map((line) => (
                        <li key={line} className="flex items-start gap-2">
                          <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-income)]" aria-hidden />
                          {line}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/login?modo=registro"
                      aria-label={free ? `Empieza gratis con el plan ${p.name}` : `Probar el plan ${p.name} 14 días gratis`}
                      className={buttonClass({
                        variant: highlight ? "primary" : "secondary",
                        size: "lg",
                        fullWidth: true,
                        className: "mt-5 rounded-full",
                      })}
                    >
                      {free ? "Empieza gratis" : "Probar 14 días gratis"}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
            Precios en pesos colombianos (COP), sin IVA. Sin factura electrónica DIAN.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-xl font-bold">Preguntas frecuentes</h2>
          <div className="mt-4 space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
                <summary className="flex min-h-12 cursor-pointer items-center py-2 text-sm font-medium">{q}</summary>
                <p className="pb-3 text-sm text-[var(--color-text-muted)]">
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

        <section className="mt-14 text-center" aria-labelledby="cta-final">
          <h2 id="cta-final" className="text-xl font-bold">Empieza con tu próximo movimiento</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">
            Crea tu cuenta gratis y registra tu primera venta o gasto hoy.
          </p>
          <Link
            href="/login?modo=registro"
            className={buttonClass({ size: "lg", className: "mt-4 w-full rounded-full sm:w-auto sm:px-8" })}
          >
            Crear mi cuenta gratis
          </Link>
        </section>
      </main>

      <footer className="mt-12 flex flex-wrap justify-center gap-x-1 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
        {LEGAL_DOCS.map((d) => (
          <Link key={d.slug} href={`/legal/${d.slug}`} className="inline-flex min-h-11 items-center px-2 hover:text-[var(--color-text)]">
            {d.title}
          </Link>
        ))}
      </footer>
    </div>
  );
}
