import type { WorkspaceRole } from "@/types/finance";

// Mirrors the RLS policies in supabase/migrations/*_workspaces_roles_billing.sql.
// The database is the source of truth; this only decides what the UI offers.
export interface Permissions {
  canCreateIncome: boolean;
  canCreateExpense: boolean;
  canEditTransactions: boolean;
  canManageCategories: boolean;
  canImport: boolean;
  canResetData: boolean;
}

const NONE: Permissions = {
  canCreateIncome: false,
  canCreateExpense: false,
  canEditTransactions: false,
  canManageCategories: false,
  canImport: false,
  canResetData: false,
};

export function permissionsFor(role: WorkspaceRole | null): Permissions {
  switch (role) {
    case "owner":
      return {
        canCreateIncome: true,
        canCreateExpense: true,
        canEditTransactions: true,
        canManageCategories: true,
        canImport: true,
        canResetData: true,
      };
    case "admin":
    case "editor":
      return { ...NONE, canCreateIncome: true, canCreateExpense: true, canEditTransactions: true, canManageCategories: true, canImport: true };
    case "recorder":
      return { ...NONE, canCreateExpense: true };
    default:
      return NONE;
  }
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  editor: "Editor",
  accountant: "Contador",
  recorder: "Solo registro",
};
