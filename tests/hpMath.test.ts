import { describe, it, expect } from "vitest";
import { hpAfterHeal, hpClamped, parseAmount } from "../src/foundry/actor/hp";

describe("hpAfterHeal", () => {
  it("adds healing but never exceeds max", () => {
    expect(hpAfterHeal(58, 72, 10)).toBe(68);
    expect(hpAfterHeal(70, 72, 10)).toBe(72);
    expect(hpAfterHeal(72, 72, 5)).toBe(72);
  });
});

describe("hpClamped", () => {
  it("clamps an absolute value into [0, max]", () => {
    expect(hpClamped(50, 72)).toBe(50);
    expect(hpClamped(-5, 72)).toBe(0);
    expect(hpClamped(99, 72)).toBe(72);
  });
});

describe("parseAmount", () => {
  it("parses a positive integer, else 0", () => {
    expect(parseAmount("12")).toBe(12);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("-3")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("4.9")).toBe(4);
  });
});
