import { signOutAndReset } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

export interface AccountProfile {
  full_name: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  deletion_requested_at: string | null;
}

export async function fetchProfile(userId: string): Promise<AccountProfile | null> {
  const { data } = await createClient()
    .from("profiles")
    .select("full_name, terms_accepted_at, terms_version, deletion_requested_at")
    .eq("id", userId)
    .maybeSingle();
  return (data as AccountProfile | null) ?? null;
}

export async function updateFullName(userId: string, name: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) return false;
  await supabase.auth.updateUser({ data: { full_name: name } });
  return true;
}

export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await createClient().auth.updateUser({ password });
  return error ? error.message : null;
}

export async function acceptTerms(version: string): Promise<boolean> {
  const { error } = await createClient().rpc("accept_terms", { p_version: version });
  return !error;
}

/** Devuelve la fecha de la solicitud (ISO) o null si se canceló. La eliminación ocurre 30 días después. */
export async function requestAccountDeletion(
  cancel = false,
): Promise<{ ok: boolean; date: string | null }> {
  const { data, error } = await createClient().rpc("request_account_deletion", { p_cancel: cancel });
  if (error) return { ok: false, date: null };
  return { ok: true, date: (data as string | null) ?? null };
}

export async function signOutEverywhere(): Promise<void> {
  await signOutAndReset("global");
}

export function deletionDate(requestedAt: string): Date {
  const d = new Date(requestedAt);
  d.setDate(d.getDate() + 30);
  return d;
}

export function formatLongDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
