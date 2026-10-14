import { describe, expect, it } from "vitest";
import { formatAmount, parseAmountInput, toISODate, isSameMonth } from "@/lib/format";

const norm = (s: string) => s.replace(/ /g, " ");

describe("formatAmount", () => {
  it("formats COP with symbol and thousands separator", () => {
    expect(norm(formatAmount(1234567))).toBe("$ 1.234.567");
  });
  it("keeps the minus sign on negatives", () => {
    expect(norm(formatAmount(-50000))).toBe("-$ 50.000");
    expect(norm(formatAmount(-50000, "COP", { signed: true }))).toBe("-$ 50.000");
  });
  it("adds + when signed and positive", () => {
    expect(norm(formatAmount(2500, "COP", { signed: true }))).toBe("+$ 2.500");
  });
  it("does not sign zero or amounts rounding to zero", () => {
    expect(norm(formatAmount(0, "COP", { signed: true }))).toBe("$ 0");
    expect(norm(formatAmount(-0.4))).toBe("$ 0");
  });
  it("rounds to whole units", () => {
    expect(norm(formatAmount(1999.6))).toBe("$ 2.000");
    expect(norm(formatAmount(10.4))).toBe("$ 10");
  });
  it("can hide the symbol and uses other currencies", () => {
    expect(norm(formatAmount(1000, "COP", { showSymbol: false }))).toBe("1.000");
    expect(norm(formatAmount(1000, "USD"))).toBe("US$ 1,000");
  });
});

describe("helpers", () => {
  it("parseAmountInput strips non digits", () => {
    expect(parseAmountInput("$ 1.234.567")).toBe(1234567);
    expect(parseAmountInput("")).toBe(0);
  });
  it("toISODate / isSameMonth", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(isSameMonth("2026-03-15", 2026, 2)).toBe(true);
    expect(isSameMonth("2026-03-15", 2026, 3)).toBe(false);
  });
});
