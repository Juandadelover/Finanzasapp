"use client";

import { useMemo, useState } from "react";
import { Archive, MessageCircle, Plus, Search, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useFinance } from "@/context/FinanceContext";
import { MASKED_AMOUNT, usePrivacy } from "@/context/PrivacyContext";
import { cn } from "@/lib/cn";
import { formatAmount, formatDayLabel, toISODate } from "@/lib/format";
import { dueLabel, sumAmount, whatsappUrl } from "@/lib/cartera";
import type { Contact, ContactKind } from "@/types/finance";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

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
  const confirm = useConfirm();

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

  async function handleArchive() {
    if (!editing) return;
    const ok = await confirm({
      title: "¿Archivar este contacto?",
      description: "Dejará de aparecer, pero sus movimientos se conservan.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (ok) {
      updateContact(editing.id, { archived: true });
      onClose();
    }
  }

  return (
    <BottomSheet isOpen onClose={onClose} title={editing ? "Editar contacto" : "Nuevo contacto"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className={labelClass}>Nombre</span>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre o razón social"
            className={inputClass}
          />
        </label>
        <div role="group" aria-label="Tipo">
          <p className={labelClass}>Tipo</p>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={cn(
                  "min-h-11 rounded-xl border py-2.5 text-xs font-medium transition active:scale-[0.97]",
                  kind === k.value
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-light)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>NIT o cédula</span>
            <input value={document} onChange={(e) => setDocument(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Teléfono</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 123 4567"
              className={inputClass}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Notas</span>
          <textarea
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 pt-1">
          {editing ? (
            <Button
              variant="danger"
              onClick={handleArchive}
              aria-label="Archivar contacto"
              className="w-12 shrink-0 px-0"
            >
              <Archive size={18} aria-hidden />
            </Button>
          ) : null}
          <Button type="submit" className="flex-1">
            {editing ? "Guardar cambios" : "Crear contacto"}
          </Button>
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
          (c.phone ?? "").includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [state.contacts, tab, query]);

  const detail = detailId ? (state.contacts.find((c) => c.id === detailId) ?? null) : null;

  if (!hydrated) {
    return (
      <>
        <AppHeader />
        <PageHeader title="Contactos" backHref="/cartera" backLabel="Cartera" />
        <SkeletonList count={4} className="mx-4 mt-4" />
      </>
    );
  }

  function balanceFor(c: Contact) {
    const b = balances.get(c.id) ?? { owed: 0, owe: 0 };
    // Show the side relevant to the tab; fall back to the other when it is the only one.
    if (tab === "client")
      return b.owed > 0 ? { v: b.owed, label: "Te debe" } : b.owe > 0 ? { v: b.owe, label: "Le debes" } : null;
    return b.owe > 0 ? { v: b.owe, label: "Le debes" } : b.owed > 0 ? { v: b.owed, label: "Te debe" } : null;
  }

  return (
    <>
      <AppHeader />

      <PageHeader
        title="Contactos"
        subtitle="Tus clientes y proveedores."
        backHref="/cartera"
        backLabel="Cartera"
        actions={
          canManage ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSheet({ open: true, editing: null })}
              className="rounded-full bg-[var(--color-surface)] px-4"
            >
              <Plus size={16} className="text-[var(--color-brand-light)]" aria-hidden />
              Nuevo
            </Button>
          ) : null
        }
      />

      <div
        role="tablist"
        aria-label="Tipo de contacto"
        className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--color-surface)] p-1"
      >
        {(["client", "supplier"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "min-h-11 rounded-xl py-2 text-sm font-medium transition active:scale-[0.97]",
              tab === k
                ? "bg-[var(--color-surface-3)] text-[var(--color-brand-light)]"
                : "text-[var(--color-text-muted)]",
            )}
          >
            {k === "client" ? "Clientes" : "Proveedores"}
          </button>
        ))}
      </div>

      <div className="relative mx-4 mt-3">
        <Search
          size={16}
          aria-hidden
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          aria-label="Buscar contacto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, NIT o teléfono"
          className={cn(inputClass, "pl-10")}
        />
      </div>

      <section className="mx-4 mt-4 mb-4">
        {list.length === 0 ? (
          <>
            <EmptyState
              icon={Users}
              title={
                query ? "Sin resultados" : tab === "client" ? "Aún no tienes clientes" : "Aún no tienes proveedores"
              }
              description={
                query
                  ? "Prueba con otro nombre, NIT o teléfono."
                  : "Agrégalos para llevar el control de lo que te deben y debes."
              }
            />
            {canManage && !query ? (
              <Button className="mt-3 w-full" onClick={() => setSheet({ open: true, editing: null })}>
                <Plus size={16} aria-hidden />
                {tab === "client" ? "Agregar cliente" : "Agregar proveedor"}
              </Button>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
            {list.map((c) => {
              const b = balanceFor(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDetailId(c.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition active:scale-[0.98] hover:bg-[var(--color-surface-2)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/15 text-sm font-semibold text-[var(--color-brand-light)]">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {c.phone || c.document || "Sin datos de contacto"}
                    </span>
                  </span>
                  {b ? (
                    <span className="max-w-[45%] shrink-0 text-right">
                      <span className="block truncate text-sm font-semibold tabular-nums">{money(b.v)}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">{b.label}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">Al día</span>
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
                      : `Quedamos atentos a cualquier novedad. ¡Gracias!`),
                )
              : null;
            const row = (t: (typeof txs)[number]) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.description || "Sin descripción"}</span>
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    {t.status === "pending" ? dueLabel(t.dueDate, today) : formatDayLabel(t.date)}
                  </span>
                </span>
                <span
                  className="max-w-[45%] shrink-0 truncate font-semibold tabular-nums"
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
                    <p className="text-xs text-[var(--color-text-muted)]">Te debe</p>
                    <p className="truncate text-lg font-bold tabular-nums">{money(owed)}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-surface-2)] p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Le debes</p>
                    <p className="truncate text-lg font-bold tabular-nums">{money(owe)}</p>
                  </div>
                </div>
                {detail.phone || detail.email || detail.document ? (
                  <p className="break-words text-xs text-[var(--color-text-muted)]">
                    {[detail.document, detail.phone, detail.email].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-black"
                  >
                    <MessageCircle size={18} aria-hidden />
                    Escribir por WhatsApp
                  </a>
                ) : null}
                <div>
                  <h3 className={labelClass}>Pendientes</h3>
                  {pending.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">Nada pendiente con este contacto.</p>
                  ) : (
                    pending.map(row)
                  )}
                </div>
                <div>
                  <h3 className={labelClass}>Pagos recientes</h3>
                  {paid.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">Aún no hay pagos registrados.</p>
                  ) : (
                    paid.map(row)
                  )}
                </div>
                {canManage ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDetailId(null);
                      setSheet({ open: true, editing: detail });
                    }}
                  >
                    Editar contacto
                  </Button>
                ) : null}
              </div>
            );
          })()}
        </BottomSheet>
      ) : null}
    </>
  );
}
