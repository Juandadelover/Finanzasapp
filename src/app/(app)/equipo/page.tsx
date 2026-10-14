"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, MessageCircle, RefreshCw, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button, buttonClass } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
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
  "w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-base outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]";
const cardClass = "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const chipClass =
  "shrink-0 rounded-full bg-[var(--color-brand)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-light)]";

export default function EquipoPage() {
  const { currentWorkspace, user, reload } = useFinance();
  const router = useRouter();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
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
      setLoadError(false);
    } catch {
      setLoadError(true);
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
      setEmailError("Escribe un email válido, por ejemplo persona@correo.com.");
      return;
    }
    setEmailError(null);
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
    const ok = await confirm({
      title: `¿Quitar a ${who}?`,
      description: `Perderá el acceso a ${wsName || "este negocio"}. Puedes invitarle de nuevo después.`,
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: `¿Salir de ${wsName || "este negocio"}?`,
      description: "Dejarás de ver sus datos. Para volver necesitarás una nueva invitación.",
      confirmLabel: "Salir del negocio",
      destructive: true,
    });
    if (!ok) return;
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
      <PageHeader
        title="Equipo"
        subtitle={wsName ? `Personas con acceso a ${wsName}` : undefined}
        backHref="/ajustes"
        backLabel="Ajustes"
      />
      <div className="mx-4 mt-4 flex flex-col gap-4">
        {isAdmin ? (
          <form onSubmit={handleInvite} noValidate className={`${cardClass} flex flex-col gap-3`}>
            <h2 className="text-sm font-semibold">Invitar a alguien</h2>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                className={inputClass}
                value={email}
                placeholder="persona@correo.com"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "invite-email-error" : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
              />
              {emailError ? (
                <span id="invite-email-error" role="alert" className="mt-1.5 block text-sm text-[var(--color-expense)]">
                  {emailError}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className={labelClass}>Rol</span>
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as InviteRole)}>
                {INVITE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {ROLE_LABELS[r.value]}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">
                {INVITE_ROLES.find((r) => r.value === role)?.description}
              </span>
            </label>
            <Button type="submit" loading={busy} fullWidth>
              {busy ? "Enviando..." : "Enviar invitación"}
            </Button>
            <p className="text-xs text-[var(--color-text-muted)]">
              Enviamos la invitación por email. También puedes compartir el enlace por WhatsApp desde las invitaciones
              pendientes.
            </p>
          </form>
        ) : null}

        <section className={cardClass} aria-labelledby="miembros-title">
          <h2 id="miembros-title" className="mb-3 text-sm font-semibold">
            Miembros
          </h2>
          {loading ? (
            <SkeletonList count={3} />
          ) : loadError ? (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                No pudimos cargar el equipo. Revisa tu conexión e intenta de nuevo.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                <RefreshCw size={14} aria-hidden /> Reintentar
              </Button>
            </div>
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="Todavía no hay miembros" description="Invita a alguien para trabajar juntos." />
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
                          <p className="truncate text-xs text-[var(--color-text-muted)]">{m.email}</p>
                        ) : null}
                      </div>
                      {!editable ? <span className={chipClass}>{ROLE_LABELS[m.role]}</span> : null}
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Rol de ${m.fullName || m.email || "este miembro"}`}
                          className={inputClass}
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value as InviteRole)}
                        >
                          {INVITE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {ROLE_LABELS[r.value]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="danger"
                          onClick={() => remove(m)}
                          aria-label={`Quitar a ${m.fullName || m.email || "este miembro"} del negocio`}
                          className="w-11 shrink-0 !px-0"
                        >
                          <Trash2 size={16} aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isAdmin && invites.length > 0 ? (
          <section className={cardClass} aria-labelledby="pendientes-title">
            <h2 id="pendientes-title" className="mb-3 text-sm font-semibold">
              Invitaciones pendientes
            </h2>
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm">{inv.email}</p>
                    <span className={chipClass}>{ROLE_LABELS[inv.role]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => copyLink(inv.token)}>
                      <Copy size={14} aria-hidden /> Copiar enlace
                    </Button>
                    <a
                      href={whatsappInviteUrl(wsName, inv.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      <MessageCircle size={14} aria-hidden /> WhatsApp
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => sendInvite(inv.email, inv.role, true)}
                    >
                      <RefreshCw size={14} aria-hidden /> Reenviar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => cancelInvite(inv)}>
                      <X size={14} aria-hidden /> Cancelar invitación
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {me && me.role !== "owner" ? (
          <Button variant="danger" onClick={leave} fullWidth>
            <LogOut size={16} aria-hidden /> Salir del negocio
          </Button>
        ) : null}
      </div>
    </div>
  );
}
