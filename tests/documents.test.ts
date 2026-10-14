import { describe, expect, it } from "vitest";
import { computeTotal, formatDocNumber, whatsappNumber } from "@/lib/documents";

describe("documents helpers", () => {
  it("formatDocNumber pads to 4 digits", () => {
    expect(formatDocNumber(7)).toBe("N.º 0007");
    expect(formatDocNumber(12345)).toBe("N.º 12345");
  });
  it("computeTotal sums quantity * unit price", () => {
    expect(computeTotal([])).toBe(0);
    expect(computeTotal([
      { description: "a", quantity: 2, unitPrice: 1500 },
      { description: "b", quantity: 1, unitPrice: 500 },
    ])).toBe(3500);
  });
  it("whatsappNumber rules", () => {
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber(undefined)).toBeNull();
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("---")).toBeNull();
    expect(whatsappNumber("300-123-4567")).toBe("573001234567");
    expect(whatsappNumber("+57 300 123 4567")).toBe("573001234567");
  });
});
