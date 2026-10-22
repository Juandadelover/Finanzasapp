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
  // Inventario (ver spec 2026-10-22-inventario-design.md, tabla de permisos)
  canViewCosts: boolean;
  canManageProducts: boolean;
  canReceiveStock: boolean;
  canReceiveWithCost: boolean;
  canAdjustStock: boolean;
  canImportProducts: boolean;
  // Venta POS (spec 2026-10-22-pos-ventas-design.md, P5)
  canSell: boolean;
  canVoidSale: boolean;
  canManagePosSettings: boolean;
}

const NONE: Permissions = {
  canCreateIncome: false,
  canCreateExpense: false,
  canEditTransactions: false,
  canManageCategories: false,
  canImport: false,
  canResetData: false,
  canViewCosts: false,
  canManageProducts: false,
  canReceiveStock: false,
  canReceiveWithCost: false,
  canAdjustStock: false,
  canImportProducts: false,
  canSell: false,
  canVoidSale: false,
  canManagePosSettings: false,
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
        canViewCosts: true,
        canManageProducts: true,
        canReceiveStock: true,
        canReceiveWithCost: true,
        canAdjustStock: true,
        canImportProducts: true,
        canSell: true,
        canVoidSale: true,
        canManagePosSettings: true,
      };
    case "admin":
      return {
        ...NONE,
        canCreateIncome: true,
        canCreateExpense: true,
        canEditTransactions: true,
        canManageCategories: true,
        canImport: true,
        canViewCosts: true,
        canManageProducts: true,
        canReceiveStock: true,
        canReceiveWithCost: true,
        canAdjustStock: true,
        canImportProducts: true,
        canSell: true,
        canVoidSale: true,
        canManagePosSettings: true,
      };
    case "editor":
      return {
        ...NONE,
        canCreateIncome: true,
        canCreateExpense: true,
        canEditTransactions: true,
        canManageCategories: true,
        canImport: true,
        canViewCosts: true,
        canManageProducts: true,
        canReceiveStock: true,
        canReceiveWithCost: true,
        canImportProducts: true,
        canSell: true,
      };
    case "accountant":
      return { ...NONE, canViewCosts: true };
    case "recorder":
      return { ...NONE, canCreateExpense: true, canReceiveStock: true, canSell: true };
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
