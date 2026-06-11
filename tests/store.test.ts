import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../src/app/store";

describe("useAppStore", () => {
  beforeEach(() => useAppStore.setState({ activeTab: "sheet", actorId: null }));

  it("defaults to the sheet tab and no actor", () => {
    const s = useAppStore.getState();
    expect(s.activeTab).toBe("sheet");
    expect(s.actorId).toBeNull();
  });
  it("switches tabs", () => {
    useAppStore.getState().setActiveTab("combat");
    expect(useAppStore.getState().activeTab).toBe("combat");
  });
  it("sets and clears the actor id", () => {
    useAppStore.getState().setActorId("hero");
    expect(useAppStore.getState().actorId).toBe("hero");
    useAppStore.getState().setActorId(null);
    expect(useAppStore.getState().actorId).toBeNull();
  });
});
