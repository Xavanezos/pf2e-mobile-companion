import { describe, it, expect, vi } from "vitest";
import { buildModuleControl } from "../src/foundry/controls/moduleControl";
import type { UiMode, MapRenderer } from "../src/foundry/mobile";

function build(over: Partial<Parameters<typeof buildModuleControl>[0]> = {}) {
  return buildModuleControl({
    uiMode: "auto",
    mapRenderer: "canvas",
    onSelectUiMode: () => {},
    onSelectMapRenderer: () => {},
    ...over,
  });
}

describe("buildModuleControl", () => {
  it("builds one module category with phone icon and five toggle tools", () => {
    const c = build();
    expect(c.name).toBe("pf2e-mobile-companion");
    expect(c.icon).toContain("fa-mobile-screen");
    const tools = Object.keys(c.tools);
    expect(tools).toEqual([
      "uiMode-auto", "uiMode-on", "uiMode-off", "map-canvas", "map-lite",
    ]);
    expect(Object.values(c.tools).every((t) => t.toggle)).toBe(true);
  });

  it("marks the tool matching the current uiMode active, others off", () => {
    const c = build({ uiMode: "on" });
    expect(c.tools["uiMode-on"].active).toBe(true);
    expect(c.tools["uiMode-auto"].active).toBe(false);
    expect(c.tools["uiMode-off"].active).toBe(false);
  });

  it("marks the tool matching the current mapRenderer active, others off", () => {
    const c = build({ mapRenderer: "lite" });
    expect(c.tools["map-lite"].active).toBe(true);
    expect(c.tools["map-canvas"].active).toBe(false);
  });

  it("invokes onSelectUiMode with the tool's value when a uiMode tool fires", () => {
    const onSelectUiMode = vi.fn();
    const c = build({ onSelectUiMode });
    c.tools["uiMode-off"].onChange?.(new Event("click"), false);
    expect(onSelectUiMode).toHaveBeenCalledWith<[UiMode]>("off");
  });

  it("invokes onSelectMapRenderer with the tool's value when a renderer tool fires", () => {
    const onSelectMapRenderer = vi.fn();
    const c = build({ onSelectMapRenderer });
    c.tools["map-lite"].onChange?.(new Event("click"), true);
    expect(onSelectMapRenderer).toHaveBeenCalledWith<[MapRenderer]>("lite");
  });

  it("activeTool points at a real tool key", () => {
    const c = build();
    expect(Object.keys(c.tools)).toContain(c.activeTool);
  });
});
