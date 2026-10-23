import { describe, expect, it } from "vitest";
import { permissionsFor, ROLE_LABELS } from "@/lib/permissions";

describe("permissionsFor", () => {
  it("owner can do everything", () => {
    expect(Object.values(permissionsFor("owner")).every(Boolean)).toBe(true);
  });
  it("admin and editor: all but reset", () => {
    for (const r of ["admin", "editor"] as const) {
      const p = permissionsFor(r);
      expect(p).toMatchObject({ canCreateIncome: true, canCreateExpense: true, canEditTransactions: true, canManageCategories: true, canImport: true, canResetData: false });
    }
  });
  it("recorder only creates expenses (and receives stock without cost, and sells)", () => {
    const p = permissionsFor("recorder");
    expect(p.canCreateExpense).toBe(true);
    expect(Object.entries(p).filter(([k, v]) => v && k !== "canCreateExpense").map(([k]) => k)).toEqual(["canReceiveStock", "canSell"]);
  });
  it("accountant and null are read-only", () => {
    expect(Object.entries(permissionsFor("accountant")).filter(([k, v]) => v && k !== "canViewCosts")).toEqual([]);
    expect(Object.values(permissionsFor(null)).some(Boolean)).toBe(false);
  });
  it("inventory permissions follow the spec table", () => {
    const keys = ["canViewCosts", "canManageProducts", "canReceiveStock", "canReceiveWithCost", "canAdjustStock", "canImportProducts"] as const;
    const pick = (r: Parameters<typeof permissionsFor>[0]) => Object.fromEntries(keys.map((k) => [k, permissionsFor(r)[k]]));
    const all = { canViewCosts: true, canManageProducts: true, canReceiveStock: true, canReceiveWithCost: true, canAdjustStock: true, canImportProducts: true };
    expect(pick("owner")).toEqual(all);
    expect(pick("admin")).toEqual(all);
    expect(pick("editor")).toEqual({ ...all, canAdjustStock: false });
    expect(pick("accountant")).toEqual({ canViewCosts: true, canManageProducts: false, canReceiveStock: false, canReceiveWithCost: false, canAdjustStock: false, canImportProducts: false });
    expect(pick("recorder")).toEqual({ canViewCosts: false, canManageProducts: false, canReceiveStock: true, canReceiveWithCost: false, canAdjustStock: false, canImportProducts: false });
    expect(pick(null)).toEqual({ canViewCosts: false, canManageProducts: false, canReceiveStock: false, canReceiveWithCost: false, canAdjustStock: false, canImportProducts: false });
  });
  it("pos permissions follow the spec", () => {
    const keys = ["canSell", "canVoidSale", "canManagePosSettings"] as const;
    const pick = (r: Parameters<typeof permissionsFor>[0]) => Object.fromEntries(keys.map((k) => [k, permissionsFor(r)[k]]));
    const admin = { canSell: true, canVoidSale: true, canManagePosSettings: true };
    expect(pick("owner")).toEqual(admin);
    expect(pick("admin")).toEqual(admin);
    expect(pick("editor")).toEqual({ canSell: true, canVoidSale: false, canManagePosSettings: false });
    expect(pick("recorder")).toEqual({ canSell: true, canVoidSale: false, canManagePosSettings: false });
    const none = { canSell: false, canVoidSale: false, canManagePosSettings: false };
    expect(pick("accountant")).toEqual(none);
    expect(pick(null)).toEqual(none);
  });
  it("has labels for all roles", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(["accountant", "admin", "editor", "owner", "recorder"]);
  });
});
