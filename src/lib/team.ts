import { createClient } from "@/lib/supabase/client";
import type { WorkspaceRole } from "@/types/finance";

export type InviteRole = Exclude<WorkspaceRole, "owner">;
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Member {
  userId: string;
  role: WorkspaceRole;
  fullName: string | null;
  email: string | null;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: InviteRole;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationInfo {
  workspace: string;
  role: InviteRole;
  email: string;
  status: InvitationStatus;
}

export const INVITE_ROLES: { value: InviteRole; description: string }[] = [
  { value: "admin", description: "Gestiona el equipo y todos los movimientos." },
  { value: "editor", description: "Registra y edita ingresos, gastos y categorías." },
  { value: "accountant", description: "Solo consulta y revisa reportes (no modifica)." },
  { value: "recorder", description: "Solo registra gastos, sin ver ni editar lo demás." },
];

export function invitationLink(token: string): string {
  return `${window.location.origin}/invitacion/${token}`;
}

export function whatsappInviteUrl(workspaceName: string, token: string): string {
  const text = `Te invito a colaborar en "${workspaceName}" en Finanzasapp: ${invitationLink(token)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Mensaje de error legible (las funciones SQL lanzan mensajes en español). */
export function errorMessage(error: unknown, fallback: string): string {
  const msg = (error as { message?: string } | null)?.message;
  return msg && !msg.startsWith("LIMITE_PLAN") && !/^(new row|permission|duplicate|JWT)/i.test(msg) ? msg : fallback;
}

export async function fetchMembers(workspaceId: string): Promise<Member[]> {
  const { data, error } = await createClient().rpc("workspace_members", { p_workspace: workspaceId });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    userId: r.user_id as string,
    role: r.role as WorkspaceRole,
    fullName: (r.full_name as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    joinedAt: r.joined_at as string,
  }));
}

export async function fetchPendingInvitations(workspaceId: string): Promise<Invitation[]> {
  const { data, error } = await createClient()
    .from("invitations")
    .select("id, email, role, token, status, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: r.role as InviteRole,
    token: r.token as string,
    status: r.status as InvitationStatus,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  }));
}

export async function inviteMember(workspaceId: string, email: string, role: InviteRole): Promise<Invitation> {
  const { data, error } = await createClient().rpc("invite_member", {
    p_workspace: workspaceId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    email: r.email as string,
    role: r.role as InviteRole,
    token: r.token as string,
    status: r.status as InvitationStatus,
    expiresAt: r.expires_at as string,
    createdAt: r.created_at as string,
  };
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await createClient().from("invitations").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
}

export async function changeMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
  const { error } = await createClient()
    .from("memberships")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await createClient()
    .from("memberships")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getInvitation(token: string): Promise<InvitationInfo | null> {
  const { data, error } = await createClient().rpc("get_invitation", { p_token: token });
  if (error || !data) return null;
  return data as InvitationInfo;
}

export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await createClient().rpc("accept_invitation", { p_token: token });
  if (error) throw error;
  return data as string;
}
