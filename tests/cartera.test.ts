import { describe, expect, it } from "vitest";
import { agingBucket, daysBetween, daysOverdue, dueLabel, sortByDueDate, sumAmount, whatsappUrl } from "@/lib/cartera";
import type { Transaction } from "@/types/finance";

const TODAY = "2026-10-14";

describe("aging", () => {
  it("daysBetween / daysOverdue", () => {
    expect(daysBetween("2026-10-01", "2026-10-14")).toBe(13);
    expect(daysOverdue(null, TODAY)).toBe(0);
    expect(daysOverdue("2026-10-04", TODAY)).toBe(10);
  });
  it.each([
    [null, "current"], ["2026-10-14", "current"], ["2026-11-01", "current"],
    ["2026-10-13", "d1_30"], ["2026-09-14", "d1_30"],
    ["2026-09-13", "d31_60"], ["2026-08-15", "d31_60"],
    ["2026-08-14", "d61_90"], ["2026-07-16", "d61_90"],
    ["2026-07-15", "d90p"], ["2025-01-01", "d90p"],
  ])("agingBucket(%s) = %s", (due, bucket) => {
    expect(agingBucket(due, TODAY)).toBe(bucket);
  });
});

describe("dueLabel", () => {
  it("covers every case", () => {
    expect(dueLabel(null, TODAY)).toBe("Sin fecha de vencimiento");
    expect(dueLabel("2026-10-14", TODAY)).toBe("Vence hoy");
    expect(dueLabel("2026-10-15", TODAY)).toBe("Vence en 1 día");
    expect(dueLabel("2026-10-20", TODAY)).toBe("Vence en 6 días");
    expect(dueLabel("2026-10-13", TODAY)).toBe("Vencido hace 1 día");
    expect(dueLabel("2026-10-04", TODAY)).toBe("Vencido hace 10 días");
  });
});

describe("sorting and sums", () => {
  const t = (id: string, dueDate: string | null, date: string, amount = 10): Transaction => ({
    id, type: "income", amount, categoryId: "c", description: "", date, createdAt: "", accountId: null, contactId: null, status: "pending", dueDate,
  });
  it("sortByDueDate puts dated first, then by date, without mutating", () => {
    const input = [t("a", null, "2026-01-02"), t("b", "2026-05-01", "2026-01-01"), t("c", null, "2026-01-01"), t("d", "2026-04-01", "2026-01-01")];
    expect(sortByDueDate(input).map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
    expect(input[0].id).toBe("a");
    expect(sumAmount(input)).toBe(40);
  });
});

describe("whatsappUrl", () => {
  it("adds 57 to a 10-digit number", () => {
    expect(whatsappUrl("300 123 4567", "hola")).toBe("https://wa.me/573001234567?text=hola");
  });
  it("keeps a number already prefixed with 57 (12 digits)", () => {
    expect(whatsappUrl("+57 300 123 4567", "x")).toBe("https://wa.me/573001234567?text=x");
  });
  it("returns null for empty/no digits", () => {
    expect(whatsappUrl("", "x")).toBeNull();
    expect(whatsappUrl("abc", "x")).toBeNull();
  });
  it("encodes the message", () => {
    expect(whatsappUrl("3001234567", "Hola & adiós")).toContain("text=Hola%20%26%20adi%C3%B3s");
  });
});
