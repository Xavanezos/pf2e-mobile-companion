import { describe, it, expect } from "vitest";
import { desiredNoCanvas } from "../src/foundry/mobile";

describe("desiredNoCanvas", () => {
  it("canvas renderer wants the canvas ON (noCanvas false)", () => {
    expect(desiredNoCanvas("canvas")).toBe(false);
  });
  it("lite renderer wants the canvas OFF (noCanvas true)", () => {
    expect(desiredNoCanvas("lite")).toBe(true);
  });
});
