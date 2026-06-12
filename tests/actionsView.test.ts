import { describe, it, expect } from "vitest";
import { buildActionsView } from "../src/foundry/actor/actions";
import type { ActionItemLike, ActionsActorLike } from "../src/foundry/actor/types";

const action = (over: Partial<ActionItemLike> & { id: string; name: string }): ActionItemLike => ({
  type: "action",
  system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] }, frequency: null },
  ...over,
});

describe("buildActionsView", () => {
  it("groups encounter actions by cost type, ordered Actions/Reactions/Free, sorted by name", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "b", name: "Bravado", system: { actionType: { value: "free" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "r", name: "Riposte", system: { actionType: { value: "reaction" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "z", name: "Zephyr", system: { actionType: { value: "action" }, actions: { value: 2 }, traits: { value: [] } } }),
          action({ id: "a", name: "Aid", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
        ],
        feat: [],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    expect(v.map((g) => g.key)).toEqual(["action", "reaction", "free"]);
    expect(v[0].actions.map((a) => [a.name, a.glyph])).toEqual([["Aid", "1"], ["Zephyr", "2"]]);
    expect(v[1].actions[0]).toMatchObject({ name: "Riposte", glyph: "reaction" });
    expect(v[2].actions[0]).toMatchObject({ name: "Bravado", glyph: "free" });
  });

  it("splits exploration and downtime and carries frequency", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "e", name: "Search", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: ["exploration"] } } }),
          action({ id: "d", name: "Earn Income", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: ["downtime"] } } }),
          action({ id: "f", name: "Goblin Song", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] }, frequency: { value: 1, max: 1, per: "PT1M" } } }),
        ],
        feat: [],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    expect(v.find((g) => g.key === "exploration")?.actions[0].name).toBe("Search");
    expect(v.find((g) => g.key === "downtime")?.actions[0].name).toBe("Earn Income");
    expect(v.find((g) => g.key === "action")?.actions[0].frequency).toEqual({ value: 1, max: 1, per: "PT1M" });
  });

  it("includes only feats with an action cost, skips suppressed, includes passive action items as free", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "p", name: "Passive Thing", system: { actionType: { value: "passive" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "s", name: "Suppressed", suppressed: true, system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
        ],
        feat: [
          action({ id: "fa", name: "Feat Action", type: "feat", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
          action({ id: "fp", name: "Passive Feat", type: "feat", system: { actionType: { value: "passive" }, actions: { value: null }, traits: { value: [] } } }),
        ],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    const free = v.find((g) => g.key === "free")?.actions.map((a) => a.name) ?? [];
    const acts = v.find((g) => g.key === "action")?.actions.map((a) => a.name) ?? [];
    expect(free).toEqual(["Passive Thing"]); // passive action item → free bucket, glyph null
    expect(acts).toEqual(["Feat Action"]); // feat with cost included; passive feat + suppressed excluded
    expect(v.find((g) => g.key === "free")?.actions[0].glyph).toBeNull();
  });

  it("returns [] for an actor with no actions", () => {
    expect(buildActionsView({})).toEqual([]);
  });
});
