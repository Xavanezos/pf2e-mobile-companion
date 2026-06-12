import { describe, it, expect, beforeEach } from "vitest";
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  previewStrikeAttack,
  setStrikeAmmo,
} from "../src/foundry/actor/strikeActions";

interface Call { method: string; args: unknown[]; snapshot?: boolean[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  // Two modifiers; `calculateTotal` mimics PF2e: ignored → enabled false, total = Σ enabled.
  const modifiers = [
    { slug: "ability", label: "Strength", modifier: 4, enabled: true, ignored: false, hideIfDisabled: false },
    { slug: "potency", label: "Potency", modifier: 1, enabled: true, ignored: false, hideIfDisabled: false },
  ];
  const variant = (i: number, penalty: number) => ({
    penalty,
    roll: (...args: unknown[]) => {
      // Snapshot each modifier's `ignored` AT ROLL TIME — proves the flip is live during the roll.
      calls.push({ method: `variant${i}.roll`, args, snapshot: modifiers.map((m) => m.ignored) });
      return Promise.resolve();
    },
  });
  const formulaFor = (m: string, a: unknown[]) =>
    (a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8" : "1d8+4") : undefined;
  const strike = {
    slug: "longsword",
    variants: [variant(0, 0), variant(1, -5), variant(2, -10)],
    modifiers,
    totalModifier: 5,
    calculateTotal() {
      calls.push({ method: "calculateTotal", args: [] });
      for (const m of modifiers) m.enabled = !m.ignored;
      this.totalModifier = modifiers.filter((m) => m.enabled).reduce((t, m) => t + m.modifier, 0);
    },
    damage: (...args: unknown[]) => { calls.push({ method: "damage", args }); return Promise.resolve(formulaFor("damage", args)); },
    critical: (...args: unknown[]) => { calls.push({ method: "critical", args }); return Promise.resolve(formulaFor("critical", args)); },
    auxiliaryActions: [{ execute: (...args: unknown[]) => { calls.push({ method: "aux.execute", args }); return Promise.resolve(); } }],
    item: { id: "w1", update: (...args: unknown[]) => { calls.push({ method: "item.update", args }); return Promise.resolve(); } },
  };
  const actor = { system: { actions: [strike] } };
  (globalThis as { game?: unknown }).game = {
    actors: { get: () => actor },
    user: { settings: { showCheckDialogs: true, showDamageDialogs: false } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { PointerEvent?: unknown }).PointerEvent = class {
    shiftKey: boolean;
    constructor(public type: string, init?: { shiftKey?: boolean }) { this.shiftKey = !!init?.shiftKey; }
  } as unknown;
  return calls;
}

describe("strike actions", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls the chosen MAP variant with a skip-dialog click event (mirrors showCheckDialogs)", async () => {
    await rollStrikeAttack("a", 0, 1);
    expect(calls[0].method).toBe("variant1.roll");
    const arg = calls[0].args[0] as { event?: { type?: string; shiftKey?: boolean } };
    expect(arg.event?.type).toBe("click");
    expect(arg.event?.shiftKey).toBe(true);
  });

  it("rolls damage and critical with showDamageDialogs mirrored into the event", async () => {
    await rollStrikeDamage("a", 0);
    await rollStrikeCritical("a", 0);
    expect(calls.map((c) => c.method)).toEqual(["damage", "critical"]);
    const dmgArg = calls[0].args[0] as { event?: { shiftKey?: boolean } };
    expect(dmgArg.event?.shiftKey).toBe(false);
  });

  it("runs an auxiliary action by index", async () => {
    await runAuxiliaryAction("a", 0, 0);
    expect(calls.map((c) => c.method)).toEqual(["aux.execute"]);
  });

  it("previews damage and critical formulas without rolling", async () => {
    expect(await previewStrikeDamage("a", 0, false)).toBe("1d8+4");
    expect(await previewStrikeDamage("a", 0, true)).toBe("2d8+8");
  });

  it("previews the full attack total when nothing is disabled", async () => {
    expect(await previewStrikeAttack("a", 0, 0, [])).toEqual({
      total: 5, // totalModifier 5 + penalty 0
      parts: [
        { slug: "ability", label: "Strength", value: 4, enabled: true },
        { slug: "potency", label: "Potency", value: 1, enabled: true },
      ],
    });
  });

  it("previews with a modifier disabled (drops it from the total + greys it) and restores .ignored", async () => {
    // variant 1 → MAP penalty -5; potency disabled → totalModifier 4, total 4 + (-5) = -1
    expect(await previewStrikeAttack("a", 0, 1, ["potency"])).toEqual({
      total: -1,
      parts: [
        { slug: "ability", label: "Strength", value: 4, enabled: true },
        { slug: "potency", label: "Potency", value: 1, enabled: false },
      ],
    });
    const live = (globalThis as unknown as { game: { actors: { get(): { system: { actions: { modifiers: { ignored: boolean }[]; totalModifier: number }[] } } } } }).game.actors.get().system.actions[0];
    expect(live.modifiers.map((m) => m.ignored)).toEqual([false, false]); // restored
    expect(live.totalModifier).toBe(5); // recomputed back to full
  });

  it("preview returns null when the variant is missing", async () => {
    expect(await previewStrikeAttack("a", 0, 9, [])).toBeNull();
  });

  it("sets the selected ammo on the strike's weapon item", async () => {
    await setStrikeAmmo("a", 0, "ammo1");
    expect(calls[0].method).toBe("item.update");
    expect(calls[0].args[0]).toEqual({ system: { selectedAmmoId: "ammo1" } });
  });

  it("clears ammo with null", async () => {
    await setStrikeAmmo("a", 0, null);
    expect(calls[0].args[0]).toEqual({ system: { selectedAmmoId: null } });
  });

  it("never throws / returns null when the strike, variant, or aux is missing", async () => {
    await expect(rollStrikeAttack("a", 99, 0)).resolves.toBeUndefined();
    await expect(rollStrikeAttack("a", 0, 9)).resolves.toBeUndefined();
    await expect(runAuxiliaryAction("a", 0, 9)).resolves.toBeUndefined();
    expect(await previewStrikeDamage("a", 99, false)).toBeNull();
    expect(calls).toEqual([]);
  });
});
