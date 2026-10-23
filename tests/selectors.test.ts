import { describe, expect, it } from "vitest";
import {
  accountBalances,
  accountStatement,
  budgetProgress,
  categoryBreakdown,
  computeTotals,
  hasEnoughHistoryForProjection,
  PROJECTION_MIN_HISTORY_DAYS,
} from "@/lib/selectors";
import type { Account, Category, Transaction, Transfer } from "@/types/finance";

let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: "expense", amount: 0, categoryId: "c1", description: "", date: "2026-10-01",
  createdAt: "2026-10-01T00:00:00Z", accountId: null, contactId: null, status: "paid", dueDate: null, ...o,
});
const cat = (o: Partial<Category>): Category => ({
  id: "c1", name: "Cat", icon: "wallet", color: "#000", type: "expense", monthlyBudget: null, ...o,
});
const acc = (o: Partial<Account>): Account => ({ id: "a1", name: "A", kind: "cash", openingBalance: 0, archived: false, ...o });

describe("computeTotals", () => {
  it("sums paid only and ignores pending", () => {
    const r = computeTotals([
      tx({ type: "income", amount: 1000 }),
      tx({ type: "expense", amount: 300 }),
      tx({ type: "income", amount: 9999, status: "pending" }),
      tx({ type: "expense", amount: 8888, status: "pending" }),
    ]);
    expect(r).toEqual({ income: 1000, expense: 300, balance: 700 });
  });
  it("empty is zero", () => {
    expect(computeTotals([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe("categoryBreakdown", () => {
  const cats = [cat({ id: "c1" }), cat({ id: "c2" })];
  it("ignores pending, sorts desc and computes percentages", () => {
    const r = categoryBreakdown(
      [tx({ categoryId: "c1", amount: 100 }), tx({ categoryId: "c2", amount: 300 }), tx({ categoryId: "c1", amount: 5000, status: "pending" })],
      cats, "expense");
    expect(r.map((i) => i.category.id)).toEqual(["c2", "c1"]);
    expect(r[0].percentage).toBe(75);
    expect(r[1].percentage).toBe(25);
  });
  it("skips unknown categories and other type", () => {
    const r = categoryBreakdown([tx({ categoryId: "zzz", amount: 1 }), tx({ type: "income", categoryId: "c1", amount: 5 })], cats, "expense");
    expect(r).toEqual([]);
  });
});

describe("budgetProgress", () => {
  it("only categories with budget, ignoring pending, ordered by usage ratio", () => {
    const cats = [
      cat({ id: "c1", monthlyBudget: 1000 }),
      cat({ id: "c2", monthlyBudget: 100 }),
      cat({ id: "c3", monthlyBudget: null }),
      cat({ id: "c4", type: "income", monthlyBudget: 50 }),
    ];
    const r = budgetProgress(
      [tx({ categoryId: "c1", amount: 500 }), tx({ categoryId: "c2", amount: 90 }), tx({ categoryId: "c2", amount: 999, status: "pending" })],
      cats);
    expect(r.map((i) => [i.category.id, i.spent, i.budget])).toEqual([["c2", 90, 100], ["c1", 500, 1000]]);
  });
});

describe("accountBalances", () => {
  it("combines opening balance, paid movements, pending ignored and transfers", () => {
    const accounts = [acc({ id: "a1", openingBalance: 1000 }), acc({ id: "a2", openingBalance: 0 })];
    const transfers: Transfer[] = [{ id: "x", fromAccountId: "a1", toAccountId: "a2", amount: 200, date: "2026-10-02", description: "" }];
    const r = accountBalances({
      accounts, transfers,
      transactions: [
        tx({ accountId: "a1", type: "income", amount: 500 }),
        tx({ accountId: "a1", type: "expense", amount: 100 }),
        tx({ accountId: "a1", type: "income", amount: 7777, status: "pending" }),
        tx({ accountId: null, type: "income", amount: 5555 }),
      ],
    });
    expect(r.find((b) => b.account.id === "a1")!.balance).toBe(1000 + 500 - 100 - 200);
    expect(r.find((b) => b.account.id === "a2")!.balance).toBe(200);
  });
  it("omits archived accounts from the result but still applies transfers", () => {
    const accounts = [acc({ id: "a1", openingBalance: 100 }), acc({ id: "a2", archived: true, openingBalance: 50 })];
    const r = accountBalances({
      accounts, transactions: [],
      transfers: [{ id: "x", fromAccountId: "a2", toAccountId: "a1", amount: 50, date: "2026-10-02", description: "" }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].balance).toBe(150);
  });
});

describe("accountStatement", () => {
  const accounts = [acc({ id: "a1", openingBalance: 1000 }), acc({ id: "a2", archived: true })];
  const tr = (o: Partial<Transfer>): Transfer => ({
    id: `tr${++n}`, fromAccountId: "a1", toAccountId: "a2", amount: 0, date: "2026-10-01", description: "", ...o,
  });

  it("returns null for an unknown account", () => {
    expect(accountStatement({ accounts, transactions: [], transfers: [] }, "nope")).toBeNull();
  });

  it("matches accountBalances and lists only this account's movements, newest first", () => {
    const transactions = [
      tx({ id: "old", accountId: "a1", type: "income", amount: 500, date: "2026-09-01" }),
      tx({ id: "new", accountId: "a1", type: "expense", amount: 200, date: "2026-10-05" }),
      tx({ id: "pend", accountId: "a1", type: "income", amount: 9999, status: "pending", date: "2026-10-06" }),
      tx({ id: "other", accountId: "a2", type: "income", amount: 77 }),
      tx({ id: "none", accountId: null, type: "income", amount: 55 }),
    ];
    const transfers = [tr({ id: "t-out", amount: 100, date: "2026-10-03" })];
    const s = accountStatement({ accounts, transactions, transfers }, "a1")!;
    expect(s.balance).toBe(1000 + 500 - 200 - 100);
    expect(s.balance).toBe(accountBalances({ accounts, transactions, transfers })[0].balance);
    expect(s.entries.map((e) => (e.kind === "transaction" ? e.transaction.id : e.transfer.id))).toEqual([
      "pend", "new", "t-out", "old",
    ]);
  });

  it("marks transfer direction and works for archived accounts", () => {
    const transfers = [tr({ id: "x", amount: 300 })];
    const s = accountStatement({ accounts, transactions: [], transfers }, "a2")!;
    expect(s.balance).toBe(300);
    expect(s.entries).toEqual([{ kind: "transfer", transfer: transfers[0], direction: "in" }]);
  });
});

describe("hasEnoughHistoryForProjection", () => {
  const today = "2026-10-23";
  it("is false without movements", () => {
    expect(hasEnoughHistoryForProjection([], today)).toBe(false);
  });
  it("is false when the oldest paid movement is recent", () => {
    expect(hasEnoughHistoryForProjection([tx({ date: "2026-10-23" })], today)).toBe(false);
    expect(hasEnoughHistoryForProjection([tx({ date: "2026-10-01" })], today)).toBe(false);
  });
  it("is true once the oldest paid movement is old enough", () => {
    expect(PROJECTION_MIN_HISTORY_DAYS).toBe(30);
    expect(hasEnoughHistoryForProjection([tx({ date: "2026-09-23" })], today)).toBe(true);
    expect(hasEnoughHistoryForProjection([tx({ date: "2026-08-01" }), tx({ date: "2026-10-20" })], today)).toBe(true);
  });
  it("ignores pending movements", () => {
    expect(hasEnoughHistoryForProjection([tx({ date: "2026-08-01", status: "pending" })], today)).toBe(false);
  });
});
