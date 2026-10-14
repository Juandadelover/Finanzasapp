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
  it("recorder only creates expenses", () => {
    const p = permissionsFor("recorder");
    expect(p.canCreateExpense).toBe(true);
    expect(Object.entries(p).filter(([k, v]) => v && k !== "canCreateExpense")).toEqual([]);
  });
  it("accountant and null are read-only", () => {
    expect(Object.values(permissionsFor("accountant")).some(Boolean)).toBe(false);
    expect(Object.values(permissionsFor(null)).some(Boolean)).toBe(false);
  });
  it("has labels for all roles", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(["accountant", "admin", "editor", "owner", "recorder"]);
  });
});
