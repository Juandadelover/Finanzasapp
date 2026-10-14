import { describe, expect, it } from "vitest";
import { isPlanLimitError, planLimitMessage, PLAN_LIMIT_MESSAGES } from "@/lib/subscription";

describe("plan limit errors", () => {
  it("detects LIMITE_PLAN in strings, Errors and PostgREST-like objects", () => {
    expect(isPlanLimitError("LIMITE_PLAN:max_tx_per_month")).toBe(true);
    expect(isPlanLimitError(new Error("LIMITE_PLAN:max_members"))).toBe(true);
    expect(isPlanLimitError({ message: "x LIMITE_PLAN:max_members y", code: "P0001" })).toBe(true);
  });
  it("is false for other errors / empty", () => {
    expect(isPlanLimitError(null)).toBe(false);
    expect(isPlanLimitError(undefined)).toBe(false);
    expect(isPlanLimitError({ message: "boom" })).toBe(false);
    expect(isPlanLimitError(42)).toBe(false);
  });
  it("maps limit key to a message, with a default", () => {
    expect(planLimitMessage({ message: "LIMITE_PLAN:max_tx_per_month" })).toBe(PLAN_LIMIT_MESSAGES.max_tx_per_month);
    expect(planLimitMessage("LIMITE_PLAN:max_workspaces_owned")).toBe(PLAN_LIMIT_MESSAGES.max_workspaces_owned);
    expect(planLimitMessage("LIMITE_PLAN:unknown_key")).toBe("Llegaste al límite de tu plan actual.");
    expect(planLimitMessage(null)).toBe("Llegaste al límite de tu plan actual.");
  });
});
