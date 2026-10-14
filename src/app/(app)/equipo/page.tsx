"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, MessageCircle, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useFinance } from "@/context/FinanceContext";
import { ROLE_LABELS } from "@/lib/permissions";
import { toastDbError } from "@/lib/subscription";
import {
  INVITE_ROLES,
  changeMemberRole,
  errorMessage,
  fetchMembers,
  fetchPendingInvitations,
  invitationLink,
  inviteMember,
  removeMember,
  revokeInvitation,
  whatsappInviteUrl,
  type Invitation,
  type InviteRole,
  type Member,
} from "@/lib/team";

const inputClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)]";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-faint)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const chipClass =
  "shrink-0 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand-light)]";

export default function EquipoPage() {
  const { currentWorkspace, user, reload } = useFinance();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [busy, setBusy] = useState(false);

  const wsId = currentWorkspace?.id ?? null;
  const wsName = currentWorkspace?.name ?? "";
  const isAdmin = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const [m, i] = await Promise.all([fetchMembers(wsId), isAdmin ? fetchPendingInvitations(wsId) : Promise.resolve([])]);
      setMembers(m);
      setInvites(i);
    } catch {
      toast.error("No se pudo cargar el equipo.");
    } finally {
      setLoading(false);
    }
  }, [wsId, isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function sendInvite(addr: string, r: InviteRole, resend = false) {
    if (!wsId) return;
    setBusy(true);
    try {
      await inviteMember(wsId, addr, r);
      toast.success(resend ? "Invitación reenviada con un enlace nuevo." : "Invitación enviada por email.");
      if (!resend) setEmail("");
      await load();
    } catch (err) {
      const e = err as { message?: string };
      if (e.message?.startsWith("LIMITE_PLAN")) toastDbError(err, "No se pudo invitar.");
      else toast.error(errorMessage(err, "No se pudo enviar la invitación."));
    } finally {
      setBusy(false);
    }
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Escribe un email válido.");
      return;
    }
    sendInvite(email, role);
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(invitationLink(token));
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar. Inténtalo de nuevo.");
    }
  }

  async function cancelInvite(inv: Invitation) {
    try {
      await revokeInvitation(inv.id);
      toast.success("Invitación cancelada.");
      await load();
    } catch {
      toast.error("No se pudo cancelar la invitación.");
    }
  }

  async function changeRole(m: Member, r: InviteRole) {
    if (!wsId) return;
    try {
      await changeMemberRole(wsId, m.userId, r);
      toast.success("Rol actualizado.");
      await load();
    } catch {
      toast.error("No se pudo cambiar el rol.");
    }
  }

  async function remove(m: Member) {
    if (!wsId) return;
    const who = m.fullName || m.email || "esta persona";
    if (!window.confirm(`¿Quitar a ${who} de ${wsName}? Perderá el acceso a este negocio.`)) return;
    try {
      await removeMember(wsId, m.userId);
      toast.success("Miembro eliminado.");
      await load();
    } catch {
      toast.error("No se pudo eliminar al miembro.");
    }
  }

  async function leave() {
    if (!wsId || !user) return;
    if (!window.confirm(`¿Salir de ${wsName}? Dejarás de ver sus datos.`)) return;
    try {
      await removeMember(wsId, user.id);
      toast.success("Saliste del negocio.");
      await reload();
      router.push("/");
    } catch {
      toast.error("No se pudo salir del negocio.");
    }
  }

  const me = members.find((m) => m.userId === user?.id);

  return (
    <div className="pb-8">
      <AppHeader />
      <div className="flex flex-col gap-4 px-4 pt-5">
        <h1 className="text-xl font-semibold tracking-tight">Equipo</h1>

        {isAdmin ? (
          <form onSubmit={handleInvite} className={`${cardClass} flex flex-col gap-3`}>
            <h2 className="text-sm font-semibold">Invitar a alguien</h2>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                placeholder="persona@correo.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Rol</label>
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as InviteRole)}>
                {INVITE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {ROLE_LABELS[r.value]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
                {INVITE_ROLES.find((r) => r.value === role)?.description}
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-brand rounded-xl py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(138,5,190,0.35)] transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Enviando..." : "Enviar invitación"}
            </button>
            <p className="text-xs text-[var(--color-text-faint)]">
              El email de invitación se envía automáticamente. También puedes compartir el enlace por WhatsApp desde las
              invitaciones pendientes.
            </p>
          </form>
        ) : null}

        <section className={cardClass}>
          <h2 className="mb-3 text-sm font-semibold">Miembros</h2>
          {loading ? (
            <p className="text-sm text-[var(--color-text-faint)]">Cargando...</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {members.map((m) => {
                const isMe = m.userId === user?.id;
                const editable = isAdmin && !isMe && m.role !== "owner";
                return (
                  <li key={m.userId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.fullName || m.email || "Sin nombre"}
                          {isMe ? <span className="ml-1.5 text-xs text-[var(--color-brand-light)]">Tú</span> : null}
                        </p>
                        {m.fullName && m.email ? (
                          <p className="truncate text-xs text-[var(--color-text-faint)]">{m.email}</p>
                        ) : null}
                      </div>
                      {!editable ? <span className={chipClass}>{ROLE_LABELS[m.role]}</span> : null}
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Cambiar rol"
                          className={`${inputClass} !py-2`}
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value as InviteRole)}
                        >
                          {INVITE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {ROLE_LABELS[r.value]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => remove(m)}
                          aria-label="Quitar del negocio"
                          className="shrink-0 rounded-xl border border-[var(--color-border)] p-2.5 text-[var(--color-text-faint)] transition hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isAdmin && invites.length > 0 ? (
          <section className={cardClass}>
            <h2 className="mb-3 text-sm font-semibold">Invitaciones pendientes</h2>
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm">{inv.email}</p>
                    <span className={chipClass}>{ROLE_LABELS[inv.role]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button type="button" onClick={() => copyLink(inv.token)} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5">
                      <Copy size={13} /> Copiar enlace
                    </button>
                    <a
                      href={whatsappInviteUrl(wsName, inv.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                    <button type="button" disabled={busy} onClick={() => sendInvite(inv.email, inv.role, true)} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5">
                      <RefreshCw size={13} /> Reenviar
                    </button>
                    <button type="button" onClick={() => cancelInvite(inv)} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-red-400">
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {me && me.role !== "owner" ? (
          <button
            type="button"
            onClick={leave}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] py-3 text-sm font-medium text-red-400"
          >
            <LogOut size={16} /> Salir del negocio
          </button>
        ) : null}
      </div>
    </div>
  );
}
