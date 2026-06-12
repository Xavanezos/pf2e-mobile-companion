import { describe, it, expect } from "vitest";
import { buildTogglesView } from "../src/foundry/actor/toggles";
import type { TogglesActorLike } from "../src/foundry/actor/types";

describe("buildTogglesView", () => {
  it("flattens actions-placement toggles across domains, mapping checked/enabled", () => {
    const actor: TogglesActorLike = {
      synthetics: {
        toggles: {
          "all": { "rage": { itemId: "i1", label: "Rage", placement: "actions", domain: "all", option: "rage", checked: true, enabled: true } },
          "attack-roll": { "panache": { itemId: "i2", label: "Panache", placement: "actions", domain: "attack-roll", option: "panache", checked: false, enabled: true } },
        },
      },
    };
    expect(buildTogglesView(actor)).toEqual([
      { domain: "all", option: "rage", itemId: "i1", label: "Rage", checked: true, enabled: true },
      { domain: "attack-roll", option: "panache", itemId: "i2", label: "Panache", checked: false, enabled: true },
    ]);
  });

  it("renders alwaysActive toggles as checked-but-disabled", () => {
    const actor: TogglesActorLike = {
      synthetics: {
        toggles: { "all": { "stance": { itemId: "i3", label: "Stance", placement: "actions", domain: "all", option: "stance", checked: true, enabled: true, alwaysActive: true } } },
      },
    };
    expect(buildTogglesView(actor)).toEqual([
      { domain: "all", option: "stance", itemId: "i3", label: "Stance", checked: true, enabled: false },
    ]);
  });

  it("excludes non-actions placements and tolerates missing synthetics", () => {
    const actor: TogglesActorLike = {
      synthetics: { toggles: { "d": { "x": { itemId: "i", label: "X", placement: "encounter", domain: "d", option: "x", checked: false, enabled: true } } } },
    };
    expect(buildTogglesView(actor)).toEqual([]);
    expect(buildTogglesView({})).toEqual([]);
  });
});
