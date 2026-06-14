import { describe, it, expect } from "vitest";
import { fontScalePx } from "../src/foundry/mobile";

describe("fontScalePx", () => {
  it("maps each scale to a root pixel size", () => {
    expect(fontScalePx("small")).toBe(14);
    expect(fontScalePx("medium")).toBe(16);
    expect(fontScalePx("large")).toBe(18);
  });
  it("falls back to medium for an unknown value", () => {
    expect(fontScalePx("huge" as any)).toBe(16);
  });
});
