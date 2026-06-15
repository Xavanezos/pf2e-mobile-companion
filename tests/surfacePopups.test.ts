import { describe, it, expect } from "vitest";
import { shouldSurface, type PopupCandidate } from "../src/foundry/surfacePopups";

const framedDialog: PopupCandidate = { isWindow: true, framed: true, inOwnRoot: false, surfaced: false };

describe("shouldSurface", () => {
  it("hoists a framed popout window that isn't ours and isn't surfaced yet", () => {
    expect(shouldSurface(framedDialog)).toBe(true);
  });

  it("leaves frameless docked widgets alone (e.g. SmallTime, scene controls)", () => {
    expect(shouldSurface({ ...framedDialog, framed: false })).toBe(false);
  });

  it("ignores non-window elements", () => {
    expect(shouldSurface({ ...framedDialog, isWindow: false })).toBe(false);
  });

  it("never hoists our own React popups", () => {
    expect(shouldSurface({ ...framedDialog, inOwnRoot: true })).toBe(false);
  });

  it("skips an already-surfaced window (no re-hoist loop)", () => {
    expect(shouldSurface({ ...framedDialog, surfaced: true })).toBe(false);
  });
});
