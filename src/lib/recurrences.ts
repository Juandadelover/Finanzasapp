import { createClient } from "@/lib/supabase/client";
import type { TransactionType } from "@/types/finance";

export type Frequency = "weekly" | "monthly" | "yearly";

export interface Recurrence {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  contactId: string | null;
  description: string;
  frequency: Frequency;
  startDate: string;
  nextDate: string;
  occurrences: number;
  endDate: string | null;
  generatedStatus: "pending" | "paid";
  active: boolean;
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Cada semana",
  monthly: "Cada mes",
  yearly: "Cada año",
};

export interface RecurrenceRow {
  id: string;
  type: TransactionType;
  amount: number | string;
  category_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  description: string;
  frequency: Frequency;
  start_date: string;
  next_date: string;
  occurrences: number;
  end_date: string | null;
  generated_status: "pending" | "paid";
  active: boolean;
}

export function mapRecurrence(r: RecurrenceRow): Recurrence {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    categoryId: r.category_id,
    accountId: r.account_id,
    contactId: r.contact_id,
    description: r.description,
    frequency: r.frequency,
    startDate: r.start_date,
    nextDate: r.next_date,
    occurrences: r.occurrences,
    endDate: r.end_date,
    generatedStatus: r.generated_status,
    active: r.active,
  };
}

export interface NewRecurrence {
  workspaceId: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  contactId: string | null;
  description: string;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  generatedStatus: "pending" | "paid";
}

/** Crea la recurrencia y genera de inmediato lo vencido (incluida la primera ocurrencia). */
export async function createRecurrence(input: NewRecurrence): Promise<{ error: unknown | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("recurrences").insert({
    workspace_id: input.workspaceId,
    type: input.type,
    amount: input.amount,
    category_id: input.categoryId,
    account_id: input.accountId,
    contact_id: input.contactId,
    description: input.description,
    frequency: input.frequency,
    start_date: input.startDate,
    next_date: input.startDate,
    end_date: input.endDate,
    generated_status: input.generatedStatus,
  });
  if (error) return { error };
  const run = await supabase.rpc("run_recurrences", { p_workspace: input.workspaceId });
  return { error: run.error };
}

export async function runRecurrences(workspaceId: string) {
  return createClient().rpc("run_recurrences", { p_workspace: workspaceId });
}
