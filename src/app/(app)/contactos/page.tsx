"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Plus, Search, Trash2, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatDayLabel, toISODate } from "@/lib/format";
import { dueLabel, sumAmount, whatsappUrl } from "@/lib/cartera";
import type { Contact, ContactKind } from "@/types/finance";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";

const KINDS: { value: ContactKind; label: string }[] = [
  { value: "client", label: "Cliente" },
  { value: "supplier", label: "Proveedor" },
  { value: "both", label: "Ambos" },
];

function ContactSheet({
  editing,
  defaultKind,
  onClose,
}: {
  editing: Contact | null;
  defaultKind: ContactKind;
  onClose: () => void;
}) {
  const { addContact, updateContact } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<ContactKind>(editing?.kind ?? defaultKind);
  const [document, setDocument] = useState(editing?.document ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresa un nombre.");
      return;
    }
    const data = {
      name: name.trim(),
      kind,
      document: document.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    };
    if (editing) updateContact(editing.id, data);
    else addContact(data);
    onClose();
  }

  function handleArchive() {
    if (!editing) return;
    if (window.confirm("¿Archivar este contacto? Dejará de aparecer, pero sus movimientos se conservan.")) {
      updateContact(editing.id, { archived: true });
      onClose();
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar contacto" : "Nuevo contacto"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre o razón social"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  "rounded-xl border py-2.5 text-xs font-medium transition",
                  kind === k.value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>NIT / CC</label>
            <input value={document} onChange={(e) => setDocument(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 123 4567"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Correo</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notas</label>
          <textarea
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </div>
        {error ? <p className="text-sm text-[var(--color-expense)]">{error}</p> : null}
        <div className="flex gap-3 pt-1">
          {editing ? (
            <button
              type="button"
              onClick={handleArchive}
              aria-label="Archivar contacto"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-expense)] transition hover:bg-[var(--color-surface-2)]"
            >
              <Trash2 size={18} />
            </button>
          ) : null}
          <button
            type="submit"
            className="gradient-brand flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99]"
          >
            {editing ? "Guardar cambios" : "Crear contacto"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

export default function ContactosPage() {
  const { state, hydrated, permissions, currentWorkspace } = useFinance();
  const { hidden } = usePrivacy();
  const currency = state.settings.currency;
  const canManage = permissions.canEditTransactions;
  const [tab, setTab] = useState<"client" | "supplier">("client");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{ open: boolean; editing: Contact | null }>({ open: false, editing: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const today = toISODate(new Date());
  const money = (v: number) => (hidden ? MASKED_AMOUNT : formatAmount(v, currency));

  // Pending balance per contact: owed to us (income) and owed by us (expense).
  const balances = useMemo(() => {
    const map = new Map<string, { owed: number; owe: number }>();
    for (const t of state.transactions) {
      if (t.status !== "pending" || !t.contactId) continue;
      const b = map.get(t.contactId) ?? { owed: 0, owe: 0 };
      if (t.type === "income") b.owed += t.amount;
      else b.owe += t.amount;
      map.set(t.contactId, b);
    }
    return map;
  }, [state.transactions]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.contacts
      .filter((c) => !c.archived)
      .filter((c) => c.kind === tab || c.kind === "both")
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.document ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [state.contacts, tab, query]);

  const detail = detailId ? state.contacts.find((c) => c.id === detailId) ?? null : null;

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <div className="mx-4 mt-4 h-32 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      </>
    );
  }

  function balanceFor(c: Contact) {
    const b = balances.get(c.id) ?? { owed: 0, owe: 0 };
    // Show the side relevant to the tab; fall back to the other when it is the only one.
    if (tab === "client") return b.owed > 0 ? { v: b.owed, label: "Te debe" } : b.owe > 0 ? { v: b.owe, label: "Le debes" } : null;
    return b.owe > 0 ? { v: b.owe, label: "Le debes" } : b.owed > 0 ? { v: b.owed, label: "Te debe" } : null;
  }

  return (
    <>
      <AppHeader />

      <div className="mx-4 mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link
            href="/cartera"
            aria-label="Volver a Cartera"
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold">Contactos</h1>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setSheet({ open: true, editing: null })}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-semibold"
          >
            <Plus size={16} className="text-[var(--color-brand-light)]" />
            Nuevo
          </button>
        ) : null}
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--color-surface)] p-1">
        {(["client", "supplier"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-xl py-2 text-sm font-medium transition",
              tab === k ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]" : "text-[var(--color-text-muted)]"
            )}
          >
            {k === "client" ? "Clientes" : "Proveedores"}
          </button>
        ))}
      </div>

      <div className="relative mx-4 mt-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, NIT o teléfono"
          className={cn(inputClass, "pl-10")}
        />
      </div>

      <section className="mx-4 mt-4 mb-4">
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? "Sin resultados" : tab === "client" ? "Aún no tienes clientes" : "Aún no tienes proveedores"}
            description={query ? undefined : "Agrégalos para llevar el control de lo que te deben y debes."}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
            {list.map((c) => {
              const b = balanceFor(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDetailId(c.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-sm font-semibold text-[var(--color-brand-light)]">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-[var(--color-text-faint)]">
                      {c.phone || c.document || "Sin datos de contacto"}
                    </span>
                  </span>
                  {b ? (
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold">{money(b.v)}</span>
                      <span className="block text-[11px] text-[var(--color-text-faint)]">{b.label}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--color-text-faint)]">Al día</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {sheet.open ? (
        <ContactSheet
          key={sheet.editing?.id ?? "new"}
          editing={sheet.editing}
          defaultKind={tab}
          onClose={() => setSheet({ open: false, editing: null })}
        />
      ) : null}

      {detail ? (
        <BottomSheet isOpen onClose={() => setDetailId(null)} title={detail.name}>
          {(() => {
            const txs = state.transactions.filter((t) => t.contactId === detail.id);
            const pending = txs
              .filter((t) => t.status === "pending")
              .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
            const paid = txs
              .filter((t) => t.status === "paid")
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8);
            const owed = sumAmount(pending.filter((t) => t.type === "income"));
            const owe = sumAmount(pending.filter((t) => t.type === "expense"));
            const wa = detail.phone
              ? whatsappUrl(
                  detail.phone,
                  `Hola ${detail.name}, te escribimos de ${currentWorkspace?.name ?? "nuestro negocio"}. ` +
                    (owed > 0
                      ? `Tienes un saldo pendiente de ${formatAmount(owed, currency)}. ¿Nos confirmas cuándo podrías realizar el pago? ¡Gracias!`
                      : `Quedamos atentos a cualquier novedad. ¡Gracias!`)
                )
              : null;
            const row = (t: (typeof txs)[number]) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{t.description || "Sin descripción"}</span>
                  <span className="block text-xs text-[var(--color-text-faint)]">
                    {t.status === "pending" ? dueLabel(t.dueDate, today) : formatDayLabel(t.date)}
                  </span>
                </span>
                <span
                  className="shrink-0 font-semibold"
                  style={{ color: t.type === "income" ? "var(--color-income)" : "var(--color-expense)" }}
                >
                  {money(t.amount)}
                </span>
              </div>
            );
            return (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[var(--color-surface-2)] p-3">
                    <p className="text-xs text-[var(--color-text-faint)]">Te debe</p>
                    <p className="text-lg font-bold">{money(owed)}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-surface-2)] p-3">
                    <p className="text-xs text-[var(--color-text-faint)]">Le debes</p>
                    <p className="text-lg font-bold">{money(owe)}</p>
                  </div>
                </div>
                {detail.phone || detail.email || detail.document ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {[detail.document, detail.phone, detail.email].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-black"
                  >
                    <MessageCircle size={18} />
                    Enviar WhatsApp
                  </a>
                ) : null}
                <div>
                  <h3 className={labelClass}>Pendientes</h3>
                  {pending.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-faint)]">Sin movimientos pendientes.</p>
                  ) : (
                    pending.map(row)
                  )}
                </div>
                <div>
                  <h3 className={labelClass}>Pagos recientes</h3>
                  {paid.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-faint)]">Sin movimientos pagados.</p>
                  ) : (
                    paid.map(row)
                  )}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailId(null);
                      setSheet({ open: true, editing: detail });
                    }}
                    className="rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold"
                  >
                    Editar contacto
                  </button>
                ) : null}
              </div>
            );
          })()}
        </BottomSheet>
      ) : null}
    </>
  );
}
