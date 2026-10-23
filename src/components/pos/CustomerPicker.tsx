"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFinance } from "@/context/FinanceContext";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";

interface CustomerPickerProps {
  value: string | null;
  onChange: (contactId: string | null) => void;
  required?: boolean;
}

export function CustomerPicker({ value, onChange, required = false }: CustomerPickerProps) {
  const { state, addContact } = useFinance();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clients = useMemo(
    () => state.contacts.filter((c) => !c.archived && (c.kind === "client" || c.kind === "both")),
    [state.contacts],
  );
  const selected = value ? state.contacts.find((c) => c.id === value) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || (c.document ?? "").toLowerCase().includes(q))
      .slice(0, 5);
  }, [clients, query]);

  async function create() {
    if (saving) return;
    if (!name.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    setError(null);
    setSaving(true);
    const created = await addContact({
      kind: "client",
      name: name.trim(),
      document: document.trim() || null,
      phone: phone.trim() || null,
    });
    if (!created) {
      setError("No se pudo crear el cliente.");
      setSaving(false);
      return;
    }
    if (address.trim()) {
      // La dirección vive en contacts.address; addContact aún no la recibe, así que se guarda aparte.
      const { error: addrError } = await createClient()
        .from("contacts")
        .update({ address: address.trim() })
        .eq("id", created.id);
      if (addrError) console.error("No se pudo guardar la dirección del cliente", addrError);
    }
    setSaving(false);
    setCreating(false);
    setName("");
    setDocument("");
    setPhone("");
    setAddress("");
    setQuery("");
    onChange(created.id);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-3.5 pr-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{selected.name}</p>
          {selected.document || selected.phone ? (
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {[selected.document, selected.phone].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Quitar cliente"
          onClick={() => onChange(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
        <p className="text-sm font-semibold">Cliente nuevo</p>
        <label className="block">
          <span className={labelClass}>Nombre</span>
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Documento</span>
            <input inputMode="numeric" value={document} maxLength={30} onChange={(e) => setDocument(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Teléfono</span>
            <input type="tel" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Dirección</span>
          <input value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-expense)]">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void create()} loading={saving}>
            Guardar cliente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="sr-only">Buscar cliente</span>
          <span className="relative block">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={required ? "Cliente (obligatorio): documento o nombre" : "Cliente (opcional): documento o nombre"}
              className={`${inputClass} pl-10`}
            />
          </span>
        </label>
        <Button
          variant="secondary"
          aria-label="Crear cliente"
          onClick={() => {
            setName(/\d/.test(query) ? "" : query.trim());
            setDocument(/^\d+$/.test(query.trim()) ? query.trim() : "");
            setCreating(true);
          }}
          className="w-11 shrink-0 px-0"
        >
          <UserPlus size={18} aria-hidden />
        </Button>
      </div>
      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setQuery("");
                }}
                className="flex min-h-11 w-full flex-col justify-center px-3.5 py-2 text-left hover:bg-[var(--color-surface-2)]"
              >
                <span className="truncate text-sm font-medium">{c.name}</span>
                {c.document ? <span className="text-xs text-[var(--color-text-muted)]">{c.document}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="text-sm text-[var(--color-text-muted)]">No hay clientes con esa búsqueda. Toca el botón para crearlo.</p>
      ) : null}
    </div>
  );
}
