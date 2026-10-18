import { describe, expect, it } from "vitest";
import { CREDIT_BUDGET_USD, estimateUsd } from "./credits";

describe("budget", () => {
  it("covers about 1.33 million paid bytes with $20", () => {
    const bytes = Math.round((CREDIT_BUDGET_USD / 15) * 1_000_000);
    expect(bytes).toBe(1_333_333);
    expect(estimateUsd("s2.1-pro", bytes)).toBeCloseTo(20, 5);
  });
});
