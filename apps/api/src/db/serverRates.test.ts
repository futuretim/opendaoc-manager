import { describe, expect, it } from "vitest";
import { MAX_XP_MULTIPLIER, normalizeMultiplier, parseMultiplier } from "./serverRates.js";

describe("normalizeMultiplier", () => {
  it("accepts whole numbers and drops a trailing .0", () => {
    expect(normalizeMultiplier(2)).toBe("2");
    expect(normalizeMultiplier("2.0")).toBe("2");
    expect(normalizeMultiplier(0)).toBe("0");
  });

  it("keeps meaningful decimals and trims surrounding whitespace", () => {
    expect(normalizeMultiplier("2.5")).toBe("2.5");
    expect(normalizeMultiplier("  1.25 ")).toBe("1.25");
    expect(normalizeMultiplier(0.5)).toBe("0.5");
  });

  it("allows the boundary values 0 and the max", () => {
    expect(normalizeMultiplier(0)).toBe("0");
    expect(normalizeMultiplier(MAX_XP_MULTIPLIER)).toBe(String(MAX_XP_MULTIPLIER));
  });

  it("rejects negatives, out-of-range, and non-numeric input", () => {
    expect(normalizeMultiplier(-1)).toBeNull();
    expect(normalizeMultiplier(MAX_XP_MULTIPLIER + 1)).toBeNull();
    expect(normalizeMultiplier("fast")).toBeNull();
    expect(normalizeMultiplier("")).toBeNull();
    expect(normalizeMultiplier(Infinity)).toBeNull();
    expect(normalizeMultiplier(NaN)).toBeNull();
  });
});

describe("parseMultiplier", () => {
  it("parses stored decimal strings", () => {
    expect(parseMultiplier("2.5")).toBe(2.5);
    expect(parseMultiplier("1")).toBe(1);
  });

  it("falls back to 0 for unparseable values", () => {
    expect(parseMultiplier("")).toBe(0);
    expect(parseMultiplier("n/a")).toBe(0);
  });
});
