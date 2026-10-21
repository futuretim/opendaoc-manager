import { describe, expect, it } from "vitest";
import {
  DEFAULT_START_LEVEL,
  DISABLED_LEVEL,
  MAX_PLAYER_LEVEL,
  isLossEnabled,
  parseStartLevel,
  targetValueFor,
} from "./deathXpLoss.js";

describe("parseStartLevel", () => {
  it("parses stored byte values", () => {
    expect(parseStartLevel("6")).toBe(6);
    expect(parseStartLevel("0")).toBe(0);
    expect(parseStartLevel(" 50 ")).toBe(50);
  });

  it("falls back to the default for unparseable values", () => {
    expect(parseStartLevel("")).toBe(DEFAULT_START_LEVEL);
    expect(parseStartLevel("n/a")).toBe(DEFAULT_START_LEVEL);
  });

  it("clamps to the byte range", () => {
    expect(parseStartLevel("-5")).toBe(0);
    expect(parseStartLevel("999")).toBe(255);
  });
});

describe("isLossEnabled", () => {
  it("is enabled for levels a character can reach", () => {
    expect(isLossEnabled(1)).toBe(true);
    expect(isLossEnabled(DEFAULT_START_LEVEL)).toBe(true);
    expect(isLossEnabled(MAX_PLAYER_LEVEL)).toBe(true);
  });

  it("is disabled once the threshold is above the max level", () => {
    expect(isLossEnabled(MAX_PLAYER_LEVEL + 1)).toBe(false);
    expect(isLossEnabled(DISABLED_LEVEL)).toBe(false);
  });
});

describe("targetValueFor", () => {
  it("writes the sentinel when disabling (ignoring any start level)", () => {
    expect(targetValueFor({ enabled: false })).toBe(String(DISABLED_LEVEL));
    expect(targetValueFor({ enabled: false, startLevel: 6 })).toBe(String(DISABLED_LEVEL));
  });

  it("writes the server default when enabling without a level", () => {
    expect(targetValueFor({ enabled: true })).toBe(String(DEFAULT_START_LEVEL));
  });

  it("writes a chosen start level within range", () => {
    expect(targetValueFor({ enabled: true, startLevel: 1 })).toBe("1");
    expect(targetValueFor({ enabled: true, startLevel: MAX_PLAYER_LEVEL })).toBe(String(MAX_PLAYER_LEVEL));
  });

  it("rejects an out-of-range or non-integer start level when enabling", () => {
    expect(targetValueFor({ enabled: true, startLevel: 0 })).toBeNull();
    expect(targetValueFor({ enabled: true, startLevel: MAX_PLAYER_LEVEL + 1 })).toBeNull();
    expect(targetValueFor({ enabled: true, startLevel: 5.5 })).toBeNull();
  });
});
