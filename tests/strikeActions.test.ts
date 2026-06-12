import { describe, it, expect, beforeEach } from "vitest";
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  setStrikeAmmo,
} from "../src/foundry/actor/strikeActions";

interface Call { method: string; args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const variant = (i: number) => ({
    roll: (...args: unknown[]) => { calls.push({ method: `variant${i}.roll`, args }); return Promise.resolve(); },
  });
  const formulaFor = (m: string, a: unknown[]) =>
    (a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8" : "1d8+4") : undefined;
  const strike = {
    slug: "longsword",
    variants: [variant(0), variant(1), variant(2)],
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
